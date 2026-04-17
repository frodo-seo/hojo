export type TransactionType = "income" | "expense";

export interface Category {
  id: string;
  name: string;
  icon: string;
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
