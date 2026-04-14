import { callClaudeAgent } from "./_lib/claude";
import { makeCoachTools } from "./_lib/coach-tools";
import { badRequest, json, readJson, serverError } from "./_lib/json";

export const config = { runtime: "edge" };

type Body = { question: string };

const SYSTEM = `당신은 '소비일기'의 AI 소비 코치입니다.

[규칙]
- 존댓말, 격려 톤, 비난 금지
- 구체적 숫자 + 맥락(지난달 대비 등) 포함
- 실행 가능한 팁 1개 포함 (단, 과도하게 강요 X)
- 한국어, 2~4줄로 간결하게
- 특별한 날·추억 모드 소비는 절약 대상이 아님 → 긍정적으로 반응
- 데이터 조회가 필요하면 반드시 제공된 도구를 사용하세요
- 여러 달/카테고리 비교가 필요하면 도구를 여러 번 호출해도 좋습니다

[오늘 날짜]
{TODAY}

[가능한 카테고리]
식비, 카페, 주류, 생활, 교통, 쇼핑, 문화, 기타

[가능한 모드]
daily(일상), memory(추억), settle(정산)`;

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return badRequest("POST only");

  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return json({ error: "unauthorized" }, { status: 401 });

  let body: Body;
  try {
    body = await readJson<Body>(req);
  } catch {
    return badRequest("invalid json");
  }
  if (!body.question?.trim()) return badRequest("question required");

  try {
    const { tools, executors } = makeCoachTools(token);
    const today = new Date().toISOString().slice(0, 10);
    const { text, usage } = await callClaudeAgent({
      system: SYSTEM.replace("{TODAY}", today),
      tools,
      executors,
      label: "coach",
      max_tokens: 1024,
      messages: [{ role: "user", content: body.question.trim() }],
    });
    return json({ answer: text, _usage: usage });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "coach failed");
  }
}
