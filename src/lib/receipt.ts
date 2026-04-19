import { httpJson } from "./http";
import { currentLang } from "./i18n";

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
}

export class ApiKeyMissingError extends Error {
  which: "anthropic" | "datalab" | "both";
  constructor(which: "anthropic" | "datalab" | "both") {
    super("API key missing");
    this.name = "ApiKeyMissingError";
    this.which = which;
  }
}

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
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            price: { type: "number" },
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
      total: { type: "number" },
    },
    required: ["is_receipt", "items", "total"],
  },
};

async function haikuParse(cleaned: string, anthropicKey: string, userHint?: string): Promise<ParsedReceipt & { is_receipt: boolean }> {
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
        max_tokens: 1024,
        tools: [TOOL],
        tool_choice: { type: "tool", name: "parse_receipt" },
        messages: [
          {
            role: "user",
            content: `먼저 텍스트가 지출 증빙(영수증/카드결제/배달앱/송금 캡쳐 등)인지 판단. 아니면 is_receipt=false, items=[], total=0. 맞으면 is_receipt=true로 품목명·가격·카테고리 추출(품목 1개여도 추출). 카테고리 불확실하면 null. 카테고리: food=식비 cafe=카페 transport=교통 housing=주거 living=생활 shopping=쇼핑 health=의료 culture=문화 education=교육 event=경조사 etc-expense=기타${hintBlock}\n\nOCR 텍스트:\n${cleaned}`,
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
  return toolUse.input as ParsedReceipt & { is_receipt: boolean };
}

/** OCR 이후 cleaned 텍스트에서만 영수증 파싱. 분류 Agent 경유 플로우용. */
export async function parseExpenseFromText(
  cleaned: string,
  anthropicKey: string,
  userHint?: string,
): Promise<ParsedReceipt> {
  const parsed = await haikuParse(cleaned, anthropicKey, userHint);
  return {
    store: parsed.store,
    date: parsed.date,
    items: parsed.items,
    total: parsed.total,
  };
}

export interface ParsedFixedExpense {
  name: string;            // "통신비", "넷플릭스" 등
  amount: number;
  categoryId: string;      // 지출 카테고리
  day: number;             // 매월 결제일 (1-28). 불명확하면 1.
}

const FIXED_EXPENSE_TOOL = {
  name: "parse_fixed_expense",
  description: "매월 반복 지출 (통신비·월세·구독 서비스 등)",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "표시용 이름 (예: 통신비, 넷플릭스)" },
      amount: { type: "number" },
      categoryId: {
        type: "string",
        enum: [
          "food", "cafe", "transport", "housing", "living",
          "shopping", "health", "culture", "education", "event", "etc-expense",
        ],
        description: "통신·관리비·월세=housing 구독(OTT)=culture 헬스장=health 등",
      },
      day: {
        type: "number",
        description: "매월 결제일 (1-28). 명시되지 않으면 1.",
      },
    },
    required: ["name", "amount", "categoryId", "day"],
  },
};

/** 고정 지출 파싱 (청구서·자동이체 고지 등) */
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
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        tools: [FIXED_EXPENSE_TOOL],
        tool_choice: { type: "tool", name: "parse_fixed_expense" },
        messages: [
          {
            role: "user",
            content: `다음 OCR 텍스트는 매월 반복 지출 고지서 또는 구독 결제입니다. 이름·금액·카테고리·매월 결제일을 추출하세요. 결제일은 1-28 사이로 정규화.${hintBlock}\n\nOCR 텍스트:\n${cleaned}`,
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
  const out = toolUse.input as ParsedFixedExpense;
  out.day = Math.max(1, Math.min(28, Math.round(out.day || 1)));
  return out;
}
