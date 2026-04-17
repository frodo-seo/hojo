import type { Transaction } from "../types";
import { getCategoryById } from "./categories";

/** 카테고리별 합계 */
export interface CategoryStat {
  categoryId: string;
  name: string;
  icon: string;
  total: number;
  count: number;
  percent: number;
}

/** 월간 통계 (JS 로컬 계산, LLM 호출 0) */
export interface MonthStats {
  month: string;
  totalExpense: number;
  totalIncome: number;
  expenseCount: number;
  incomeCount: number;
  avgExpense: number;
  categories: CategoryStat[];
  topCategory: CategoryStat | null;
  dailyAvg: number;
  daysWithSpending: number;
}

/** 비교 통계 */
export interface CompareStats {
  current: MonthStats;
  previous: MonthStats | null;
  expenseDiff: number | null; // 전월 대비 % 변화
  topChange: string | null; // "식비 +23%" 같은 요약
}

/** 월간 거래에서 통계 계산 (순수 JS) */
export function calcMonthStats(
  transactions: Transaction[],
  month: string,
): MonthStats {
  const expenses = transactions.filter((t) => t.type === "expense");
  const incomes = transactions.filter((t) => t.type === "income");

  const totalExpense = expenses.reduce((s, t) => s + t.amount, 0);
  const totalIncome = incomes.reduce((s, t) => s + t.amount, 0);

  // 카테고리별 집계
  const catMap = new Map<string, { total: number; count: number }>();
  for (const t of expenses) {
    const prev = catMap.get(t.categoryId) || { total: 0, count: 0 };
    catMap.set(t.categoryId, {
      total: prev.total + t.amount,
      count: prev.count + 1,
    });
  }

  const categories: CategoryStat[] = [...catMap.entries()]
    .map(([id, { total, count }]) => {
      const cat = getCategoryById(id);
      return {
        categoryId: id,
        name: cat?.name ?? id,
        icon: cat?.icon ?? "📦",
        total,
        count,
        percent: totalExpense > 0 ? Math.round((total / totalExpense) * 100) : 0,
      };
    })
    .sort((a, b) => b.total - a.total);

  // 지출이 있는 날 수
  const spendDays = new Set(expenses.map((t) => t.date)).size;

  // 해당 월의 일 수 계산
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();

  return {
    month,
    totalExpense,
    totalIncome,
    expenseCount: expenses.length,
    incomeCount: incomes.length,
    avgExpense: expenses.length > 0 ? Math.round(totalExpense / expenses.length) : 0,
    categories,
    topCategory: categories[0] ?? null,
    dailyAvg: Math.round(totalExpense / daysInMonth),
    daysWithSpending: spendDays,
  };
}

/** 두 달 비교 (순수 JS) */
export function compareMonths(
  current: MonthStats,
  previous: MonthStats | null,
): CompareStats {
  if (!previous || previous.totalExpense === 0) {
    return { current, previous, expenseDiff: null, topChange: null };
  }

  const expenseDiff = Math.round(
    ((current.totalExpense - previous.totalExpense) / previous.totalExpense) * 100,
  );

  // 카테고리 중 가장 변화가 큰 것
  let topChange: string | null = null;
  let maxDiff = 0;
  for (const cat of current.categories) {
    const prev = previous.categories.find((c) => c.categoryId === cat.categoryId);
    const prevTotal = prev?.total ?? 0;
    if (prevTotal > 0) {
      const diff = Math.round(((cat.total - prevTotal) / prevTotal) * 100);
      if (Math.abs(diff) > Math.abs(maxDiff)) {
        maxDiff = diff;
        topChange = `${cat.name} ${diff > 0 ? "+" : ""}${diff}%`;
      }
    }
  }

  return { current, previous, expenseDiff, topChange };
}

/** 통계를 사람이 읽을 수 있는 텍스트로 */
function statsToText(stats: MonthStats): string {
  const lines: string[] = [];
  const [, m] = stats.month.split("-");
  lines.push(`${parseInt(m)}월 지출 ${stats.totalExpense.toLocaleString()}원 (${stats.expenseCount}건)`);
  if (stats.totalIncome > 0) {
    lines.push(`수입 ${stats.totalIncome.toLocaleString()}원`);
  }
  lines.push(`일평균 ${stats.dailyAvg.toLocaleString()}원`);

  if (stats.categories.length > 0) {
    lines.push("카테고리:");
    for (const c of stats.categories.slice(0, 5)) {
      lines.push(`  ${c.name} ${c.total.toLocaleString()}원 (${c.percent}%, ${c.count}건)`);
    }
  }

  return lines.join("\n");
}

/** 비교 결과를 텍스트로 */
export function compareToText(cmp: CompareStats): string {
  let text = statsToText(cmp.current);
  if (cmp.expenseDiff !== null) {
    text += `\n전월 대비 ${cmp.expenseDiff > 0 ? "+" : ""}${cmp.expenseDiff}%`;
    if (cmp.topChange) text += ` (${cmp.topChange})`;
  }
  return text;
}
