import { formatMoney } from "../lib/format";

type Props = {
  budget: number;
  spent: number;
};

export default function BudgetBar({ budget, spent }: Props) {
  if (budget <= 0) return null;
  const ratio = Math.min(spent / budget, 1);
  const remain = budget - spent;
  const over = remain < 0;

  return (
    <div className="budget-bar">
      <div className="budget-header">
        <span className="budget-title">이번 달 예산</span>
        <span className={`budget-remain ${over ? "over" : ""}`}>
          {over ? `${formatMoney(-remain)} 초과` : `${formatMoney(remain)} 남음`}
        </span>
      </div>
      <div className="budget-track">
        <div
          className={`budget-fill ${over ? "over" : ""}`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
      <div className="budget-footer">
        <span>{formatMoney(spent)}</span>
        <span>{formatMoney(budget)}</span>
      </div>
    </div>
  );
}
