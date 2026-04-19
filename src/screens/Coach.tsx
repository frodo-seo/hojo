import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { getTransactionsByMonth, getAssets } from "../lib/db";
import { calcMonthStats, compareMonths, compareToText } from "../lib/stats";
import { valuePortfolio, portfolioToText } from "../lib/prices";
import { getReport, saveReport, getYearlyReport, saveYearlyReport } from "../lib/wiki";
import { currentMonth, prevMonth, formatMoney } from "../lib/format";
import { shareMemorial } from "../lib/shareCard";
import { generateMemorial } from "../lib/coach";
import { ApiKeyMissingError } from "../lib/receipt";
import { useApiKeysStatus } from "../lib/apiKeys";

type Props = { refresh: number; onGoSettings: () => void };
type ReportState = "loading" | "empty" | "ready" | "generating" | "error";

export default function Coach({ refresh, onGoSettings }: Props) {
  const { t } = useTranslation();
  const keys = useApiKeysStatus();
  const canGenerate = keys.anthropic;
  const [stats, setStats] = useState<ReturnType<typeof formatStats> | null>(null);
  const [reportState, setReportState] = useState<ReportState>("loading");
  const [reportText, setReportText] = useState("");
  const [reportDate, setReportDate] = useState("");
  const [error, setError] = useState("");

  // 연간 리포트 (12월만)
  const [yearlyState, setYearlyState] = useState<ReportState>("loading");
  const [yearlyText, setYearlyText] = useState("");
  const [yearlyDate, setYearlyDate] = useState("");
  const [yearlyError, setYearlyError] = useState("");

  const month = currentMonth();
  const isDecember = month.endsWith("-12");
  const year = month.split("-")[0];

  function monthlyTitle() {
    const [y, m] = month.split("-");
    return t("coach.monthlyReportTitle", { year: y, month: parseInt(m) });
  }

  async function handleShareMonthly() {
    await shareMemorial({
      title: monthlyTitle(),
      body: reportText,
      filename: `Hojo_${month}.png`,
    });
  }

  async function handleShareYearly() {
    await shareMemorial({
      title: t("coach.yearlyReportTitle", { year }),
      body: yearlyText,
      filename: `Hojo_${year}_yearly.png`,
    });
  }

  useEffect(() => {
    (async () => {
      const txs = await getTransactionsByMonth(month);
      const cur = calcMonthStats(txs, month);
      const prevTxs = await getTransactionsByMonth(prevMonth(month));
      const prev = calcMonthStats(prevTxs, prevMonth(month));
      const cmp = compareMonths(cur, prev);
      setStats(formatStats(cur, cmp));

      const saved = await getReport(month);
      if (saved) {
        setReportText(saved.content);
        setReportDate(fmtDate(saved.updatedAt));
        setReportState("ready");
      } else {
        setReportState("empty");
      }

      if (isDecember) {
        const yearly = await getYearlyReport(year);
        if (yearly) {
          setYearlyText(yearly.content);
          setYearlyDate(fmtDate(yearly.updatedAt));
          setYearlyState("ready");
        } else {
          setYearlyState("empty");
        }
      }
    })();
  }, [refresh, month, isDecember, year]);

  async function handleGenerate() {
    if (!stats) return;
    setReportState("generating");
    setError("");

    try {
      const txs = await getTransactionsByMonth(month);
      const cur = calcMonthStats(txs, month);
      const prevTxs = await getTransactionsByMonth(prevMonth(month));
      const prev = calcMonthStats(prevTxs, prevMonth(month));
      const cmp = compareMonths(cur, prev);
      const spendingText = compareToText(cmp);
      const assets = await getAssets();
      const assetText = assets.length > 0
        ? portfolioToText(await valuePortfolio(assets))
        : "";
      const context = assetText ? `${spendingText}\n\n${assetText}` : spendingText;

      const insight = await generateMemorial(context, "monthly");

      await saveReport(month, insight);
      setReportText(insight);
      setReportDate(fmtDate(new Date().toISOString()));
      setReportState("ready");
    } catch (err) {
      if (err instanceof ApiKeyMissingError) {
        setError(t("apiKeys.needAnthropic"));
      } else {
        setError(err instanceof Error ? err.message : t("common.error"));
      }
      setReportState("error");
    }
  }

  async function handleGenerateYearly() {
    setYearlyState("generating");
    setYearlyError("");

    try {
      // 12개월 전체 통계 수집
      const monthlyStats: string[] = [];
      for (let m = 1; m <= 12; m++) {
        const mo = `${year}-${String(m).padStart(2, "0")}`;
        const txs = await getTransactionsByMonth(mo);
        if (txs.length === 0) continue;
        const s = calcMonthStats(txs, mo);
        const prevMo = prevMonth(mo);
        const prevTxs = await getTransactionsByMonth(prevMo);
        const prev = calcMonthStats(prevTxs, prevMo);
        const cmp = compareMonths(s, prev);
        monthlyStats.push(compareToText(cmp));
      }

      if (monthlyStats.length === 0) {
        setYearlyError(t("coach.noYearData"));
        setYearlyState("error");
        return;
      }

      const assets = await getAssets();
      const assetText = assets.length > 0
        ? "\n---\n" + portfolioToText(await valuePortfolio(assets))
        : "";
      const insight = await generateMemorial(
        monthlyStats.join("\n---\n") + assetText,
        "yearly",
        year,
      );

      await saveYearlyReport(year, insight);
      setYearlyText(insight);
      setYearlyDate(fmtDate(new Date().toISOString()));
      setYearlyState("ready");
    } catch (err) {
      if (err instanceof ApiKeyMissingError) {
        setYearlyError(t("apiKeys.needAnthropic"));
      } else {
        setYearlyError(err instanceof Error ? err.message : t("common.error"));
      }
      setYearlyState("error");
    }
  }

  return (
    <div className="screen coach-screen">
      <header className="coach-header">
        <h1>{t("coach.title")}</h1>
        <span className="coach-header-sub">{t("coach.subtitle")}</span>
      </header>

      {keys.loaded && !canGenerate && (
        <div className="keys-missing-card">
          <div className="keys-missing-title">{t("apiKeys.missingTitle")}</div>
          <div className="keys-missing-body">
            {t("apiKeys.coachMissingBody")}
          </div>
          <button className="keys-missing-btn" onClick={onGoSettings}>
            {t("apiKeys.goSettings")}
          </button>
        </div>
      )}

      {/* 즉시 통계 (JS 로컬 계산) */}
      {stats && (
        <div className="coach-stats">
          <div className="coach-stat-row">
            <div className="coach-stat-card">
              <span className="coach-stat-label">{t("coach.thisMonthExpense")}</span>
              <span className="coach-stat-value expense">{stats.totalExpense}</span>
            </div>
            <div className="coach-stat-card">
              <span className="coach-stat-label">{t("coach.dailyAvg")}</span>
              <span className="coach-stat-value">{stats.dailyAvg}</span>
            </div>
          </div>
          <div className="coach-stat-row">
            <div className="coach-stat-card">
              <span className="coach-stat-label">{t("coach.topCategory")}</span>
              <span className="coach-stat-value">{stats.topCategory}</span>
            </div>
            <div className="coach-stat-card">
              <span className="coach-stat-label">{t("coach.prevCompare")}</span>
              <span className="coach-stat-value">{stats.compare}</span>
            </div>
          </div>

          {stats.categories.length > 0 && (
            <div className="coach-cat-bars">
              {stats.categories.map((c) => (
                <div key={c.name} className="coach-cat-bar">
                  <div className="coach-cat-bar-label">
                    <span>{c.name}</span>
                    <span className="coach-cat-bar-val">{c.total}</span>
                  </div>
                  <div className="coach-cat-bar-track">
                    <div className="coach-cat-bar-fill" style={{ width: `${c.percent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="coach-stat-badge">{t("coach.summary")}</div>
        </div>
      )}

      {/* AI 월간 리포트 */}
      <div className="coach-report-section">
        <div className="coach-report-header">
          <h2>{t("coach.monthlyTitle")}</h2>
          {reportDate && <span className="coach-report-date">{reportDate}</span>}
        </div>

        {reportState === "loading" && (
          <div className="coach-report-body">
            <div className="coach-typing"><span /><span /><span /></div>
          </div>
        )}

        {reportState === "ready" && (
          <>
            <div className="coach-report-body">
              <p className="coach-report-text">{reportText}</p>
            </div>
            <div className="coach-report-actions">
              <button className="coach-share-btn" onClick={handleShareMonthly}>
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                  <path d="M7.5 1v9M4 4.5L7.5 1 11 4.5M2.5 10v3h10v-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                {t("common.share")}
              </button>
              <button className="coach-refresh-btn" onClick={handleGenerate}>
                {t("common.regenerate")}
              </button>
            </div>
          </>
        )}

        {reportState === "empty" && (
          <>
            <div className="coach-report-body coach-sample-body">
              <p className="coach-report-text">{t("coach.emptyMonthlyBody")}</p>
              <div className="coach-sample-badge">{t("coach.sampleBadge")}</div>
            </div>
            {stats && stats.categories.length > 0 && (
              <div className="coach-report-actions">
                <button className="coach-generate-btn" onClick={handleGenerate} disabled={!canGenerate}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M8 2L2 5v4l6 3.5L14 9V5L8 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                    <circle cx="8" cy="7" r="1.5" stroke="currentColor" strokeWidth="1.3" />
                  </svg>
                  {t("coach.generate")}
                </button>
              </div>
            )}
          </>
        )}

        {reportState === "generating" && (
          <div className="coach-report-body">
            <div className="coach-generating">
              <div className="coach-typing"><span /><span /><span /></div>
              <span>{t("coach.generatingMonthly")}</span>
            </div>
          </div>
        )}

        {reportState === "error" && (
          <div className="coach-report-body coach-report-empty">
            <p>{error}</p>
            <button className="coach-generate-btn" onClick={handleGenerate}>{t("common.retry")}</button>
          </div>
        )}
      </div>

      {/* 연간 종합 리포트 (12월만) */}
      {isDecember && (
        <div className="coach-report-section">
          <div className="coach-report-header">
            <h2>{t("coach.yearlyHeader", { year })}</h2>
            {yearlyDate && <span className="coach-report-date">{yearlyDate}</span>}
          </div>

          {yearlyState === "loading" && (
            <div className="coach-report-body">
              <div className="coach-typing"><span /><span /><span /></div>
            </div>
          )}

          {yearlyState === "ready" && (
            <>
              <div className="coach-report-body">
                <p className="coach-report-text">{yearlyText}</p>
              </div>
              <div className="coach-report-actions">
                <button className="coach-share-btn" onClick={handleShareYearly}>
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                    <path d="M7.5 1v9M4 4.5L7.5 1 11 4.5M2.5 10v3h10v-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {t("common.share")}
                </button>
                <button className="coach-refresh-btn" onClick={handleGenerateYearly}>
                  {t("common.regenerate")}
                </button>
              </div>
            </>
          )}

          {yearlyState === "empty" && (
            <div className="coach-report-body coach-report-empty">
              <p>{t("coach.emptyYearlyBody", { year })}</p>
              <button className="coach-generate-btn" onClick={handleGenerateYearly} disabled={!canGenerate}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 2L2 5v4l6 3.5L14 9V5L8 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                  <circle cx="8" cy="7" r="1.5" stroke="currentColor" strokeWidth="1.3" />
                </svg>
                {t("coach.generateYearly")}
              </button>
            </div>
          )}

          {yearlyState === "generating" && (
            <div className="coach-report-body">
              <div className="coach-generating">
                <div className="coach-typing"><span /><span /><span /></div>
                <span>{t("coach.generatingYearly")}</span>
              </div>
            </div>
          )}

          {yearlyState === "error" && (
            <div className="coach-report-body coach-report-empty">
              <p>{yearlyError}</p>
              <button className="coach-generate-btn" onClick={handleGenerateYearly}>{t("common.retry")}</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── helpers ──

import i18n from "../lib/i18n";
import { categoryName } from "../lib/categories";

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatStats(
  cur: ReturnType<typeof calcMonthStats>,
  cmp: ReturnType<typeof compareMonths>,
) {
  return {
    totalExpense: formatMoney(cur.totalExpense),
    dailyAvg: formatMoney(cur.dailyAvg),
    topCategory: cur.topCategory
      ? `${categoryName(cur.topCategory.categoryId)} ${formatMoney(cur.topCategory.total)}`
      : i18n.t("coach.noTopCategory"),
    compare: cmp.expenseDiff !== null
      ? `${cmp.expenseDiff > 0 ? "+" : ""}${cmp.expenseDiff}%`
      : i18n.t("coach.noPrevData"),
    categories: cur.categories.map((c) => ({
      name: categoryName(c.categoryId),
      total: formatMoney(c.total),
      percent: c.percent,
    })),
  };
}
