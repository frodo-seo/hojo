import type { IncomingMessage, ServerResponse } from "node:http";

export const config = { runtime: "nodejs", maxDuration: 60 };

const TOOL = {
  name: "parse_receipt",
  description: "지출 내역 구조화 (영수증, 결제 캡쳐, 배달앱, 송금 등)",
  input_schema: {
    type: "object",
    properties: {
      store: { type: "string" },
      date: { type: "string", description: "YYYY-MM-DD" },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            price: { type: "number" },
            category: {
              type: ["string", "null"],
              enum: [
                "food",
                "cafe",
                "transport",
                "housing",
                "living",
                "shopping",
                "health",
                "culture",
                "education",
                "event",
                "etc-expense",
                null,
              ],
              description: "확실하지 않으면 null",
            },
          },
          required: ["name", "price"],
        },
      },
      total: { type: "number" },
    },
    required: ["items", "total"],
  },
};

async function readJsonBody(req: IncomingMessage): Promise<any> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end("Method not allowed");
    return;
  }

  const started = Date.now();
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const datalabKey = process.env.CHANDRA_API_KEY;

  if (!anthropicKey || !datalabKey) {
    console.error("[receipt] missing keys:", { anthropic: !!anthropicKey, datalab: !!datalabKey });
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "API keys not configured" }));
    return;
  }

  let body: { image?: string; mediaType?: string };
  try {
    body = await readJsonBody(req);
  } catch (err) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "Invalid JSON body" }));
    return;
  }

  const { image, mediaType } = body;
  if (!image) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "No image provided" }));
    return;
  }

  console.log(`[receipt] start mediaType=${mediaType} imageBytes=${image.length}`);

  // ── Stream NDJSON to beat the 25s gateway timeout ──
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/x-ndjson");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("X-Accel-Buffering", "no");

  const send = (obj: unknown) => {
    res.write(JSON.stringify(obj) + "\n");
  };

  send({ type: "ping" });
  const pingInterval = setInterval(() => {
    try { send({ type: "ping" }); } catch { /* closed */ }
  }, 3000);

  try {
    const imageBlob = new Blob(
      [Uint8Array.from(Buffer.from(image, "base64"))],
      { type: mediaType || "image/jpeg" },
    );
    const ext = mediaType === "image/png" ? "png" : "jpg";
    const form = new FormData();
    form.append("file", imageBlob, `receipt.${ext}`);
    form.append("output_format", "markdown");
    form.append("mode", "accurate");

    const convertRes = await fetch("https://www.datalab.to/api/v1/convert", {
      method: "POST",
      headers: { "X-API-Key": datalabKey },
      body: form,
    });
    if (!convertRes.ok) {
      const errText = await convertRes.text();
      console.error(`[receipt] datalab ${convertRes.status}:`, errText.slice(0, 200));
      send({ type: "error", error: "Datalab OCR failed", detail: errText });
      return;
    }

    let convertData = (await convertRes.json()) as {
      request_check_url?: string;
      status?: string;
      markdown?: string;
    };

    if (convertData.request_check_url && convertData.status !== "complete") {
      const checkUrl = convertData.request_check_url;
      for (let i = 0; i < 50; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        const pollRes = await fetch(checkUrl, {
          headers: { "X-API-Key": datalabKey },
        });
        const pollData = (await pollRes.json()) as {
          status?: string;
          markdown?: string;
        };
        if (pollData.status === "complete") { convertData = pollData; break; }
        if (pollData.status === "failed") {
          send({ type: "error", error: "Datalab OCR processing failed" });
          return;
        }
      }
    }

    const rawOcr = convertData.markdown || "";
    if (!rawOcr) {
      console.warn(`[receipt] OCR empty dur=${Date.now() - started}ms`);
      send({ type: "error", error: "OCR returned empty text" });
      return;
    }
    console.log(`[receipt] ocr done rawLen=${rawOcr.length} dur=${Date.now() - started}ms`);

    const haikuRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        tools: [TOOL],
        tool_choice: { type: "tool", name: "parse_receipt" },
        messages: [
          {
            role: "user",
            content: `지출 관련 텍스트(영수증, 카드결제, 배달앱, 송금 등)에서 품목명·가격·카테고리 추출. 품목이 1개여도 추출. 카테고리가 확실하지 않으면 null로. 카테고리: food=식비 cafe=카페 transport=교통 housing=주거 living=생활 shopping=쇼핑 health=의료 culture=문화 education=교육 event=경조사 etc-expense=기타\n\n${rawOcr}`,
          },
        ],
      }),
    });

    if (!haikuRes.ok) {
      const errText = await haikuRes.text();
      console.error(`[receipt] anthropic ${haikuRes.status}:`, errText.slice(0, 200));
      send({ type: "error", error: "Haiku parsing failed", detail: errText });
      return;
    }

    const haikuData = await haikuRes.json();
    const toolUse = haikuData.content?.find(
      (c: { type: string }) => c.type === "tool_use",
    );
    if (!toolUse?.input) {
      send({ type: "error", error: "Failed to parse receipt items" });
      return;
    }

    const itemCount = Array.isArray(toolUse.input?.items) ? toolUse.input.items.length : 0;
    console.log(`[receipt] ok items=${itemCount} dur=${Date.now() - started}ms`);
    send({ type: "done", result: toolUse.input });
  } catch (err) {
    console.error(`[receipt] exception dur=${Date.now() - started}ms:`, err);
    send({ type: "error", error: String(err) });
  } finally {
    clearInterval(pingInterval);
    res.end();
  }
}
