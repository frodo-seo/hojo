import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Transaction, Budget, Asset } from "../types";
import { getTransactionsByMonth, getBudget, applyFixedIncomes, applyFixedExpenses, getAssets } from "../lib/db";
import { valuePortfolio, valuationsInBase, valuePortfolioFromCacheSync, valuationsInBaseFromCacheSync, type BaseValued } from "../lib/prices";
import { useBaseCurrency } from "../lib/settings";
import { formatMoney, formatCurrency, formatPercent, currentMonth } from "../lib/format";
import { getLastBriefing, shouldGenerateBriefing, generateDailyBriefing, type DailyBriefing } from "../lib/dailyBriefing";
import { getCategoryById, categoryName } from "../lib/categories";
import BudgetBar from "../components/BudgetBar";
import TransactionItem from "../components/TransactionItem";
import MonthPicker from "../components/MonthPicker";

type Props = {
  refresh: number;
  onEditTx: (tx: Transaction) => void;
  onOpenAssets: () => void;
};

export default function Home({ refresh, onEditTx, onOpenAssets }: Props) {
  const { t } = useTranslation();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budget, setBudget] = useState<Budget | undefined>();
  const [month, setMonth] = useState(currentMonth());
  const [assets, setAssets] = useState<Asset[]>([]);
  const [based, setBased] = useState<BaseValued[]>([]);
  const [briefing, setBriefing] = useState<DailyBriefing | null>(() => getLastBriefing());
  const [briefingLoading, setBriefingLoading] = useState(false);
  const baseCcy = useBaseCurrency();

  useEffect(() => {
    if (!shouldGenerateBriefing()) return;
    let cancelled = false;
    setBriefingLoading(true);
    generateDailyBriefing()
      .then((b) => { if (!cancelled && b) setBriefing(b); })
      .catch((err) => console.warn("[hojo] briefing failed", err))
      .finally(() => { if (!cancelled) setBriefingLoading(false); });
    return () => { cancelled = true; };
  }, []);

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await getAssets();
      if (cancelled) return;
      setAssets(list);
      if (list.length === 0) {
        setBased([]);
        return;
      }
      const cachedVs = valuePortfolioFromCacheSync(list);
      setBased(valuationsInBaseFromCacheSync(cachedVs, baseCcy));
      const vs = await valuePortfolio(list);
      if (cancelled) return;
      const fresh = await valuationsInBase(vs, baseCcy);
      if (cancelled) return;
      setBased(fresh);
    })();
    return () => { cancelled = true; };
  }, [refresh, baseCcy]);

  const assetSummary = useMemo(() => {
    if (based.length === 0) return null;
    let cost = 0;
    let value = 0;
    let anyValue = false;
    for (const b of based) {
      if (b.costBase !== null) cost += b.costBase;
      if (b.valueBase !== null) {
        value += b.valueBase;
        anyValue = true;
      }
    }
    if (!anyValue) return null;
    return { cost, value };
  }, [based]);

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
          <span className="summary-label">{t("home.income")}</span>
          <span className="summary-value">+{formatMoney(income)}</span>
        </div>
        <div className="summary-card expense">
          <span className="summary-label">{t("home.expense")}</span>
          <span className="summary-value">-{formatMoney(expense)}</span>
        </div>
      </div>

      {budget && <BudgetBar budget={budget.amount} spent={expense} />}

      {(briefing || briefingLoading) && (
        <section className="briefing-card">
          <div className="briefing-head">
            <span className="briefing-label">{t("briefing.title")}</span>
          </div>
          {briefingLoading && !briefing ? (
            <p className="briefing-text briefing-loading">{t("briefing.loading")}</p>
          ) : briefing ? (
            <p className="briefing-text">{briefing.text}</p>
          ) : null}
        </section>
      )}

      <button className="asset-home-card" onClick={onOpenAssets}>
        <div className="asset-home-head">
          <span className="asset-home-title">{t("assets.homeCardTitle")}</span>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="asset-home-arrow">
            <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        {assets.length === 0 || !assetSummary ? (
          <p className="asset-home-empty">{t("assets.homeCardEmpty")}</p>
        ) : (
          (() => {
            const gain = assetSummary.value - assetSummary.cost;
            const pct = assetSummary.cost > 0 ? gain / assetSummary.cost : 0;
            const gainClass = gain >= 0 ? "positive" : "negative";
            return (
              <div className="asset-home-list">
                <div className="asset-home-row">
                  <span className="asset-home-ccy">{baseCcy}</span>
                  <span className="asset-home-value">{formatCurrency(assetSummary.value, baseCcy)}</span>
                  <span className={`asset-home-gain ${gainClass}`}>
                    {formatPercent(pct)}
                  </span>
                </div>
              </div>
            );
          })()
        )}
      </button>

      {topCategories.length > 0 && (
        <section className="home-section">
          <h2 className="section-title">{t("home.topSpending")}</h2>
          <div className="top-cats">
            {topCategories.map(({ cat, amount }) => (
              <div key={cat?.id} className="top-cat">
                <span className="top-cat-icon">{cat ? <cat.Icon size={18} strokeWidth={1.75} /> : null}</span>
                <span className="top-cat-name">{cat ? categoryName(cat.id) : ""}</span>
                <span className="top-cat-amount">{formatMoney(amount)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="home-section">
        <h2 className="section-title">{t("home.recent")}</h2>
        {recent.length === 0 ? (
          <div className="empty">
            <p>{t("home.emptyTitle")}</p>
            <p className="empty-sub">{t("home.emptySub")}</p>
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
