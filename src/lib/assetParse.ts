import { httpJson } from "./http";
import { currentLang } from "./i18n";
import type { AssetKind, Currency } from "../types";

function msg(ko: string, en: string): string {
  return currentLang() === "en" ? en : ko;
}

export type TradeAction = "buy" | "sell" | "holding";

export interface ParsedAssetTrade {
  action: TradeAction;          // buy=매수, sell=매도, holding=현재 보유(스냅샷)
  kind: AssetKind;              // stock | crypto | commodity
  ticker: string;               // "AAPL", "BTC", "XAU"
  name?: string;                // 표시 이름 (OCR에 있으면)
  quantity: number;
  avgCost: number | null;       // 평단가. 스크린샷에 없으면 null (UI에서 수기 입력).
  currency: Currency;           // 통화 기본 추정
  tradedAt?: string;            // YYYY-MM-DD (매매일), 없으면 생략
}

const TOOL = {
  name: "parse_asset_trade",
  description:
    "증권·암호화폐·원자재 스크린샷에서 거래 또는 보유 정보를 구조화. 보유 현황만 있고 매매가 아니면 action=holding.",
  input_schema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["buy", "sell", "holding"],
        description: "buy=매수 확정 내역, sell=매도 확정 내역, holding=현재 보유 현황 스냅샷",
      },
      kind: {
        type: "string",
        enum: ["stock", "crypto", "commodity"],
        description: "stock=주식/ETF crypto=암호화폐 commodity=금·은·백금 등 원자재",
      },
      ticker: {
        type: "string",
        description:
          "거래소 표준 티커 (AAPL, TSLA, BTC, ETH, XAU). 한글 종목명은 영문/숫자 티커로 변환 시도.",
      },
      name: { type: "string", description: "표시용 이름 (OCR에 있으면)" },
      quantity: { type: "number", description: "수량. 부분 단위(0.001 BTC 등) 허용." },
      avgCost: {
        type: ["number", "null"],
        description:
          "1 단위당 평균 매입가. 스크린샷에 명시되지 않으면 null. 총액과 수량을 모두 주면 총액/수량으로 계산.",
      },
      currency: {
        type: "string",
        enum: ["USD", "KRW", "EUR", "JPY", "GBP"],
        description: "기본 통화. 주식은 상장 거래소, 암호화폐는 화면 표시 통화 기준.",
      },
      tradedAt: { type: "string", description: "YYYY-MM-DD. 매매일 확인되면." },
    },
    required: ["action", "kind", "ticker", "quantity", "currency"],
  },
};

/** 자산/거래 스크린샷 파싱. Sonnet 사용. */
export async function parseAssetTrade(
  cleaned: string,
  anthropicKey: string,
  userHint?: string,
): Promise<ParsedAssetTrade> {
  const hintBlock = userHint?.trim()
    ? `\n\n사용자 지시 (보조 정보, OCR에 없는 값 보완·불명확한 값 확정용):\n${userHint.trim()}\n`
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
        max_tokens: 1024,
        tools: [TOOL],
        tool_choice: { type: "tool", name: "parse_asset_trade" },
        messages: [
          {
            role: "user",
            content: `다음 OCR 텍스트는 증권사·거래소·원자재 보유 화면입니다. 티커·수량·평단가·통화를 추출하세요. 평단가가 화면에 없으면 null. 한글 종목명(예: 삼성전자)은 티커(005930)로 변환. 원자재 금=XAU, 은=XAG, 백금=XPT.${hintBlock}\n\nOCR 텍스트:\n${cleaned}`,
          },
        ],
      },
    },
  );
  if (!res.ok) {
    throw new Error(msg(`AI 파싱 실패 (${res.status})`, `AI parsing failed (${res.status})`));
  }
  const toolUse = res.data.content?.find((c) => c.type === "tool_use");
  if (!toolUse?.input) {
    throw new Error(msg("파싱 결과를 받지 못했습니다", "No parse result returned"));
  }
  return toolUse.input as ParsedAssetTrade;
}
