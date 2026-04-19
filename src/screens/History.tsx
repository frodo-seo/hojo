import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Transaction } from "../types";
import { getTransactionsByMonth } from "../lib/db";
import { currentMonth, formatDate, formatMoney } from "../lib/format";
import { EXPENSE_CATEGORIES, categoryName } from "../lib/categories";
import MonthPicker from "../components/MonthPicker";
import TransactionItem from "../components/TransactionItem";

type Props = {
  refresh: number;
  onEditTx: (tx: Transaction) => void;
};

type DayGroup = {
  date: string;
  transactions: Transaction[];
  income: number;
  expense: number;
};

export default function History({ refresh, onEditTx }: Props) {
  const { t } = useTranslation();
  const [month, setMonth] = useState(currentMonth());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [keyword, setKeyword] = useState("");
  const [filterCat, setFilterCat] = useState<string | null>(null);

  useEffect(() => {
    getTransactionsByMonth(month).then(setTransactions);
  }, [month, refresh]);

  const filtered = useMemo(() => {
    let list = transactions;
    if (keyword.trim()) {
      const q = keyword.trim().toLowerCase();
      list = list.filter((t) => t.memo?.toLowerCase().includes(q));
    }
    if (filterCat) {
      list = list.filter((t) => t.categoryId === filterCat);
    }
    return list;
  }, [transactions, keyword, filterCat]);

  const groups = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of filtered) {
      const list = map.get(t.date) ?? [];
      list.push(t);
      map.set(t.date, list);
    }
    const result: DayGroup[] = [];
    for (const [date, txs] of map) {
      let income = 0,
        expense = 0;
      for (const t of txs) {
        if (t.type === "income") income += t.amount;
        else expense += t.amount;
      }
      result.push({ date, transactions: txs, income, expense });
    }
    return result.sort((a, b) => (b.date > a.date ? 1 : -1));
  }, [filtered]);

  const monthTotal = useMemo(() => {
    let income = 0,
      expense = 0;
    for (const t of filtered) {
      if (t.type === "income") income += t.amount;
      else expense += t.amount;
    }
    return { income, expense };
  }, [filtered]);

  return (
    <div className="screen">
      <header className="history-header">
        <MonthPicker month={month} onChange={setMonth} />
        <div className="history-summary">
          <span className="hs-income">+{formatMoney(monthTotal.income)}</span>
          <span className="hs-expense">-{formatMoney(monthTotal.expense)}</span>
        </div>
      </header>

      <div className="search-bar">
        <svg className="search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          className="search-input"
          placeholder={t("history.searchPlaceholder")}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        {keyword && (
          <button className="search-clear" onClick={() => setKeyword("")}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      <div className="filter-chips">
        <button
          className={`filter-chip ${filterCat === null ? "on" : ""}`}
          onClick={() => setFilterCat(null)}
        >
          {t("history.filterAll")}
        </button>
        {EXPENSE_CATEGORIES.map((c) => (
          <button
            key={c.id}
            className={`filter-chip ${filterCat === c.id ? "on" : ""}`}
            onClick={() => setFilterCat(filterCat === c.id ? null : c.id)}
          >
            <c.Icon size={14} strokeWidth={1.75} /> {categoryName(c.id)}
          </button>
        ))}
      </div>

      {groups.length === 0 ? (
        <div className="empty">
          <p>{keyword || filterCat ? t("history.noResults") : t("history.noRecords")}</p>
        </div>
      ) : (
        <div className="history-groups">
          {groups.map((g) => (
            <div key={g.date} className="day-group">
              <div className="day-header">
                <span className="day-date">{formatDate(g.date)}</span>
                <span className="day-summary">
                  {g.income > 0 && (
                    <span className="income">+{formatMoney(g.income)}</span>
                  )}
                  {g.expense > 0 && (
                    <span className="expense">-{formatMoney(g.expense)}</span>
                  )}
                </span>
              </div>
              <div className="tx-list">
                {g.transactions.map((t) => (
                  <TransactionItem
                    key={t.id}
                    tx={t}
                    onClick={() => onEditTx(t)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
