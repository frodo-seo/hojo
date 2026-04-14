import { callClaude, extractJson } from "./_lib/claude";
import { badRequest, json, readJson, serverError } from "./_lib/json";

export const config = { runtime: "edge" };

type Body = { imageBase64: string; mediaType?: string };
type Result = { count: number; confidence: "low" | "medium" | "high" };

const SYSTEM = `사진 속 사람 수를 세주세요.

[규칙]
- 얼굴이 보이는 사람만 카운트
- 0~20 사이 정수
- 불확실하면 confidence를 낮게

[응답 - JSON만]
{"count": 5, "confidence": "high"}`;

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
    const { text, usage } = await callClaude({
      system: SYSTEM,
      max_tokens: 80,
      label: "count-people",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: body.mediaType ?? "image/jpeg",
                data: body.imageBase64,
              },
            },
            { type: "text", text: "JSON으로만 답해주세요." },
          ],
        },
      ],
    });
    return json({ ...extractJson<Result>(text), _usage: usage });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "count failed");
  }
}
