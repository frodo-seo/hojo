import { useState, useEffect, useRef } from "react";
import { getTransactionsByMonth } from "../lib/db";
import { calcMonthStats, compareMonths, compareToText } from "../lib/stats";
import { getReport, saveReport, getYearlyReport, saveYearlyReport } from "../lib/wiki";
import { currentMonth, prevMonth } from "../lib/format";
import { shareMemorial } from "../lib/shareCard";

type Props = { refresh: number };
type ReportState = "loading" | "empty" | "ready" | "generating" | "error";

export default function Coach({ refresh }: Props) {
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

  const autoGenRef = useRef(false);

  function monthlyTitle() {
    const [y, m] = month.split("-");
    return `${y}년 ${parseInt(m)}월의 상소`;
  }

  async function handleShareMonthly() {
    await shareMemorial({
      title: monthlyTitle(),
      body: reportText,
      filename: `호조상소_${month}.png`,
    });
  }

  async function handleShareYearly() {
    await shareMemorial({
      title: `${year}년 연말 상소`,
      body: yearlyText,
      filename: `호조상소_${year}_연말.png`,
    });
  }

  useEffect(() => { loadData(); }, [refresh]);

  async function loadData() {
    // 로컬 통계 (즉시)
    const txs = await getTransactionsByMonth(month);
    const cur = calcMonthStats(txs, month);
    const prevTxs = await getTransactionsByMonth(prevMonth(month));
    const prev = calcMonthStats(prevTxs, prevMonth(month));
    const cmp = compareMonths(cur, prev);
    setStats(formatStats(cur, cmp));

    // 저장된 월간 리포트 확인
    const saved = await getReport(month);
    if (saved) {
      setReportText(saved.content);
      setReportDate(fmtDate(saved.updatedAt));
      setReportState("ready");
    } else if (txs.length > 0 && !autoGenRef.current) {
      // 내역이 있는데 리포트가 없으면 자동 생성
      autoGenRef.current = true;
      setReportState("generating");
      autoGenerateMonthly(cur, prev);
    } else {
      setReportState("empty");
    }

    // 12월이면 연간 리포트 확인
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
  }

  async function autoGenerateMonthly(
    cur: ReturnType<typeof calcMonthStats>,
    prev: ReturnType<typeof calcMonthStats>,
  ) {
    setError("");
    try {
      const cmp = compareMonths(cur, prev);
      const context = compareToText(cmp);

      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stats: context, type: "monthly" }),
      });

      if (!res.ok) throw new Error("AI 분석 실패");

      const data = await res.json();
      const insight: string = data.insight;

      await saveReport(month, insight);
      setReportText(insight);
      setReportDate(fmtDate(new Date().toISOString()));
      setReportState("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류 발생");
      setReportState("error");
    }
  }

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
      const context = compareToText(cmp);

      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stats: context, type: "monthly" }),
      });

      if (!res.ok) throw new Error("AI 분석 실패");

      const data = await res.json();
      const insight: string = data.insight;

      await saveReport(month, insight);
      setReportText(insight);
      setReportDate(fmtDate(new Date().toISOString()));
      setReportState("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류 발생");
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
        setYearlyError("올해 내역이 없어요.");
        setYearlyState("error");
        return;
      }

      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stats: monthlyStats.join("\n---\n"),
          type: "yearly",
          year,
        }),
      });

      if (!res.ok) throw new Error("AI 분석 실패");

      const data = await res.json();
      const insight: string = data.insight;

      await saveYearlyReport(year, insight);
      setYearlyText(insight);
      setYearlyDate(fmtDate(new Date().toISOString()));
      setYearlyState("ready");
    } catch (err) {
      setYearlyError(err instanceof Error ? err.message : "오류 발생");
      setYearlyState("error");
    }
  }

  return (
    <div className="screen coach-screen">
      <header className="coach-header">
        <h1>호조 판서의 상소</h1>
        <span className="coach-header-sub">전하의 가계를 살피어 아뢰옵나이다 (AI 분석)</span>
      </header>

      {/* 즉시 통계 (JS 로컬 계산) */}
      {stats && (
        <div className="coach-stats">
          <div className="coach-stat-row">
            <div className="coach-stat-card">
              <span className="coach-stat-label">이달 지출</span>
              <span className="coach-stat-value expense">{stats.totalExpense}</span>
            </div>
            <div className="coach-stat-card">
              <span className="coach-stat-label">일평균</span>
              <span className="coach-stat-value">{stats.dailyAvg}</span>
            </div>
          </div>
          <div className="coach-stat-row">
            <div className="coach-stat-card">
              <span className="coach-stat-label">으뜸 항목</span>
              <span className="coach-stat-value">{stats.topCategory}</span>
            </div>
            <div className="coach-stat-card">
              <span className="coach-stat-label">전월 대비</span>
              <span className="coach-stat-value">{stats.compare}</span>
            </div>
          </div>

          {stats.categories.length > 0 && (
            <div className="coach-cat-bars">
              {stats.categories.map((c) => (
                <div key={c.name} className="coach-cat-bar">
                  <div className="coach-cat-bar-label">
                    <span>{c.icon} {c.name}</span>
                    <span className="coach-cat-bar-val">{c.total}</span>
                  </div>
                  <div className="coach-cat-bar-track">
                    <div className="coach-cat-bar-fill" style={{ width: `${c.percent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="coach-stat-badge">장부 요약</div>
        </div>
      )}

      {/* AI 월간 리포트 */}
      <div className="coach-report-section">
        <div className="coach-report-header">
          <h2>이달의 상소문 (AI 분석)</h2>
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
                상소 공유
              </button>
              <button className="coach-refresh-btn" onClick={handleGenerate}>
                다시 올리기
              </button>
            </div>
          </>
        )}

        {reportState === "empty" && (
          <>
            <div className="coach-report-body coach-sample-body">
              <p className="coach-report-text">{SAMPLE_MEMORIAL}</p>
              <div className="coach-sample-badge">예시 상소 · 장부가 채워지면 실제 상소가 올라오옵니다</div>
            </div>
          </>
        )}

        {reportState === "generating" && (
          <div className="coach-report-body">
            <div className="coach-generating">
              <div className="coach-typing"><span /><span /><span /></div>
              <span>판서께서 장부를 살피시는 중...</span>
            </div>
          </div>
        )}

        {reportState === "error" && (
          <div className="coach-report-body coach-report-empty">
            <p>{error}</p>
            <button className="coach-generate-btn" onClick={handleGenerate}>다시 아뢰기</button>
          </div>
        )}
      </div>

      {/* 연간 종합 리포트 (12월만) */}
      {isDecember && (
        <div className="coach-report-section">
          <div className="coach-report-header">
            <h2>{year}년 연말 상소 (AI 분석)</h2>
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
                  상소 공유
                </button>
                <button className="coach-refresh-btn" onClick={handleGenerateYearly}>
                  다시 올리기
                </button>
              </div>
            </>
          )}

          {yearlyState === "empty" && (
            <div className="coach-report-body coach-report-empty">
              <p>{year}년 한 해의 장부를 총람하여 연말 상소를 올리시옵소서.</p>
              <button className="coach-generate-btn" onClick={handleGenerateYearly}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 2L2 5v4l6 3.5L14 9V5L8 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                  <circle cx="8" cy="7" r="1.5" stroke="currentColor" strokeWidth="1.3" />
                </svg>
                연말 상소 올리기
              </button>
            </div>
          )}

          {yearlyState === "generating" && (
            <div className="coach-report-body">
              <div className="coach-generating">
                <div className="coach-typing"><span /><span /><span /></div>
                <span>판서께서 한 해 장부를 총람하시는 중...</span>
              </div>
            </div>
          )}

          {yearlyState === "error" && (
            <div className="coach-report-body coach-report-empty">
              <p>{yearlyError}</p>
              <button className="coach-generate-btn" onClick={handleGenerateYearly}>다시 아뢰기</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── helpers ──

const SAMPLE_MEMORIAL = `전하, 이달의 가계를 살피어 아뢰옵나이다.

아직 장부에 기록이 없사오니 호조가 따로 올릴 말이 없사옵나이다. 다만 전하께서 식사 한 끼, 벗과의 찻값 한 잔이라도 장부에 올려주시면, 소신이 그 쓰임을 헤아려 치하할 바와 경계할 바를 아뢰옵겠나이다.

매달의 흐름을 살피고, 절용의 방책을 간언함이 호조의 본분이옵니다. 부디 오늘부터 장부를 펼치시옵소서.

소신, 삼가 올리옵나이다.`;

function fmt(n: number) { return n.toLocaleString("ko-KR") + "원"; }

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatStats(
  cur: ReturnType<typeof calcMonthStats>,
  cmp: ReturnType<typeof compareMonths>,
) {
  return {
    totalExpense: fmt(cur.totalExpense),
    dailyAvg: fmt(cur.dailyAvg),
    topCategory: cur.topCategory
      ? `${cur.topCategory.icon} ${cur.topCategory.name} ${fmt(cur.topCategory.total)}`
      : "없음",
    compare: cmp.expenseDiff !== null
      ? `${cmp.expenseDiff > 0 ? "+" : ""}${cmp.expenseDiff}%`
      : "전월 데이터 없음",
    categories: cur.categories.map((c) => ({
      name: c.name,
      icon: c.icon,
      total: fmt(c.total),
      percent: c.percent,
    })),
  };
}
