import type { Category } from "../types";

export const EXPENSE_CATEGORIES: Category[] = [
  { id: "food", name: "식비", icon: "🍚", type: "expense" },
  { id: "cafe", name: "카페/간식", icon: "☕", type: "expense" },
  { id: "transport", name: "교통", icon: "🚌", type: "expense" },
  { id: "housing", name: "주거/통신", icon: "🏠", type: "expense" },
  { id: "living", name: "생활", icon: "🧴", type: "expense" },
  { id: "shopping", name: "쇼핑", icon: "🛍️", type: "expense" },
  { id: "health", name: "의료/건강", icon: "💊", type: "expense" },
  { id: "culture", name: "문화/여가", icon: "🎬", type: "expense" },
  { id: "education", name: "교육", icon: "📚", type: "expense" },
  { id: "event", name: "경조사", icon: "🎁", type: "expense" },
  { id: "etc-expense", name: "기타", icon: "📦", type: "expense" },
];

export const INCOME_CATEGORIES: Category[] = [
  { id: "salary", name: "급여", icon: "💰", type: "income" },
  { id: "side", name: "부수입", icon: "💵", type: "income" },
  { id: "allowance", name: "용돈", icon: "🎀", type: "income" },
  { id: "etc-income", name: "기타", icon: "📥", type: "income" },
];

export const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

export function getCategoryById(id: string): Category | undefined {
  return ALL_CATEGORIES.find((c) => c.id === id);
}

export const CATEGORY_COLORS: Record<string, string> = {
  food: "#B5473B",
  cafe: "#8B6D5C",
  transport: "#4A6B7A",
  housing: "#6B6344",
  living: "#2D6B4F",
  shopping: "#9C5B4A",
  health: "#3D7A8A",
  culture: "#7A6B3D",
  education: "#5C5B7A",
  event: "#B5473B",
  "etc-expense": "#8C8377",
  salary: "#2D6B4F",
  side: "#4A6B7A",
  allowance: "#7A6B3D",
  "etc-income": "#5C5B7A",
};
