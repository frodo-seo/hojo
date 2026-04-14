import type { Receipt } from "../types";

export type MonthKey = string;

export const toMonthKey = (d: Date | string): MonthKey => {
  const x = typeof d === "string" ? new Date(d) : d;
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`;
};

export const monthLabel = (key: MonthKey): string => {
  const [y, m] = key.split("-");
  return `${y}.${m}`;
};

export const shiftMonth = (key: MonthKey, delta: number): MonthKey => {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return toMonthKey(d);
};

export function filterByMonth(receipts: Receipt[], key: MonthKey): Receipt[] {
  return receipts.filter((r) => toMonthKey(r.date) === key);
}

export type CategorySlice = {
  name: string;
  amount: number;
  ratio: number;
  color: string;
};

const CATEGORY_COLORS: Record<string, string> = {
  식비: "#ff7a1a",
  카페: "#c78a3a",
  생활: "#6bb38a",
  교통: "#5a9bd4",
  쇼핑: "#b86ab8",
  문화: "#d4b35a",
  주류: "#a63a3a",
};
const FALLBACK = ["#8a8a8a", "#aa7a5a", "#6a8a9a", "#9a7a8a", "#7a9a6a"];

export function byCategory(receipts: Receipt[]): CategorySlice[] {
  const bucket = new Map<string, number>();
  for (const r of receipts) {
    for (const it of r.items) {
      const major = it.category?.major || "기타";
      bucket.set(major, (bucket.get(major) ?? 0) + it.price);
    }
  }
  const total = Array.from(bucket.values()).reduce((a, b) => a + b, 0) || 1;
  let fallbackIdx = 0;
  return Array.from(bucket.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, amount]) => ({
      name,
      amount,
      ratio: amount / total,
      color:
        CATEGORY_COLORS[name] ??
        FALLBACK[fallbackIdx++ % FALLBACK.length],
    }));
}

export function dailyTotals(
  receipts: Receipt[],
  key: MonthKey,
): Map<number, number> {
  const map = new Map<number, number>();
  for (const r of filterByMonth(receipts, key)) {
    const day = new Date(r.date).getDate();
    map.set(day, (map.get(day) ?? 0) + r.total);
  }
  return map;
}

export const totalOf = (receipts: Receipt[]): number =>
  receipts.reduce((a, b) => a + b.total, 0);

export type MonthCompare = {
  current: number;
  previous: number;
  delta: number;
  ratio: number;
};

export function compareMonth(
  receipts: Receipt[],
  key: MonthKey,
): MonthCompare {
  const current = totalOf(filterByMonth(receipts, key));
  const previous = totalOf(filterByMonth(receipts, shiftMonth(key, -1)));
  const delta = current - previous;
  const ratio = previous > 0 ? delta / previous : 0;
  return { current, previous, delta, ratio };
}

export type DayGroup = { date: string; label: string; receipts: Receipt[] };

export function groupByDay(receipts: Receipt[]): DayGroup[] {
  const map = new Map<string, Receipt[]>();
  for (const r of [...receipts].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  )) {
    const d = new Date(r.date);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  const labels = ["일", "월", "화", "수", "목", "금", "토"];
  return Array.from(map.entries()).map(([k, rs]) => {
    const d = new Date(rs[0].date);
    return {
      date: k,
      label: `${d.getMonth() + 1}월 ${d.getDate()}일 (${labels[d.getDay()]})`,
      receipts: rs,
    };
  });
}
