import { getApiKeys } from "./apiKeys";
import { httpJson, httpMultipart } from "./http";
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

function cleanOcr(md: string): string {
  return md
    .replace(/!\[.*?\]\(.*?\)/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*{1,3}(.*?)\*{1,3}/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\\([*_~`])/g, "$1")
    .replace(/\|[-:]+\|[-:|\s]*/g, "")
    .replace(/\|/g, " ")
    .replace(/^[-*_]{3,}$/gm, "")
    .replace(/[ \t]+/g, " ")
    .split("\n").map((l) => l.trim()).filter(Boolean).join("\n")
    .trim();
}

async function datalabOcr(base64: string, mediaType: string, datalabKey: string): Promise<string> {
  const ext = mediaType === "image/png" ? "png" : "jpg";
  const initRes = await httpMultipart<{
    request_check_url?: string;
    status?: string;
    markdown?: string;
  }>(
    "https://www.datalab.to/api/v1/convert",
    {
      file: { base64, mediaType, filename: `receipt.${ext}` },
      output_format: "markdown",
      mode: "accurate",
    },
    { "X-API-Key": datalabKey },
  );
  if (!initRes.ok) {
    throw new Error(msg(`OCR 요청 실패 (${initRes.status})`, `OCR request failed (${initRes.status})`));
  }

  let data = initRes.data;
  if (data.request_check_url && data.status !== "complete") {
    for (let i = 0; i < 50; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const poll = await httpJson<{ status?: string; markdown?: string }>(
        data.request_check_url,
        { method: "GET", headers: { "X-API-Key": datalabKey } },
      );
      if (!poll.ok) throw new Error(msg(`OCR 조회 실패 (${poll.status})`, `OCR poll failed (${poll.status})`));
      if (poll.data.status === "complete") {
        data = poll.data;
        break;
      }
      if (poll.data.status === "failed") {
        throw new Error(msg("OCR 처리에 실패했습니다", "OCR processing failed"));
      }
    }
  }

  const raw = data.markdown || "";
  if (!raw) throw new Error(msg(
    "글자를 읽지 못했습니다. 더 밝고 또렷한 사진으로 다시 시도해주세요.",
    "Couldn't read any text. Try a brighter, sharper photo.",
  ));
  return raw;
}

async function sonnetParse(cleaned: string, anthropicKey: string): Promise<ParsedReceipt & { is_receipt: boolean }> {
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
            content: `먼저 텍스트가 지출 증빙(영수증/카드결제/배달앱/송금 캡쳐 등)인지 판단. 아니면 is_receipt=false, items=[], total=0. 맞으면 is_receipt=true로 품목명·가격·카테고리 추출(품목 1개여도 추출). 카테고리 불확실하면 null. 카테고리: food=식비 cafe=카페 transport=교통 housing=주거 living=생활 shopping=쇼핑 health=의료 culture=문화 education=교육 event=경조사 etc-expense=기타\n\n${cleaned}`,
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

/** 영수증 이미지 → 파싱 결과. BYOK: Datalab + Anthropic 직접 호출. */
export async function scanReceipt(
  base64: string,
  mediaType: string,
): Promise<ParsedReceipt> {
  const { anthropic, datalab } = await getApiKeys();
  if (!anthropic && !datalab) throw new ApiKeyMissingError("both");
  if (!datalab) throw new ApiKeyMissingError("datalab");
  if (!anthropic) throw new ApiKeyMissingError("anthropic");

  const rawOcr = await datalabOcr(base64, mediaType, datalab);
  const cleaned = cleanOcr(rawOcr);
  const parsed = await sonnetParse(cleaned, anthropic);

  if (parsed.is_receipt === false) {
    throw new Error(msg(
      "영수증이나 결제 내역이 아닌 것 같습니다. 지출 증빙 사진을 올려주세요.",
      "This doesn't look like a receipt or payment record. Please upload an expense proof.",
    ));
  }
  return {
    store: parsed.store,
    date: parsed.date,
    items: parsed.items,
    total: parsed.total,
  };
}
