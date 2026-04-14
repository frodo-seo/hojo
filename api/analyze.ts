import { callClaude, extractJson } from "./_lib/claude";
import { badRequest, json, readJson, serverError } from "./_lib/json";

export const config = { runtime: "edge" };

type Mode = "daily" | "memory" | "settle";

type Body = {
  mode: Mode;
  store: string;
  date: string;
  total: number;
  items: Array<{ name: string; price: number }>;
  partySize?: number;
};

const PROMPTS: Record<Mode, string> = {
  daily: `영수증 품목을 분류하고 인사이트를 제공하세요.

[응답 - JSON만]
{
  "items": [{"name":"...","price":0,"major":"식비","minor":"간식"}],
  "tags": ["#편의점","#야식"],
  "insight": "한줄 인사이트"
}`,
  memory: `영수증+사진 맥락으로 한줄 스토리를 만드세요.

[규칙]
- 20자 내외, 담백한 에세이 감성
- 혼자: 나만의 시간의 가치
- 여럿: 관계의 따뜻함

[응답 - JSON만]
{
  "story": "화요일 점심, 골목 끝 라멘 한 그릇의 위로",
  "tags": ["#혼밥","#라멘","#점심맛집"],
  "mood": "peaceful"
}`,
  settle: `영수증 품목과 인원수로 정산을 계산하세요.

[응답 - JSON만]
{
  "equal_split": 13000,
  "smart_split": {"suggestion": "...", "note": "..."},
  "story": "금요일 밤, 다섯 명의 삼겹살 동맹",
  "tags": ["#회식","#금요일밤"]
}`,
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return badRequest("POST only");

  let body: Body;
  try {
    body = await readJson<Body>(req);
  } catch {
    return badRequest("invalid json");
  }
  if (!body.mode || !body.items) return badRequest("mode/items required");

  try {
    const { text, usage } = await callClaude({
      system: PROMPTS[body.mode],
      max_tokens: 800,
      label: `analyze.${body.mode}`,
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            store: body.store,
            date: body.date,
            total: body.total,
            items: body.items,
            party_size: body.partySize,
          }),
        },
      ],
    });
    return json({
      ...(extractJson(text) as Record<string, unknown>),
      _usage: usage,
    });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "analyze failed");
  }
}
