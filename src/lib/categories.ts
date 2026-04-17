import type { Category } from "../types";

export const EXPENSE_CATEGORIES: Category[] = [
  { id: "food", name: "식비", icon: "食", type: "expense" },
  { id: "cafe", name: "카페/간식", icon: "茶", type: "expense" },
  { id: "transport", name: "교통", icon: "車", type: "expense" },
  { id: "housing", name: "주거/통신", icon: "家", type: "expense" },
  { id: "living", name: "생활", icon: "具", type: "expense" },
  { id: "shopping", name: "쇼핑", icon: "衣", type: "expense" },
  { id: "health", name: "의료/건강", icon: "藥", type: "expense" },
  { id: "culture", name: "문화/여가", icon: "樂", type: "expense" },
  { id: "education", name: "교육", icon: "學", type: "expense" },
  { id: "event", name: "경조사", icon: "禮", type: "expense" },
  { id: "etc-expense", name: "기타", icon: "雜", type: "expense" },
];

export const INCOME_CATEGORIES: Category[] = [
  { id: "salary", name: "급여", icon: "祿", type: "income" },
  { id: "side", name: "부수입", icon: "副", type: "income" },
  { id: "allowance", name: "용돈", icon: "錢", type: "income" },
  { id: "etc-income", name: "기타", icon: "雜", type: "income" },
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
