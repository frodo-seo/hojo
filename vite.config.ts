import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'

/** OCR 마크다운 → 최소 텍스트 (토큰 절감) */
function cleanOcr(md: string): string {
  return md
    .replace(/!\[.*?\]\(.*?\)/g, '')       // 이미지 참조
    .replace(/<[^>]+>/g, '')               // HTML 태그
    .replace(/^#{1,6}\s*/gm, '')           // 헤딩
    .replace(/\*{1,3}(.*?)\*{1,3}/g, '$1') // 볼드/이탤릭
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // 링크 → 텍스트만
    .replace(/\\([*_~`])/g, '$1')          // 이스케이프 제거
    .replace(/\|[-:]+\|[-:|\s]*/g, '')     // 테이블 구분선
    .replace(/\|/g, ' ')                   // 파이프 → 공백
    .replace(/^[-*_]{3,}$/gm, '')          // 수평선
    .replace(/[ \t]+/g, ' ')              // 연속 공백
    .split('\n').map(l => l.trim()).filter(Boolean).join('\n')
    .trim()
}

/** Haiku tool 정의 (최소 토큰) */
const TOOL = {
  name: 'parse_receipt',
  description: '지출 내역 구조화 (영수증, 결제 캡쳐, 배달앱, 송금 등)',
  input_schema: {
    type: 'object',
    properties: {
      store: { type: 'string' },
      date: { type: 'string', description: 'YYYY-MM-DD' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            price: { type: 'number' },
            category: {
              type: ['string', 'null'],
              enum: ['food','cafe','transport','housing','living','shopping','health','culture','education','event','etc-expense', null],
              description: '확실하지 않으면 null',
            },
          },
          required: ['name', 'price'],
        },
      },
      total: { type: 'number' },
    },
    required: ['items', 'total'],
  },
}

/** 프롬프트 (최소화) */
function prompt(ocr: string) {
  return `지출 관련 텍스트(영수증, 카드결제, 배달앱, 송금 등)에서 품목명·가격·카테고리 추출. 품목이 1개여도 추출. 카테고리가 확실하지 않으면 null로. 카테고리: food=식비 cafe=카페 transport=교통 housing=주거 living=생활 shopping=쇼핑 health=의료 culture=문화 education=교육 event=경조사 etc-expense=기타\n\n${ocr}`
}

function apiPlugin(): Plugin {
  let anthropicKey = ''
  let datalabKey = ''

  return {
    name: 'api-receipt',
    configResolved({ envDir }) {
      const env = loadEnv('development', envDir, '')
      anthropicKey = env.ANTHROPIC_API_KEY || ''
      datalabKey = env.CHANDRA_API_KEY || ''
    },
    configureServer(server) {
      server.middlewares.use('/api/receipt', async (req, res) => {
        if (req.method !== 'POST') { res.writeHead(405); res.end(); return }
        if (!anthropicKey || !datalabKey) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'API keys not set in .env' }))
          return
        }

        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(chunk)
        const { image, mediaType } = JSON.parse(Buffer.concat(chunks).toString())
        if (!image) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'No image' }))
          return
        }

        try {
          // ── Step 1: Datalab OCR ──
          console.log('[receipt] Step 1: Datalab OCR...')
          const imgBuf = Buffer.from(image, 'base64')
          const boundary = '----F' + Math.random().toString(36).slice(2)
          const ext = mediaType === 'image/png' ? 'png' : 'jpg'
          const formBody = Buffer.concat([
            Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="r.${ext}"\r\nContent-Type: ${mediaType}\r\n\r\n`),
            imgBuf,
            Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="output_format"\r\n\r\nmarkdown\r\n--${boundary}\r\nContent-Disposition: form-data; name="mode"\r\n\r\naccurate\r\n--${boundary}--\r\n`),
          ])

          const convertRes = await fetch('https://www.datalab.to/api/v1/convert', {
            method: 'POST',
            headers: { 'X-API-Key': datalabKey, 'Content-Type': `multipart/form-data; boundary=${boundary}` },
            body: formBody,
          })
          if (!convertRes.ok) {
            const e = await convertRes.text()
            console.error('[receipt] Datalab error:', e)
            res.writeHead(502, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'OCR failed', detail: e }))
            return
          }

          let data = await convertRes.json() as { request_check_url?: string; status?: string; markdown?: string }

          // Poll
          if (data.request_check_url && data.status !== 'complete') {
            const url = data.request_check_url
            for (let i = 0; i < 30; i++) {
              await new Promise(r => setTimeout(r, 2000))
              const p = await fetch(url, { headers: { 'X-API-Key': datalabKey } })
              const pd = await p.json() as { status?: string; markdown?: string }
              if (pd.status === 'complete') { data = pd; break }
              if (pd.status === 'failed') throw new Error('OCR failed')
            }
          }

          const raw = data.markdown || ''
          if (!raw) {
            res.writeHead(422, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'OCR empty' }))
            return
          }

          // 정제
          const cleaned = cleanOcr(raw)
          console.log(`[receipt] OCR: ${raw.length}자 → ${cleaned.length}자 (${Math.round((1 - cleaned.length / raw.length) * 100)}% 절감)`)
          console.log('[receipt] Cleaned:', cleaned.slice(0, 200))

          // ── Step 2: Haiku ──
          console.log('[receipt] Step 2: Haiku parsing...')
          const haikuRes = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': anthropicKey,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: 'claude-haiku-4-5-20251001',
              max_tokens: 1024,
              tools: [TOOL],
              tool_choice: { type: 'tool', name: 'parse_receipt' },
              messages: [{ role: 'user', content: prompt(cleaned) }],
            }),
          })

          if (!haikuRes.ok) {
            const e = await haikuRes.text()
            console.error('[receipt] Haiku error:', e)
            res.writeHead(502, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Haiku failed', detail: e }))
            return
          }

          const hd = await haikuRes.json() as { content?: Array<{ type: string; input?: unknown }> }
          const toolUse = hd.content?.find((c) => c.type === 'tool_use')
          if (!toolUse?.input) {
            res.writeHead(422, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Parse failed' }))
            return
          }

          console.log('[receipt] Done:', JSON.stringify(toolUse.input).slice(0, 200))
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify(toolUse.input))
        } catch (err) {
          console.error('[receipt] Error:', err)
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: String(err) }))
        }
      })

      // ── Coach API ──
      server.middlewares.use('/api/coach', async (req, res) => {
        if (req.method !== 'POST') { res.writeHead(405); res.end(); return }
        if (!anthropicKey) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'API key not set' }))
          return
        }

        const chunks: Buffer[] = []
        for await (const chunk of req) chunks.push(chunk)
        const { stats, type = 'monthly', year } = JSON.parse(Buffer.concat(chunks).toString())
        if (!stats) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'No stats' }))
          return
        }

        const isYearly = type === 'yearly'
        const prompt = isYearly
          ? `${year}년 가계부 연간 소비 통계를 종합 평가해줘. 한국어로 10줄 이내. 월별 흐름과 변화를 분석하고, 가장 잘한 달과 아쉬운 달을 짚어줘. 연간 총 지출과 카테고리별 비중을 요약하고, 내년을 위한 구체적인 제안 2가지를 포함해. 이모지 사용하지 마.\n\n${stats}`
          : `가계부 소비 통계를 보고 짧은 인사이트를 한국어로 5줄 이내로 작성해줘. 구체적인 숫자를 인용하면서 칭찬할 건 칭찬하고, 주의할 건 알려줘. 실질적인 절약 팁도 1개 포함. 이모지 사용하지 마.\n\n${stats}`

        try {
          console.log(`[coach] Sonnet call (${type}), stats:`, stats.slice(0, 100))
          const haikuRes = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': anthropicKey,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: 'claude-sonnet-4-6',
              max_tokens: isYearly ? 1024 : 512,
              messages: [{
                role: 'user',
                content: prompt,
              }],
            }),
          })

          if (!haikuRes.ok) {
            const e = await haikuRes.text()
            console.error('[coach] Sonnet error:', e)
            res.writeHead(502, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ error: 'Sonnet failed', detail: e }))
            return
          }

          const hd = await haikuRes.json() as { content?: Array<{ text?: string }> }
          const text = hd.content?.[0]?.text || ''
          console.log('[coach] Done:', text.slice(0, 100))
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ insight: text }))
        } catch (err) {
          console.error('[coach] Error:', err)
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: String(err) }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), apiPlugin()],
})
