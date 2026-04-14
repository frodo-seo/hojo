import type { Mode, PhotoKind, Receipt, ReceiptItem } from "../types";
import { api, type OcrResponse } from "./api";
import { guessCategory } from "./categories";

type FilePart = { base64: string; mediaType: string; dataUrl: string };

export async function fileToParts(file: File): Promise<FilePart> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
  const [header, body] = dataUrl.split(",");
  const match = /data:([^;]+);base64/.exec(header);
  return {
    base64: body,
    mediaType: match?.[1] ?? file.type ?? "image/jpeg",
    dataUrl,
  };
}

type AnalyzeMemory = {
  story?: string;
  tags?: string[];
  mood?: string;
};

type AnalyzeSettle = {
  equal_split?: number;
  smart_split?: { suggestion?: string; note?: string };
  story?: string;
  tags?: string[];
};

export type ReceiptDraft = {
  store: string;
  date: string;
  total: number;
  items: ReceiptItem[];
  photoDataUrl?: string;
  photoMediaType?: string;
  photoKind: PhotoKind;
  mode: Mode;
  partySize?: number;
};

export async function runOcr(receiptFile: File): Promise<ReceiptDraft> {
  const parts = await fileToParts(receiptFile);
  const ocr: OcrResponse = await api.ocr(parts.base64, parts.mediaType);

  const items: ReceiptItem[] = ocr.items.map((it) => ({
    name: it.name,
    price: it.price,
    category: it.category ?? { major: guessCategory(it.name), minor: "" },
  }));

  return {
    store: ocr.store,
    date: ocr.date,
    total: ocr.total,
    items,
    photoKind: "none",
    mode: "daily",
  };
}

export async function countPeopleInPhoto(photoFile: File): Promise<number> {
  const parts = await fileToParts(photoFile);
  const res = await api.countPeople(parts.base64, parts.mediaType);
  return Math.max(1, res.count);
}

export async function finalizeReceipt(draft: ReceiptDraft): Promise<Receipt> {
  const base: Receipt = {
    id: crypto.randomUUID(),
    store: draft.store,
    date: draft.date,
    total: draft.total,
    items: draft.items,
    photoDataUrl: draft.photoDataUrl,
    photoKind: draft.photoKind,
    mode: draft.mode,
    createdAt: new Date().toISOString(),
  };

  if (draft.mode === "daily") {
    return base;
  }

  const analyzed = (await api.analyze({
    mode: draft.mode,
    store: draft.store,
    date: draft.date,
    total: draft.total,
    items: draft.items,
    partySize: draft.partySize,
  })) as AnalyzeMemory & AnalyzeSettle;

  if (draft.mode === "memory") {
    return { ...base, story: analyzed.story, tags: analyzed.tags };
  }

  const resolvedPartySize = draft.partySize ?? 2;
  const perPerson =
    analyzed.equal_split ?? Math.round(draft.total / resolvedPartySize);
  return {
    ...base,
    story: analyzed.story,
    tags: analyzed.tags,
    partySize: resolvedPartySize,
    perPerson,
  };
}
