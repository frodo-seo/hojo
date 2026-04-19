import { getApiKeys } from "./apiKeys";
import { httpJson } from "./http";
import { ApiKeyMissingError } from "./receipt";
import { currentLang } from "./i18n";

const PERSONA_KO = `당신은 개인 재정 데이터를 분석하는 애널리스트입니다. 사용자의 월간/연간 지출 데이터를 바탕으로 간결하고 신뢰할 수 있는 리포트를 작성합니다.

【문체 규칙】
- 정중하되 드라이한 분석적 문체. 존댓말 사용.
- 불필요한 수식 없이 관찰된 사실 중심.
- 구체적 숫자를 본문에 인용할 것.
- 과장된 칭찬이나 질책 금지. 객관적 관찰·시사점만.
- 이모지·마크다운 기호 금지. 문단은 빈 줄로 구분.`;

const PERSONA_EN = `You are an analyst reviewing personal financial data. Write concise, trustworthy reports based on the user's monthly or yearly spending data.

[Style rules]
- Measured, dry, analytical tone. Plain declarative sentences.
- Stick to observed facts; no filler.
- Quote specific numbers inline.
- No exaggerated praise or blame. Objective observations and implications only.
- No emoji, no markdown symbols. Separate paragraphs with blank lines.`;

function buildPrompt(stats: string, type: "monthly" | "yearly", year?: string): string {
  const lang = currentLang();
  const persona = lang === "en" ? PERSONA_EN : PERSONA_KO;
  const isYearly = type === "yearly";

  if (lang === "en") {
    return isYearly
      ? `${persona}

[Task]
Write an annual report analyzing ${year} spending data.
- Length: around 8-10 lines.
- Cover: month-by-month flow and shifts, lowest/highest spend months, yearly total with major category shares, two recommendations for next year.

[Data]
${stats}`
      : `${persona}

[Task]
Write a monthly report analyzing this month's spending data.
- Length: 5-7 lines.
- Cover: key figures, one or two notable patterns, one actionable recommendation.

[Data]
${stats}`;
  }

  return isYearly
    ? `${persona}

【과제】
${year}년 한 해 지출 데이터를 분석한 연간 리포트 작성.
- 분량: 8~10줄 내외.
- 포함: 월별 흐름과 변화, 최소/최대 지출월, 연간 총지출과 주요 카테고리 비중, 내년을 위한 권고 2가지.

【데이터】
${stats}`
    : `${persona}

【과제】
이번 달 지출 데이터를 분석한 월간 리포트 작성.
- 분량: 5~7줄.
- 포함: 핵심 수치, 주목할 패턴 1~2개, 실질적 권고 1가지.

【데이터】
${stats}`;
}

export async function generateMemorial(
  stats: string,
  type: "monthly" | "yearly",
  year?: string,
): Promise<string> {
  const { anthropic } = await getApiKeys();
  if (!anthropic) throw new ApiKeyMissingError("anthropic");

  const isYearly = type === "yearly";
  const prompt = buildPrompt(stats, type, year);
  const lang = currentLang();

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

  if (!res.ok) {
    const msg = lang === "en" ? `AI analysis failed (${res.status})` : `AI 분석 실패 (${res.status})`;
    throw new Error(msg);
  }
  const text = res.data.content?.[0]?.text || "";
  if (!text) {
    throw new Error(lang === "en" ? "No report returned" : "리포트를 받지 못했습니다");
  }
  return text;
}
