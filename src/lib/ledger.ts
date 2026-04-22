/**
 * 통합 장부 파서: 한 이미지에서 일회성/정기 · 지출/수입이 섞여 있어도
 * 라인별로 type·통화를 판별해서 추출한다. 자산(asset_trade)은 별도 파서.
 */
import { httpJson } from "./http";
import { currentLang } from "./i18n";
import { fetchFxRate } from "./prices";
import { getBaseCurrency } from "./settings";
import type { Currency } from "../types";

function msg(ko: string, en: string): string {
  return currentLang() === "en" ? en : ko;
}

export type LedgerItemType = "expense" | "income" | "fixed_expense" | "fixed_income";

export interface ParsedLedgerItem {
  type: LedgerItemType;
  name: string;           // 가맹점·송금인·구독명·품목 등
  amount: number;         // base currency로 환산된 값
  categoryId: string;     // 지출 11종 또는 수입 4종
  date: string;           // YYYY-MM-DD
  day?: number;           // fixed_* 때만: 매월 결제일 1-28
  sourceCurrency?: Currency;
  fxRate?: number;
}

export interface ParsedLedger {
  items: ParsedLedgerItem[];
  mixedCurrency?: boolean;
}

const SUPPORTED_CCYS: Currency[] = ["KRW", "USD", "EUR", "JPY", "GBP"];
const EXPENSE_CATS = [
  "food", "cafe", "transport", "housing", "living",
  "shopping", "health", "culture", "education", "event", "etc-expense",
];
const INCOME_CATS = ["salary", "side", "allowance", "etc-income"];
const ALL_CATS = [...EXPENSE_CATS, ...INCOME_CATS];

const LEDGER_TOOL = {
  name: "parse_ledger",
  description:
    "영수증·카드승인·알림 리스트·입금 알림·급여명세·구독 청구 등 장부성 지출/수입을 라인별로 구조화.",
  input_schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        description:
          "이미지에 나타난 모든 거래 라인. 지출·수입·고정 지출·고정 수입이 섞여 있어도 전부 추출. 합치거나 생략 금지.",
        items: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["expense", "income", "fixed_expense", "fixed_income"],
              description:
                "expense=일회성 지출(카드 승인·영수증·배달). income=일회성 수입(환불·중고거래 입금·배당). fixed_expense=매월 반복 청구(통신·월세·구독·OTT). fixed_income=매월 반복 수입(급여명세·정기이체). '정기결제·구독·매월' 단서 있으면 fixed_*, 없으면 일회성.",
            },
            name: {
              type: "string",
              description: "가맹점·송금인·구독 서비스명·품목명. 이미지 표기 그대로.",
            },
            amount: {
              type: "number",
              description: "원본 통화 숫자 그대로. 환산하지 말 것.",
            },
            currency: {
              type: "string",
              enum: SUPPORTED_CCYS,
              description:
                "이 라인의 통화. 라인에 $·USD·€·¥·£ 중 하나라도 보이면 반드시 해당 외화. 원화만 보이면 KRW. 같은 라인에 외화+원화 함께면(카드사 환산) 외화 우선. 외화 단서가 있는 라인을 KRW로 분류 금지.",
            },
            categoryId: {
              type: "string",
              enum: ALL_CATS,
              description:
                "type이 expense/fixed_expense면 지출 카테고리(food·cafe·transport·housing·living·shopping·health·culture·education·event·etc-expense). type이 income/fixed_income이면 수입 카테고리(salary·side·allowance·etc-income). 주거/통신·월세=housing, 구독(OTT)=culture, 헬스장=health, 교육 구독=education, 클라우드/SaaS=etc-expense.",
            },
            date: {
              type: "string",
              description: "YYYY-MM-DD. 일회성(expense/income)일 때 이미지에 보이면 기입. fixed_*도 청구일 보이면 기입.",
            },
            day: {
              type: "number",
              description: "fixed_expense/fixed_income 때만: 매월 결제/입금일 (1-28). 명시되지 않으면 1.",
            },
          },
          required: ["type", "name", "amount", "currency", "categoryId"],
        },
      },
    },
    required: ["items"],
  },
};

interface SonnetLedgerItem {
  type: LedgerItemType;
  name: string;
  amount: number;
  currency?: Currency;
  categoryId: string;
  date?: string;
  day?: number;
}

interface SonnetLedger {
  items: SonnetLedgerItem[];
}

export async function parseLedger(
  cleaned: string,
  anthropicKey: string,
  userHint?: string,
): Promise<ParsedLedger> {
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
        max_tokens: 3072,
        tools: [LEDGER_TOOL],
        tool_choice: { type: "tool", name: "parse_ledger" },
        messages: [
          {
            role: "user",
            content: `OCR 텍스트에서 장부성 거래(지출·수입·고정 지출·고정 수입)를 라인별로 모두 추출하세요.

**중요 1 — 누락 금지.** 영수증 여러 라인, 카드 알림 여러 건, 급여명세 여러 항목이 한 이미지에 있을 수 있습니다. 눈에 보이는 모든 거래 라인을 items에 담으세요. N개면 N개.

**중요 2 — 라인별 type.** 같은 이미지 안에서도 라인마다 expense/income/fixed_expense/fixed_income이 다를 수 있습니다.
- "정기결제·구독 갱신·매월·자동이체·월세·통신비" 같은 단서 → fixed_expense
- "급여·월급·정기입금·급여명세" 단서 → fixed_income
- "일시불·일반승인·해외승인·카드승인·배달·결제" → expense
- "입금·환불·배당·이자·중고거래" → income
- 애매하면 일회성(expense/income)으로.

**중요 3 — 라인별 통화.** 카드 알림 리스트 한 장에 KRW/USD 등 여러 통화가 섞일 수 있습니다.
- 라인에 $·USD·US Dollar → currency=USD, amount는 달러 숫자
- €·EUR → EUR / ¥·JPY → JPY / £·GBP → GBP
- ₩·원·KRW만 보이면 KRW
- 외화+원화 동시 표기(카드사 환산) → 외화 우선. "$12.50 / 17,500원" → USD 12.50.
- 외화 단서 있는 라인을 KRW로 절대 분류하지 말 것.
- amount는 **원본 통화 숫자 그대로** (환산은 코드에서 처리).

**중요 4 — 카테고리.** type에 맞는 카테고리만:
- expense/fixed_expense → food·cafe·transport·housing·living·shopping·health·culture·education·event·etc-expense
- income/fixed_income → salary·side·allowance·etc-income
- 불확실하면 지출은 etc-expense, 수입은 etc-income.

date는 각 라인에 보이면 YYYY-MM-DD로. day는 fixed_* 라인만 결제일 1-28 (미지정 1).

image에 장부성 거래가 전혀 없으면 items=[].${hintBlock}

OCR 텍스트:
${cleaned}`,
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
  const raw = toolUse.input as SonnetLedger;
  return convertLedgerToBase(raw, getBaseCurrency());
}

async function convertLedgerToBase(raw: SonnetLedger, base: Currency): Promise<ParsedLedger> {
  const currencies = Array.from(
    new Set(
      raw.items
        .map((it) => (it.currency && SUPPORTED_CCYS.includes(it.currency) ? it.currency : "KRW"))
        .filter((c) => c !== base),
    ),
  );
  const rates: Record<string, number> = {};
  for (const c of currencies) {
    try {
      rates[c] = await fetchFxRate(c, base);
    } catch {
      // 실패 라인은 원본 유지
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const items: ParsedLedgerItem[] = raw.items.map((it) => {
    const src: Currency =
      it.currency && SUPPORTED_CCYS.includes(it.currency) ? it.currency : "KRW";
    const categoryId = normalizeCategory(it.type, it.categoryId);
    const base0 = {
      type: it.type,
      name: it.name,
      categoryId,
      date: it.date || today,
      day: it.type.startsWith("fixed_") ? clampDay(it.day) : undefined,
      sourceCurrency: src,
    };
    if (src === base) {
      return { ...base0, amount: roundAmount(it.amount, base) };
    }
    const rate = rates[src];
    if (!rate) {
      return { ...base0, amount: it.amount };
    }
    return {
      ...base0,
      amount: roundAmount(it.amount * rate, base),
      fxRate: rate,
    };
  });

  const uniqueCcys = new Set(items.map((it) => it.sourceCurrency));
  return {
    items,
    mixedCurrency: uniqueCcys.size > 1 || undefined,
  };
}

function normalizeCategory(type: LedgerItemType, categoryId: string): string {
  const isExpense = type === "expense" || type === "fixed_expense";
  const validSet = isExpense ? EXPENSE_CATS : INCOME_CATS;
  if (validSet.includes(categoryId)) return categoryId;
  // Sonnet이 잘못 고른 경우 기본값으로 복구
  return isExpense ? "etc-expense" : "etc-income";
}

function clampDay(day: number | undefined): number {
  if (!day || !Number.isFinite(day)) return 1;
  return Math.max(1, Math.min(28, Math.round(day)));
}

function roundAmount(amount: number, ccy: Currency): number {
  if (ccy === "KRW" || ccy === "JPY") return Math.round(amount);
  return Math.round(amount * 100) / 100;
}
