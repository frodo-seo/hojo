import { useEffect, useMemo, useState } from "react";
import type { Transaction, Budget } from "../types";
import { getTransactionsByMonth, getBudget, applyFixedIncomes, applyFixedExpenses } from "../lib/db";
import { formatMoney, currentMonth } from "../lib/format";
import { getCategoryById } from "../lib/categories";
import BudgetBar from "../components/BudgetBar";
import TransactionItem from "../components/TransactionItem";
import MonthPicker from "../components/MonthPicker";

type Props = {
  refresh: number;
  onEditTx: (tx: Transaction) => void;
};

export default function Home({ refresh, onEditTx }: Props) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budget, setBudget] = useState<Budget | undefined>();
  const [month, setMonth] = useState(currentMonth());

  useEffect(() => {
    async function load() {
      const incomeApplied = await applyFixedIncomes(month);
      const expenseApplied = await applyFixedExpenses(month);
      const txs = await getTransactionsByMonth(month);
      setTransactions(txs);
      setBudget(await getBudget(month));
      if (incomeApplied || expenseApplied) window.dispatchEvent(new Event("fixed-applied"));
    }
    load();
  }, [month, refresh]);

  const { income, expense } = useMemo(() => {
    let inc = 0,
      exp = 0;
    for (const t of transactions) {
      if (t.type === "income") inc += t.amount;
      else exp += t.amount;
    }
    return { income: inc, expense: exp };
  }, [transactions]);

  const recent = transactions.slice(0, 10);
  const topCategories = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of transactions) {
      if (t.type !== "expense") continue;
      map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amount);
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id, amount]) => ({ cat: getCategoryById(id), amount }));
  }, [transactions]);

  return (
    <div className="screen">
      <header className="home-header">
        <MonthPicker month={month} onChange={setMonth} />
      </header>

      <div className="summary-cards">
        <div className="summary-card income">
          <span className="summary-label">수입</span>
          <span className="summary-value">+{formatMoney(income)}</span>
        </div>
        <div className="summary-card expense">
          <span className="summary-label">지출</span>
          <span className="summary-value">-{formatMoney(expense)}</span>
        </div>
      </div>

      {budget && <BudgetBar budget={budget.amount} spent={expense} />}

      {topCategories.length > 0 && (
        <section className="home-section">
          <h2 className="section-title">이달 주요 지출</h2>
          <div className="top-cats">
            {topCategories.map(({ cat, amount }) => (
              <div key={cat?.id} className="top-cat">
                <span className="top-cat-icon">{cat?.icon}</span>
                <span className="top-cat-name">{cat?.name}</span>
                <span className="top-cat-amount">{formatMoney(amount)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="home-section">
        <h2 className="section-title">최근 장부</h2>
        {recent.length === 0 ? (
          <div className="empty">
            <p>장부가 아직 비어 있사옵니다</p>
            <p className="empty-sub">아래 + 표식으로 첫 기록을 올려보시옵소서</p>
          </div>
        ) : (
          <div className="tx-list">
            {recent.map((t) => (
              <TransactionItem key={t.id} tx={t} onClick={() => onEditTx(t)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
