import type { Transaction } from "../types";
import { getCategoryById } from "../lib/categories";
import { formatMoney } from "../lib/format";

type Props = {
  tx: Transaction;
  onClick?: () => void;
};

export default function TransactionItem({ tx, onClick }: Props) {
  const cat = getCategoryById(tx.categoryId);
  const isIncome = tx.type === "income";

  return (
    <div className="tx-item" onClick={onClick}>
      <div className="tx-icon">{cat?.icon ?? "?"}</div>
      <div className="tx-info">
        <div className="tx-cat">{cat?.name ?? tx.categoryId}</div>
        {tx.memo && <div className="tx-memo">{tx.memo}</div>}
      </div>
      <div className={`tx-amount ${isIncome ? "income" : "expense"}`}>
        {isIncome ? "+" : "-"}
        {formatMoney(tx.amount)}
      </div>
    </div>
  );
}
