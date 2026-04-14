import { useMemo, useState } from "react";
import type { Receipt } from "../types";
import {
  byCategory,
  compareMonth,
  dailyTotals,
  filterByMonth,
  monthLabel,
  shiftMonth,
  toMonthKey,
} from "../lib/stats";
import CategoryPie from "../components/CategoryPie";
import HeatCalendar from "../components/HeatCalendar";
import { won } from "../lib/format";
import { clearUsageLog, usageTotals } from "../lib/usage";

type Props = { receipts: Receipt[] };

export default function Stats({ receipts }: Props) {
  const [monthKey, setMonthKey] = useState(toMonthKey(new Date()));
  const [usageTick, setUsageTick] = useState(0);
  const usage = useMemo(() => usageTotals(), [usageTick]);

  const monthly = useMemo(
    () => filterByMonth(receipts, monthKey),
    [receipts, monthKey],
  );
  const slices = useMemo(() => byCategory(monthly), [monthly]);
  const daily = useMemo(() => dailyTotals(receipts, monthKey), [receipts, monthKey]);
  const cmp = useMemo(() => compareMonth(receipts, monthKey), [receipts, monthKey]);

  const deltaUp = cmp.delta > 0;
  const hasCompare = cmp.previous > 0;

  return (
    <div className="screen">
      <header className="stats-head">
        <div className="month-nav">
          <button onClick={() => setMonthKey((k) => shiftMonth(k, -1))}>‹</button>
          <span className="month-label">{monthLabel(monthKey)}</span>
          <button onClick={() => setMonthKey((k) => shiftMonth(k, 1))}>›</button>
        </div>
        <div className="month-total">
          <div className="label">이번달 지출</div>
          <div className="value">{won(cmp.current)}</div>
          {hasCompare && (
            <div className={`delta ${deltaUp ? "up" : "down"}`}>
              지난달보다{" "}
              {deltaUp ? "▲" : "▼"} {won(Math.abs(cmp.delta))}
              <span className="muted small">
                {" "}
                ({(Math.abs(cmp.ratio) * 100).toFixed(0)}%)
              </span>
            </div>
          )}
        </div>
      </header>

      <section className="stats-section">
        <h3>카테고리</h3>
        <div className="capture-card">
          <CategoryPie slices={slices} />
        </div>
      </section>

      <section className="stats-section">
        <h3>일별 지출</h3>
        <div className="capture-card">
          <HeatCalendar monthKey={monthKey} totalsByDay={daily} />
        </div>
      </section>

      {monthly.length === 0 && (
        <div className="empty" style={{ margin: "0 16px" }}>
          <p>이번달 기록이 아직 없어요.</p>
        </div>
      )}

      <section className="stats-section">
        <h3>AI 호출 비용 (누적)</h3>
        <div className="capture-card">
          <div className="row">
            <span className="muted small">호출 {usage.calls}회</span>
            <span className="total">{Math.round(usage.krw).toLocaleString()}원</span>
          </div>
          <div className="row">
            <span className="muted small">
              in {usage.input.toLocaleString()} / out{" "}
              {usage.output.toLocaleString()} tokens
            </span>
            <button
              className="link"
              onClick={() => {
                clearUsageLog();
                setUsageTick((t) => t + 1);
              }}
            >
              초기화
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
