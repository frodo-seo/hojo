import { useTranslation } from "react-i18next";
import { formatMoney } from "../lib/format";

type Props = {
  budget: number;
  spent: number;
};

export default function BudgetBar({ budget, spent }: Props) {
  const { t } = useTranslation();
  if (budget <= 0) return null;
  const ratio = Math.min(spent / budget, 1);
  const remain = budget - spent;
  const over = remain < 0;

  return (
    <div className="budget-bar">
      <div className="budget-header">
        <span className="budget-title">{t("budget.thisMonth")}</span>
        <span className={`budget-remain ${over ? "over" : ""}`}>
          {over
            ? t("budget.over", { amount: formatMoney(-remain) })
            : t("budget.remaining", { amount: formatMoney(remain) })}
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
