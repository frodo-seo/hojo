import { getApiKeys } from "./apiKeys";
import { httpJson } from "./http";
import { ApiKeyMissingError } from "./receipt";

const PERSONA = `너는 조선시대 호조판서(戶曹判書)이다. 전하의 한 달(혹은 한 해) 가계 장부를 친히 살핀 뒤, 전하께 올리는 상소문(上疏文)을 쓴다.

【문체 규칙】
- 상소문 어투를 사용하되, 현대인이 어렵지 않게 읽을 수 있는 수준의 문어체로.
- 서두는 "전하, 이달의 가계를 살피어 아뢰옵나이다." 같은 격식을 갖춘 인사로 시작.
- 문장 끝은 "~이옵니다 / ~하옵니다 / ~하시옵소서 / ~하심이 마땅하옵니다" 같은 종결 혼용.
- 맺음은 겸양된 어조로 ("소신, 삼가 올리옵나이다." 등).
- 판서의 관점에서 칭찬할 바는 치하하고, 경계할 바는 간언(諫言)하라.
- 구체적 숫자는 반드시 본문에 인용하라.
- 이모지·마크다운 기호·이스케이프 금지. 순수 한국어 문장만.`;

export async function generateMemorial(
  stats: string,
  type: "monthly" | "yearly",
  year?: string,
): Promise<string> {
  const { anthropic } = await getApiKeys();
  if (!anthropic) throw new ApiKeyMissingError("anthropic");

  const isYearly = type === "yearly";
  const prompt = isYearly
    ? `${PERSONA}

【임무】
${year}년 한 해의 가계 장부를 총람하여 연말 상소를 올려라.
- 분량: 한국어 10줄 이내.
- 포함: 월별 흐름과 변화, 가장 알뜰했던 달과 과히 쓰신 달, 연간 총 지출과 주요 항목 비중, 내년을 위한 방책 두 가지.

【장부】
${stats}`
    : `${PERSONA}

【임무】
이달의 가계를 살피고 상소를 올려라.
- 분량: 한국어 5~7줄.
- 포함: 구체적 숫자, 치하할 점과 경계할 점, 실질적 절약 방책 한 가지.

【장부】
${stats}`;

  const res = await httpJson<{ content?: Array<{ type: string; text?: string }> }>(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: {
        "x-api-key": anthropic,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: {
        model: "claude-sonnet-4-6",
        max_tokens: isYearly ? 1024 : 512,
        messages: [{ role: "user", content: prompt }],
      },
    },
  );

  if (!res.ok) throw new Error(`AI 분석 실패 (${res.status})`);
  const text = res.data.content?.[0]?.text || "";
  if (!text) throw new Error("상소문을 받지 못하였사옵니다");
  return text;
}
