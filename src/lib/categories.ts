import {
  Utensils,
  Coffee,
  Car,
  Home,
  Package,
  ShoppingBag,
  Stethoscope,
  Film,
  GraduationCap,
  Gift,
  Circle,
  Wallet,
  TrendingUp,
  PiggyBank,
} from "lucide-react";
import type { Category } from "../types";
import i18n from "./i18n";

export function categoryName(id: string): string {
  const key = `categories.${id}`;
  const translated = i18n.t(key);
  if (translated !== key) return translated;
  return getCategoryById(id)?.name ?? id;
}

export const EXPENSE_CATEGORIES: Category[] = [
  { id: "food", name: "식비", Icon: Utensils, type: "expense" },
  { id: "cafe", name: "카페/간식", Icon: Coffee, type: "expense" },
  { id: "transport", name: "교통", Icon: Car, type: "expense" },
  { id: "housing", name: "주거/통신", Icon: Home, type: "expense" },
  { id: "living", name: "생활", Icon: Package, type: "expense" },
  { id: "shopping", name: "쇼핑", Icon: ShoppingBag, type: "expense" },
  { id: "health", name: "의료/건강", Icon: Stethoscope, type: "expense" },
  { id: "culture", name: "문화/여가", Icon: Film, type: "expense" },
  { id: "education", name: "교육", Icon: GraduationCap, type: "expense" },
  { id: "event", name: "경조사", Icon: Gift, type: "expense" },
  { id: "etc-expense", name: "기타", Icon: Circle, type: "expense" },
];

export const INCOME_CATEGORIES: Category[] = [
  { id: "salary", name: "급여", Icon: Wallet, type: "income" },
  { id: "side", name: "부수입", Icon: TrendingUp, type: "income" },
  { id: "allowance", name: "용돈", Icon: PiggyBank, type: "income" },
  { id: "etc-income", name: "기타", Icon: Circle, type: "income" },
];

const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

export function getCategoryById(id: string): Category | undefined {
  return ALL_CATEGORIES.find((c) => c.id === id);
}
