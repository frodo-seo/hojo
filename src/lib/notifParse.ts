import { httpJson } from "./http";
import { currentLang } from "./i18n";

function msg(ko: string, en: string): string {
  return currentLang() === "en" ? en : ko;
}

export interface ParsedNotif {
  is_payment: boolean;
  amount: number;
  currency?: string;
  store?: string;
  category:
    | "food" | "cafe" | "transport" | "housing" | "living"
    | "shopping" | "health" | "culture" | "education" | "event"
    | "etc-expense" | null;
  date?: string;
}

const TOOL = {
  name: "parse_payment_notif",
  description: "카드·페이·은행 결제 알림 텍스트에서 지출 정보를 구조화",
  input_schema: {
    type: "object",
    properties: {
      is_payment: {
        type: "boolean",
        description:
          "실제 결제/이체 승인 알림이면 true. 프로모션·광고·한도 안내·로그인 경고 등은 false.",
      },
      amount: { type: "number", description: "결제 금액 (통화 단위의 숫자만)" },
      currency: {
        type: "string",
        description:
          "ISO 4217 통화 코드. 원·₩·KRW=KRW, $·USD·달러=USD, €=EUR, ¥=JPY, £=GBP 등. 표기 없으면 KRW.",
      },
      store: { type: "string", description: "가맹점명" },
      category: {
        type: ["string", "null"],
        enum: [
          "food", "cafe", "transport", "housing", "living",
          "shopping", "health", "culture", "education", "event",
          "etc-expense", null,
        ],
        description: "확실하지 않으면 null",
      },
      date: { type: "string", description: "YYYY-MM-DD. 알림에 명시되지 않으면 생략." },
    },
    required: ["is_payment", "amount"],
  },
};

/** 결제 알림 파싱. 프로모 등은 is_payment=false로 필터. */
export async function parseNotification(
  title: string,
  body: string,
  pkg: string,
  anthropicKey: string,
): Promise<ParsedNotif> {
  const res = await httpJson<{
    content?: Array<{ type: string; input?: unknown }>;
  }>(
    "https://api.anthropic.com/v1/messages",
    {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: {
        model: "claude-haiku-4-5-20251001",
        max_tokens: 256,
        tools: [TOOL],
        tool_choice: { type: "tool", name: "parse_payment_notif" },
        messages: [
          {
            role: "user",
            content: `다음은 모바일 결제 알림입니다. 실제 결제·이체 승인인지 판단하고, 맞으면 금액·통화·가맹점·카테고리 추출. 통화는 알림에 나오는 단위를 그대로 인식하고 ISO 코드로 반환 (원/₩→KRW, $/달러/USD→USD, €→EUR, ¥→JPY 등). 금액은 통화 기호를 제외한 숫자만. 프로모·광고·한도 안내·로그인 알림은 is_payment=false. 카테고리: food=식비 cafe=카페 transport=교통(주유·택시·대중교통) housing=주거(통신·관리비·월세) living=생활(편의점·마트) shopping=쇼핑 health=의료 culture=문화 education=교육 event=경조사 etc-expense=기타. 불확실하면 null.\n\n앱: ${pkg}\n제목: ${title}\n내용: ${body}`,
          },
        ],
      },
    },
  );
  if (!res.ok) {
    throw new Error(msg(`알림 파싱 실패 (${res.status})`, `Notification parse failed (${res.status})`));
  }
  const toolUse = res.data.content?.find((c) => c.type === "tool_use");
  if (!toolUse?.input) {
    throw new Error(msg("파싱 결과를 받지 못했습니다", "No parse result returned"));
  }
  return toolUse.input as ParsedNotif;
}
