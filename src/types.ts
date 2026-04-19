import type { LucideIcon } from "lucide-react";

export type TransactionType = "income" | "expense";

export interface Category {
  id: string;
  name: string;
  Icon: LucideIcon;
  type: TransactionType;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  categoryId: string;
  memo: string;
  date: string; // YYYY-MM-DD
  createdAt: string; // ISO string
}

export interface Budget {
  month: string; // YYYY-MM
  amount: number;
}

export interface FixedIncome {
  id: string;
  name: string; // "급여", "저금" 등
  amount: number;
  categoryId: string; // "salary", "side", etc
}

export interface FixedExpense {
  id: string;
  name: string; // "통신비", "월세" 등
  amount: number;
  categoryId: string; // expense category
  day: number; // 매월 지정일 (1-28)
}

export type AssetKind = "stock" | "crypto" | "commodity";
export type Currency = "USD" | "KRW" | "EUR" | "JPY" | "GBP";

export interface Asset {
  id: string;
  kind: AssetKind;
  ticker: string;       // "AAPL", "BTC", "GC=F"
  name: string;         // display name
  quantity: number;
  avgCost: number;      // per-unit cost in `currency`
  currency: Currency;
  externalId?: string;  // provider-specific id (e.g. CoinGecko coin id)
  exchange?: string;    // e.g. "NASDAQ", "KRX"
  note?: string;
  createdAt: string;
}
