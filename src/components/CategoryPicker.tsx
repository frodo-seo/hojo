import type { TransactionType } from "../types";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, categoryName } from "../lib/categories";

type Props = {
  type: TransactionType;
  selected: string;
  onSelect: (id: string) => void;
};

export default function CategoryPicker({ type, selected, onSelect }: Props) {
  const categories =
    type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;

  return (
    <div className="cat-picker">
      {categories.map((c) => (
        <button
          key={c.id}
          className={`cat-btn ${selected === c.id ? "on" : ""}`}
          onClick={() => onSelect(c.id)}
        >
          <span className="cat-icon"><c.Icon size={20} strokeWidth={1.75} /></span>
          <span className="cat-name">{categoryName(c.id)}</span>
        </button>
      ))}
    </div>
  );
}
