import { createClient } from "@supabase/supabase-js";
import type { ToolDef, ToolExecutor } from "./claude";

const CATEGORIES = [
  "식비",
  "카페",
  "주류",
  "생활",
  "교통",
  "쇼핑",
  "문화",
  "기타",
] as const;
const MODES = ["daily", "memory", "settle"] as const;

type ReceiptRow = {
  id: string;
  store: string;
  date: string;
  total: number;
  items: Array<{
    name: string;
    price: number;
    category?: { major?: string; minor?: string };
  }>;
  mode: "daily" | "memory" | "settle";
};

function scopedClient(accessToken: string) {
  const url =
    process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  const anon =
    process.env.VITE_SUPABASE_ANON_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    "";
  if (!url || !anon) throw new Error("Supabase env missing");
  return createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(last).padStart(2, "0")}`,
  };
}

export function makeCoachTools(accessToken: string): {
  tools: ToolDef[];
  executors: Record<string, ToolExecutor>;
} {
  const sb = scopedClient(accessToken);

  const tools: ToolDef[] = [
    {
      name: "queryReceipts",
      description:
        "영수증을 기간/카테고리/모드로 조회해 총액·건수·상위 영수증을 반환합니다. " +
        "'이번달 술 얼마?', '지난주 카페 몇 번?', '정산한 적 있어?' 같은 질문에 사용하세요. " +
        "category 필터는 영수증 품목(items) 단위로 합산합니다.",
      input_schema: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: [...CATEGORIES],
            description: "품목 카테고리 (선택)",
          },
          dateFrom: {
            type: "string",
            description: "YYYY-MM-DD, 포함",
          },
          dateTo: {
            type: "string",
            description: "YYYY-MM-DD, 포함",
          },
          mode: {
            type: "string",
            enum: [...MODES],
            description: "모드 필터 (선택)",
          },
        },
      },
    },
    {
      name: "getMonthSummary",
      description:
        "특정 월의 총 지출과 카테고리별 분포를 반환합니다. 월 단위 요약에 사용하세요.",
      input_schema: {
        type: "object",
        properties: {
          month: { type: "string", description: "YYYY-MM 형식" },
        },
        required: ["month"],
      },
    },
    {
      name: "compareMonths",
      description: "두 월의 총 지출을 비교해 차이·증감률을 반환합니다.",
      input_schema: {
        type: "object",
        properties: {
          monthA: { type: "string", description: "기준 월 YYYY-MM" },
          monthB: { type: "string", description: "비교 월 YYYY-MM" },
        },
        required: ["monthA", "monthB"],
      },
    },
  ];

  const executors: Record<string, ToolExecutor> = {
    queryReceipts: async (input) => {
      const category = input.category as string | undefined;
      const mode = input.mode as string | undefined;
      const dateFrom = input.dateFrom as string | undefined;
      const dateTo = input.dateTo as string | undefined;

      let q = sb
        .from("receipts")
        .select("id, store, date, total, items, mode");
      if (dateFrom) q = q.gte("date", dateFrom);
      if (dateTo) q = q.lte("date", dateTo);
      if (mode) q = q.eq("mode", mode);

      const { data, error } = await q;
      if (error) throw error;

      const rows = (data ?? []) as ReceiptRow[];
      let total = 0;
      let count = 0;
      const matched: Array<{
        store: string;
        date: string;
        total: number;
        mode: string;
      }> = [];

      for (const r of rows) {
        if (category) {
          let itemTotal = 0;
          for (const it of r.items ?? []) {
            if (it.category?.major === category) itemTotal += it.price;
          }
          if (itemTotal > 0) {
            total += itemTotal;
            count += 1;
            matched.push({
              store: r.store,
              date: r.date,
              total: itemTotal,
              mode: r.mode,
            });
          }
        } else {
          total += r.total;
          count += 1;
          matched.push({
            store: r.store,
            date: r.date,
            total: r.total,
            mode: r.mode,
          });
        }
      }

      return {
        total,
        count,
        topReceipts: matched
          .sort((a, b) => b.total - a.total)
          .slice(0, 5),
      };
    },

    getMonthSummary: async (input) => {
      const month = String(input.month);
      const { from, to } = monthRange(month);
      const { data, error } = await sb
        .from("receipts")
        .select("total, items, mode")
        .gte("date", from)
        .lte("date", to);
      if (error) throw error;

      const rows = (data ?? []) as Pick<ReceiptRow, "total" | "items" | "mode">[];
      const byCategory: Record<string, number> = {};
      const byMode: Record<string, number> = {};
      let total = 0;
      for (const r of rows) {
        total += r.total ?? 0;
        byMode[r.mode] = (byMode[r.mode] ?? 0) + (r.total ?? 0);
        for (const it of r.items ?? []) {
          const cat = it.category?.major ?? "기타";
          byCategory[cat] = (byCategory[cat] ?? 0) + it.price;
        }
      }
      return {
        month,
        total,
        count: rows.length,
        byCategory: Object.entries(byCategory)
          .sort((a, b) => b[1] - a[1])
          .map(([name, amount]) => ({ name, amount })),
        byMode,
      };
    },

    compareMonths: async (input) => {
      const totalOf = async (month: string) => {
        const { from, to } = monthRange(month);
        const { data } = await sb
          .from("receipts")
          .select("total")
          .gte("date", from)
          .lte("date", to);
        return ((data ?? []) as Array<{ total: number }>).reduce(
          (a, b) => a + (b.total ?? 0),
          0,
        );
      };
      const monthA = String(input.monthA);
      const monthB = String(input.monthB);
      const totalA = await totalOf(monthA);
      const totalB = await totalOf(monthB);
      const delta = totalA - totalB;
      const ratio = totalB > 0 ? delta / totalB : 0;
      return {
        monthA: { month: monthA, total: totalA },
        monthB: { month: monthB, total: totalB },
        delta,
        ratio,
      };
    },
  };

  return { tools, executors };
}
