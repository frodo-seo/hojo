import { httpJson } from "./http";
import { currentLang } from "./i18n";

function msg(ko: string, en: string): string {
  return currentLang() === "en" ? en : ko;
}

export type ScanKind = "ledger" | "asset_trade" | "unknown";

interface Classification {
  kind: ScanKind;
  reason?: string;
}

const TOOL = {
  name: "classify_scan",
  description: "스크린샷 OCR 텍스트를 장부(ledger) 또는 자산(asset_trade)으로 분류",
  input_schema: {
    type: "object",
    properties: {
      kind: {
        type: "string",
        enum: ["ledger", "asset_trade", "unknown"],
        description:
          "ledger=지출·수입·정기지출·정기수입이 섞일 수 있는 장부성 이미지(영수증·카드승인·카드 알림 리스트·급여명세·구독 청구·입금 알림). asset_trade=증권·암호화폐·원자재 보유/매매 화면(티커·수량·평단가 등장). unknown=위 둘 다 아님(풍경·인물·일반 스크린샷).",
      },
      reason: {
        type: "string",
        description: "분류 근거 한 문장",
      },
    },
    required: ["kind"],
  },
};

/** OCR 텍스트 → ledger vs asset_trade 분류. 세부 타입은 parseLedger가 라인별로 결정. */
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
        model: "claude-sonnet-4-6",
        max_tokens: 256,
        tools: [TOOL],
        tool_choice: { type: "tool", name: "classify_scan" },
        messages: [
          {
            role: "user",
            content: `스크린샷 OCR 텍스트를 2가지 중 하나로 분류하세요.\n\n- ledger: 영수증·카드승인·카드알림·배달앱·결제알림·계좌이체·입금알림·환불·급여명세서·통신요금·관리비·월세·구독 청구 등. 지출·수입·정기 여부는 나중에 라인별로 판단하므로 여기서는 "장부성 거래가 보이는가"만 보면 됩니다.\n- asset_trade: 증권사(토스증권·삼성증권·미래에셋)·거래소(업비트·빗썸·바이낸스)·티커/수량/평단가 표시, 금·은 시세 화면.\n- unknown: 위 어디에도 맞지 않음(풍경·인물·책·메뉴판·일반 스크린샷).${hintBlock}\n\nOCR 텍스트:\n${cleaned}`,
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
