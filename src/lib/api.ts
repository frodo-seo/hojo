import type { Mode, ReceiptItem } from "../types";
import { logUsage, type ClaudeUsage } from "./usage";

export type OcrResponse = {
  store: string;
  date: string;
  items: ReceiptItem[];
  total: number;
  _usage?: ClaudeUsage;
};

export type CountPeopleResponse = {
  count: number;
  confidence: "low" | "medium" | "high";
  _usage?: ClaudeUsage;
};

type WithUsage = { _usage?: ClaudeUsage };

async function post<T extends WithUsage>(
  path: string,
  label: string,
  body: unknown,
): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${path} ${res.status}: ${text}`);
  }
  const data = (await res.json()) as T;
  if (data._usage) logUsage(label, data._usage);
  return data;
}

export const api = {
  ocr: (imageBase64: string, mediaType?: string) =>
    post<OcrResponse>("/api/ocr", "ocr", { imageBase64, mediaType }),
  countPeople: (imageBase64: string, mediaType?: string) =>
    post<CountPeopleResponse>("/api/count-people", "count-people", {
      imageBase64,
      mediaType,
    }),
  analyze: (input: {
    mode: Mode;
    store: string;
    date: string;
    total: number;
    items: ReceiptItem[];
    partySize?: number;
  }) => post<WithUsage>("/api/analyze", `analyze.${input.mode}`, input),
};
