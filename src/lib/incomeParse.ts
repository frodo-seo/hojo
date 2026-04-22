import { httpJson } from "./http";
import { currentLang } from "./i18n";

function msg(ko: string, en: string): string {
  return currentLang() === "en" ? en : ko;
}

export type IncomeCategory = "salary" | "side" | "allowance" | "etc-income";

export interface ParsedIncome {
  amount: number;
  date?: string;          // YYYY-MM-DD
  source?: string;        // 급여 발행처·송금인 등
  category: IncomeCategory;
  memo?: string;
}

export interface ParsedFixedIncome {
  name: string;           // "급여", "용돈" 등
  amount: number;         // 매월 금액 (순수령 기준)
  category: IncomeCategory;
}

const INCOME_TOOL = {
  name: "parse_income",
  description: "일회성 수입 내역 구조화 (입금알림·환불·중고거래 수신 등)",
  input_schema: {
    type: "object",
    properties: {
      amount: { type: "number", description: "수령 금액 (세후 기준)" },
      date: { type: "string", description: "YYYY-MM-DD. 불명확하면 생략." },
      source: { type: "string", description: "송금인·발행처·거래처명" },
      category: {
        type: "string",
        enum: ["salary", "side", "allowance", "etc-income"],
        description: "salary=급여 side=부수입(중고거래·프리랜스) allowance=용돈 etc-income=기타",
      },
      memo: { type: "string" },
    },
    required: ["amount", "category"],
  },
};

const FIXED_INCOME_TOOL = {
  name: "parse_fixed_income",
  description: "매월 반복 수입 (급여명세서·정기 이체)",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "표시용 이름 (예: 급여, 배당금)" },
      amount: { type: "number", description: "매월 수령 금액 (세후 실수령액 우선)" },
      category: {
        type: "string",
        enum: ["salary", "side", "allowance", "etc-income"],
      },
    },
    required: ["name", "amount", "category"],
  },
};

async function callTool<T>(
  anthropicKey: string,
  tool: typeof INCOME_TOOL | typeof FIXED_INCOME_TOOL,
  userContent: string,
): Promise<T> {
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
        max_tokens: 512,
        tools: [tool],
        tool_choice: { type: "tool", name: tool.name },
        messages: [{ role: "user", content: userContent }],
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
  return toolUse.input as T;
}

function hintBlock(userHint?: string): string {
  return userHint?.trim() ? `\n\n사용자 지시 (최우선 반영):\n${userHint.trim()}\n` : "";
}

/** 일회성 수입 파싱 */
export function parseIncome(
  cleaned: string,
  anthropicKey: string,
  userHint?: string,
): Promise<ParsedIncome> {
  const content = `다음 OCR 텍스트에서 일회성 수입을 추출하세요. 세후 실수령액 기준. 카테고리: salary=급여 side=부수입 allowance=용돈 etc-income=기타.${hintBlock(userHint)}\n\nOCR 텍스트:\n${cleaned}`;
  return callTool<ParsedIncome>(anthropicKey, INCOME_TOOL, content);
}

/** 매월 반복 수입 파싱 (고정수입 등록용) */
export function parseFixedIncome(
  cleaned: string,
  anthropicKey: string,
  userHint?: string,
): Promise<ParsedFixedIncome> {
  const content = `다음 OCR 텍스트는 급여명세서 또는 정기 수입입니다. 매월 반복될 금액과 이름을 추출하세요. 금액은 세후 실수령액 우선.${hintBlock(userHint)}\n\nOCR 텍스트:\n${cleaned}`;
  return callTool<ParsedFixedIncome>(anthropicKey, FIXED_INCOME_TOOL, content);
}
