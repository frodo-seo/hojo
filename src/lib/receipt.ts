import { httpJson } from "./http";
import { currentLang } from "./i18n";
import { fetchFxRate } from "./prices";
import { getBaseCurrency } from "./settings";
import type { Currency } from "../types";

function msg(ko: string, en: string): string {
  return currentLang() === "en" ? en : ko;
}

/** 이미지를 최대 1280px로 리사이즈 후 base64 반환 */
export function compressImage(
  file: File,
  maxSize = 1280,
): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let { width, height } = img;

        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = Math.round((height * maxSize) / width);
            width = maxSize;
          } else {
            width = Math.round((width * maxSize) / height);
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        const base64 = dataUrl.split(",")[1];
        resolve({ base64, mediaType: "image/jpeg" });
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export interface ReceiptItem {
  name: string;
  price: number;
  category: string | null;
}

export interface ParsedReceipt {
  store?: string;
  date?: string;
  items: ReceiptItem[];
  total: number;
  /** 원본 영수증의 통화 (파싱된 후 이미 base currency로 환산된 값이 total·items[].price에 들어감) */
  sourceCurrency?: Currency;
  /** base currency 환산에 사용한 환율. sourceCurrency === baseCurrency면 undefined. */
  fxRate?: number;
}

export class ApiKeyMissingError extends Error {
  which: "anthropic" | "datalab" | "both";
  constructor(which: "anthropic" | "datalab" | "both") {
    super("API key missing");
    this.name = "ApiKeyMissingError";
    this.which = which;
  }
}

const SUPPORTED_CCYS: Currency[] = ["KRW", "USD", "EUR", "JPY", "GBP"];

const TOOL = {
  name: "parse_receipt",
  description: "지출 내역 구조화 (영수증, 결제 캡쳐, 배달앱, 송금 등)",
  input_schema: {
    type: "object",
    properties: {
      is_receipt: {
        type: "boolean",
        description: "지출 증빙(영수증/결제 알림/배달앱/송금 캡쳐 등)이면 true. 그 외(풍경, 인물, 책, 메뉴판, 간판, 일반 스크린샷 등)는 false.",
      },
      store: { type: "string" },
      date: { type: "string", description: "YYYY-MM-DD" },
      currency: {
        type: "string",
        enum: SUPPORTED_CCYS,
        description: "영수증 원본 통화. 기호($/€/¥/£/₩)·ISO 코드·국가·언어·금액 포맷(소수점 2자리=USD/EUR/GBP, 천 단위 정수=KRW, 소수 없음 대액=JPY)으로 판단. 확실치 않으면 KRW.",
      },
      items: {
        type: "array",
        description: "영수증 원본 통화 기준 품목별 금액. 환산하지 말 것.",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            price: { type: "number", description: "원본 통화 금액. 소수점 그대로 (예: 4.50)." },
            category: {
              type: ["string", "null"],
              enum: [
                "food", "cafe", "transport", "housing", "living",
                "shopping", "health", "culture", "education", "event",
                "etc-expense", null,
              ],
              description: "확실하지 않으면 null",
            },
          },
          required: ["name", "price"],
        },
      },
      total: { type: "number", description: "원본 통화 총액. 환산하지 말 것." },
    },
    required: ["is_receipt", "currency", "items", "total"],
  },
};

interface SonnetReceipt {
  is_receipt: boolean;
  store?: string;
  date?: string;
  currency?: Currency;
  items: ReceiptItem[];
  total: number;
}

async function sonnetParse(cleaned: string, anthropicKey: string, userHint?: string): Promise<SonnetReceipt> {
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
        max_tokens: 1024,
        tools: [TOOL],
        tool_choice: { type: "tool", name: "parse_receipt" },
        messages: [
          {
            role: "user",
            content: `영수증·결제 증빙 OCR 텍스트를 구조화합니다.

1) 지출 증빙 여부 판단
   - 영수증·카드승인·배달앱·결제알림·송금 캡쳐 → is_receipt=true
   - 그 외(풍경, 인물, 메뉴판만 있는 사진, 책, 일반 앱 스크린샷) → is_receipt=false, items=[], total=0, currency=KRW

2) 통화 판별 (매우 중요)
   - 한국어/원(₩, 원, KRW)/한국 사업자등록번호/공급가액/부가세 → KRW
   - $·USD·영어 매장(Starbucks NYC, Whole Foods 등)·TAX 라벨·소수 2자리 ($4.50) → USD
   - €·EUR·독일/프랑스/이탈리아 매장·VAT → EUR
   - ¥·JPY·일본어/일본 매장·소수 없는 정수(¥850) → JPY
   - £·GBP·영국 매장 → GBP
   - 애매하거나 한국 앱 결제면 KRW
   - items[].price와 total은 반드시 **원본 통화 그대로** (환산 금지). price=4.50이면 4.50 그대로.

3) 품목·카테고리 추출
   - 품목 1개여도 추출. 카테고리 불확실하면 null.
   - food=식비 cafe=카페/간식 transport=교통 housing=주거/통신 living=생활
     shopping=쇼핑 health=의료 culture=문화/여가 education=교육 event=경조사 etc-expense=기타${hintBlock}

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
  if (!toolUse?.input) throw new Error(msg("파싱 결과를 받지 못했습니다", "No parse result returned"));
  return toolUse.input as SonnetReceipt;
}

/** 원본 통화 → base currency 환산. FX 실패 시 원본 그대로 반환(사용자가 수정할 수 있도록). */
async function convertReceiptToBase(raw: SonnetReceipt, base: Currency): Promise<ParsedReceipt> {
  const src: Currency = raw.currency && SUPPORTED_CCYS.includes(raw.currency) ? raw.currency : "KRW";
  if (src === base) {
    return {
      store: raw.store,
      date: raw.date,
      items: raw.items,
      total: roundAmount(raw.total, base),
      sourceCurrency: src,
    };
  }
  try {
    const rate = await fetchFxRate(src, base);
    return {
      store: raw.store,
      date: raw.date,
      items: raw.items.map((it) => ({
        ...it,
        price: roundAmount(it.price * rate, base),
      })),
      total: roundAmount(raw.total * rate, base),
      sourceCurrency: src,
      fxRate: rate,
    };
  } catch {
    // 환율 조회 실패 — 원본 통화 금액을 그대로 두고 UI에서 수정 유도.
    return {
      store: raw.store,
      date: raw.date,
      items: raw.items,
      total: raw.total,
      sourceCurrency: src,
    };
  }
}

/** KRW·JPY는 정수, USD·EUR·GBP는 소수 2자리까지. UI가 parseInt로 먹으니 일단 반올림. */
function roundAmount(amount: number, ccy: Currency): number {
  if (ccy === "KRW" || ccy === "JPY") return Math.round(amount);
  return Math.round(amount * 100) / 100;
}

/** OCR 이후 cleaned 텍스트에서만 영수증 파싱. 외화면 base currency로 자동 환산. */
export async function parseExpenseFromText(
  cleaned: string,
  anthropicKey: string,
  userHint?: string,
): Promise<ParsedReceipt> {
  const raw = await sonnetParse(cleaned, anthropicKey, userHint);
  return convertReceiptToBase(raw, getBaseCurrency());
}

export interface ParsedFixedExpense {
  name: string;            // "통신비", "넷플릭스" 등
  amount: number;
  categoryId: string;      // 지출 카테고리
  day: number;             // 매월 결제일 (1-28). 불명확하면 1.
  sourceCurrency?: Currency;
  fxRate?: number;
}

const FIXED_EXPENSE_TOOL = {
  name: "parse_fixed_expense",
  description: "매월 반복 지출 (통신비·월세·구독 서비스 등)",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "표시용 이름 (예: 통신비, 넷플릭스, ChatGPT Plus)" },
      amount: { type: "number", description: "매월 청구 금액. 반드시 **원본 통화 그대로** (환산 금지)." },
      currency: {
        type: "string",
        enum: SUPPORTED_CCYS,
        description: "청구 통화. 기호·ISO 코드·언어로 판단. 해외 구독(Netflix US, ChatGPT, AWS, Spotify 등)은 대부분 USD. 한국 통신사·관리비·한국 계좌 결제는 KRW.",
      },
      categoryId: {
        type: "string",
        enum: [
          "food", "cafe", "transport", "housing", "living",
          "shopping", "health", "culture", "education", "event", "etc-expense",
        ],
        description: "통신·관리비·월세=housing 구독(OTT·음악)=culture 헬스장=health 교육 구독=education 클라우드/SaaS=etc-expense",
      },
      day: {
        type: "number",
        description: "매월 결제일 (1-28). 명시되지 않으면 1.",
      },
    },
    required: ["name", "amount", "currency", "categoryId", "day"],
  },
};

/** 고정 지출 파싱 (청구서·자동이체 고지·해외 구독 결제 캡쳐 등). 외화는 base currency로 자동 환산. */
export async function parseFixedExpense(
  cleaned: string,
  anthropicKey: string,
  userHint?: string,
): Promise<ParsedFixedExpense> {
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
        max_tokens: 512,
        tools: [FIXED_EXPENSE_TOOL],
        tool_choice: { type: "tool", name: "parse_fixed_expense" },
        messages: [
          {
            role: "user",
            content: `다음 OCR 텍스트는 매월 반복 지출(통신비·관리비·구독 서비스 등)입니다. 이름·원본 통화 금액·통화·카테고리·결제일을 추출하세요.

통화 판별: $·USD·영문 결제·소수 2자리 → USD / ₩·원·KRW·한국 결제 → KRW / €·EUR → EUR / ¥·JPY → JPY / £·GBP → GBP. amount는 반드시 **원본 통화 그대로** (환산 금지).

결제일은 1-28 사이로 정규화.${hintBlock}

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
  if (!toolUse?.input) throw new Error(msg("파싱 결과를 받지 못했습니다", "No parse result returned"));
  const raw = toolUse.input as { name: string; amount: number; currency?: Currency; categoryId: string; day: number };
  const base = getBaseCurrency();
  const src: Currency = raw.currency && SUPPORTED_CCYS.includes(raw.currency) ? raw.currency : "KRW";
  const day = Math.max(1, Math.min(28, Math.round(raw.day || 1)));

  if (src === base) {
    return {
      name: raw.name,
      amount: roundAmount(raw.amount, base),
      categoryId: raw.categoryId,
      day,
      sourceCurrency: src,
    };
  }
  try {
    const rate = await fetchFxRate(src, base);
    return {
      name: raw.name,
      amount: roundAmount(raw.amount * rate, base),
      categoryId: raw.categoryId,
      day,
      sourceCurrency: src,
      fxRate: rate,
    };
  } catch {
    return {
      name: raw.name,
      amount: raw.amount,
      categoryId: raw.categoryId,
      day,
      sourceCurrency: src,
    };
  }
}
