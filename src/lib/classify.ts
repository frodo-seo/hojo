import { httpJson } from "./http";
import { currentLang } from "./i18n";

function msg(ko: string, en: string): string {
  return currentLang() === "en" ? en : ko;
}

export type ScanKind =
  | "expense"
  | "income"
  | "fixed_expense"
  | "fixed_income"
  | "asset_trade"
  | "unknown";

interface Classification {
  kind: ScanKind;
  reason?: string;
}

const TOOL = {
  name: "classify_scan",
  description: "스크린샷 OCR 텍스트를 5가지 지출·수입·자산 타입으로 분류",
  input_schema: {
    type: "object",
    properties: {
      kind: {
        type: "string",
        enum: [
          "expense",
          "income",
          "fixed_expense",
          "fixed_income",
          "asset_trade",
          "unknown",
        ],
        description:
          "expense=일회성 지출(영수증·카드결제·배달앱). income=일회성 수입(중고거래 입금·환불 등). fixed_expense=매월 반복 청구(통신사·관리비·월세·구독). fixed_income=매월 반복 수입(월급명세서·정기 이체). asset_trade=증권·암호화폐·금 등 자산 보유/매매 화면. unknown=위 어디에도 해당 안 됨.",
      },
      reason: {
        type: "string",
        description: "분류 근거를 한 문장으로. 사용자에게 표시할 용도.",
      },
    },
    required: ["kind"],
  },
};

/** OCR 텍스트 → 5지 분류. Haiku 사용. userHint가 있으면 최우선 반영. */
export async function classifyScan(
  cleaned: string,
  anthropicKey: string,
  userHint?: string,
): Promise<Classification> {
  const hintBlock = userHint?.trim()
    ? `\n\n사용자 지시 (최우선 반영):\n${userHint.trim()}\n`
    : "";
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
        tool_choice: { type: "tool", name: "classify_scan" },
        messages: [
          {
            role: "user",
            content: `다음은 스크린샷을 OCR한 텍스트입니다. 가장 적합한 한 가지 타입으로 분류하세요.\n\n힌트:\n- 영수증·카드승인·배달앱·결제알림·계좌 이체 출금(내가 보낸 송금) → expense\n- 중고거래 입금·환불·배당금·이자·계좌 이체 입금(내가 받은 송금) → income\n- 통신요금 고지·관리비 청구·월세·넷플릭스 등 구독 → fixed_expense\n- 급여명세서·기본급/공제 항목 포함·정기 이체 패턴 → fixed_income\n- 증권사(토스증권·삼성증권·미래에셋)·거래소(업비트·빗썸·바이낸스)·티커/수량/평단가 표시 → asset_trade\n- 위 어디에도 맞지 않으면 unknown${hintBlock}\n\nOCR 텍스트:\n${cleaned}`,
          },
        ],
      },
    },
  );
  if (!res.ok) {
    throw new Error(msg(`분류 실패 (${res.status})`, `Classification failed (${res.status})`));
  }
  const toolUse = res.data.content?.find((c) => c.type === "tool_use");
  if (!toolUse?.input) {
    throw new Error(msg("분류 결과를 받지 못했습니다", "No classification returned"));
  }
  return toolUse.input as Classification;
}
