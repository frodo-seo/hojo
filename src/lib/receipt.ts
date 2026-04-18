import { apiUrl } from "./apiBase";

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

/** API 호출: 영수증 이미지 → 파싱 결과 (NDJSON 스트림) */
export async function scanReceipt(
  base64: string,
  mediaType: string,
): Promise<ParsedReceipt> {
  const res = await fetch(apiUrl("/api/receipt"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: base64, mediaType }),
  });

  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API error: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: true });

    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      const msg = JSON.parse(line) as
        | { type: "ping" }
        | { type: "done"; result: ParsedReceipt }
        | { type: "error"; error: string };
      if (msg.type === "done") return msg.result;
      if (msg.type === "error") throw new Error(msg.error);
    }

    if (done) break;
  }

  throw new Error("Stream ended without result");
}
