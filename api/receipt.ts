export const config = { runtime: "edge" };

/** OCR 마크다운 → 최소 텍스트 (토큰 절감) */
function cleanOcr(md: string): string {
  return md
    .replace(/!\[.*?\]\(.*?\)/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*{1,3}(.*?)\*{1,3}/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\\([*_~`])/g, "$1")
    .replace(/\|[-:]+\|[-:|\s]*/g, "")
    .replace(/\|/g, " ")
    .replace(/^[-*_]{3,}$/gm, "")
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .join("\n")
    .trim();
}

/** Haiku tool 정의 (최소 토큰) */
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

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const started = Date.now();
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const datalabKey = process.env.CHANDRA_API_KEY;

  if (!anthropicKey || !datalabKey) {
    console.error("[receipt] missing keys:", { anthropic: !!anthropicKey, datalab: !!datalabKey });
    return new Response(
      JSON.stringify({ error: "API keys not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const { image, mediaType } = (await req.json()) as {
    image: string;
    mediaType: string;
  };

  if (!image) {
    console.warn("[receipt] no image");
    return new Response(
      JSON.stringify({ error: "No image provided" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  console.log(`[receipt] start mediaType=${mediaType} imageBytes=${image.length}`);

  try {
    // ── Step 1: Datalab Chandra OCR ──
    const imageBlob = new Blob(
      [Uint8Array.from(atob(image), (c) => c.charCodeAt(0))],
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
      return new Response(
        JSON.stringify({ error: "Datalab OCR failed", detail: errText }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    let convertData = (await convertRes.json()) as {
      request_check_url?: string;
      status?: string;
      markdown?: string;
    };

    // Poll for completion
    if (convertData.request_check_url && convertData.status !== "complete") {
      const checkUrl = convertData.request_check_url;
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const pollRes = await fetch(checkUrl, {
          headers: { "X-API-Key": datalabKey },
        });
        const pollData = (await pollRes.json()) as {
          status?: string;
          markdown?: string;
        };
        if (pollData.status === "complete") {
          convertData = pollData;
          break;
        }
        if (pollData.status === "failed") {
          throw new Error("Datalab OCR processing failed");
        }
      }
    }

    const rawOcr = convertData.markdown || "";
    if (!rawOcr) {
      console.warn(`[receipt] OCR empty dur=${Date.now() - started}ms`);
      return new Response(
        JSON.stringify({ error: "OCR returned empty text" }),
        { status: 422, headers: { "Content-Type": "application/json" } },
      );
    }

    const cleaned = cleanOcr(rawOcr);
    console.log(`[receipt] ocr done rawLen=${rawOcr.length} cleanedLen=${cleaned.length} dur=${Date.now() - started}ms`);

    // ── Step 2: Haiku — parse OCR text ──
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
            content: `지출 관련 텍스트(영수증, 카드결제, 배달앱, 송금 등)에서 품목명·가격·카테고리 추출. 품목이 1개여도 추출. 카테고리가 확실하지 않으면 null로. 카테고리: food=식비 cafe=카페 transport=교통 housing=주거 living=생활 shopping=쇼핑 health=의료 culture=문화 education=교육 event=경조사 etc-expense=기타\n\n${cleaned}`,
          },
        ],
      }),
    });

    if (!haikuRes.ok) {
      const errText = await haikuRes.text();
      console.error(`[receipt] anthropic ${haikuRes.status}:`, errText.slice(0, 200));
      return new Response(
        JSON.stringify({ error: "Haiku parsing failed", detail: errText }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    const haikuData = await haikuRes.json();
    const toolUse = haikuData.content?.find(
      (c: { type: string }) => c.type === "tool_use",
    );

    if (!toolUse?.input) {
      console.warn(`[receipt] parse failed dur=${Date.now() - started}ms`);
      return new Response(
        JSON.stringify({ error: "Failed to parse receipt items" }),
        { status: 422, headers: { "Content-Type": "application/json" } },
      );
    }

    const itemCount = Array.isArray(toolUse.input?.items) ? toolUse.input.items.length : 0;
    console.log(`[receipt] ok items=${itemCount} dur=${Date.now() - started}ms`);

    return new Response(JSON.stringify(toolUse.input), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(`[receipt] exception dur=${Date.now() - started}ms:`, err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
