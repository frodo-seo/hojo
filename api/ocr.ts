import { callClaude, extractJson } from "./_lib/claude";
import { runChandraOcr } from "./_lib/datalab";
import { badRequest, json, readJson, serverError } from "./_lib/json";

export const config = { runtime: "edge" };

type Body = { imageBase64: string; mediaType?: string };

type OcrItem = { name: string; price: number };
type OcrResult = {
  store: string;
  date: string;
  items: OcrItem[];
  total: number;
  raw_text?: string;
};

const STRUCTURE_PROMPT = `당신은 영수증 파서입니다. 주어진 영수증 OCR 텍스트를 구조화된 JSON으로 변환하세요.

[규칙]
- 가게명은 영수증 상단에서 추출. 없으면 "알 수 없음"
- 날짜는 ISO8601 형식. 영수증에 없으면 오늘 날짜.
- 금액은 숫자만 (원화 기호/콤마 제거)
- 총액은 items 합계와 일치해야 함. 할인/부가세 라인은 items에서 제외
- 제품명은 OCR 오타를 자연스럽게 교정

[응답 - JSON만. 마크다운/설명 금지]
{
  "store": "GS25 역삼점",
  "date": "2026-04-14T12:30:00.000Z",
  "items": [
    {"name": "삼각김밥 참치", "price": 1200},
    {"name": "포카리스웨트", "price": 2200}
  ],
  "total": 3400
}`;

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return badRequest("POST only");

  let body: Body;
  try {
    body = await readJson<Body>(req);
  } catch {
    return badRequest("invalid json");
  }
  if (!body.imageBase64) return badRequest("imageBase64 required");

  try {
    const rawText = await runChandraOcr(
      body.imageBase64,
      body.mediaType ?? "image/jpeg",
    );
    if (!rawText) {
      return serverError("no text detected");
    }

    const { text: structured, usage } = await callClaude({
      system: STRUCTURE_PROMPT,
      max_tokens: 1200,
      label: "ocr.structure",
      messages: [{ role: "user", content: rawText }],
    });

    const parsed = extractJson<OcrResult>(structured);
    if (!parsed.items || !Array.isArray(parsed.items)) {
      throw new Error("Claude returned malformed items");
    }
    if (!parsed.date) parsed.date = new Date().toISOString();
    if (typeof parsed.total !== "number") {
      parsed.total = parsed.items.reduce((a, b) => a + (b.price ?? 0), 0);
    }

    return json({ ...parsed, raw_text: rawText, _usage: usage });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "ocr failed");
  }
}
