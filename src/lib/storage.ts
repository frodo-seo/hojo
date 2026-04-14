import type { Receipt } from "../types";

const KEY = "sobi-ilgi:receipts";

export function loadReceipts(): Receipt[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Receipt[];
  } catch {
    return [];
  }
}

export function saveReceipt(r: Receipt) {
  const all = loadReceipts();
  all.unshift(r);
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function clearReceipts() {
  localStorage.removeItem(KEY);
}
