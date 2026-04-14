import type { MonthKey } from "../lib/stats";

type Props = {
  monthKey: MonthKey;
  totalsByDay: Map<number, number>;
};

const DOW = ["일", "월", "화", "수", "목", "금", "토"];

export default function HeatCalendar({ monthKey, totalsByDay }: Props) {
  const [y, m] = monthKey.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const daysInMonth = new Date(y, m, 0).getDate();
  const startDow = first.getDay();

  const max = Math.max(0, ...Array.from(totalsByDay.values()));

  const cells: Array<{ day: number | null; amount: number; intensity: number }> = [];
  for (let i = 0; i < startDow; i++) cells.push({ day: null, amount: 0, intensity: 0 });
  for (let d = 1; d <= daysInMonth; d++) {
    const amount = totalsByDay.get(d) ?? 0;
    cells.push({ day: d, amount, intensity: max > 0 ? amount / max : 0 });
  }
  while (cells.length % 7 !== 0) cells.push({ day: null, amount: 0, intensity: 0 });

  return (
    <div className="heatcal">
      <div className="heatcal-row heatcal-dow">
        {DOW.map((d, i) => (
          <div
            key={d}
            className="heatcal-dow-cell"
            style={{ color: i === 0 ? "#c0392b" : i === 6 ? "#2b72c0" : undefined }}
          >
            {d}
          </div>
        ))}
      </div>
      <div className="heatcal-grid">
        {cells.map((c, i) => {
          if (c.day === null) return <div key={i} className="heatcal-cell empty" />;
          const alpha = c.intensity === 0 ? 0 : 0.15 + c.intensity * 0.75;
          return (
            <div
              key={i}
              className="heatcal-cell"
              style={{
                background:
                  alpha > 0 ? `rgba(255,122,26,${alpha})` : "transparent",
              }}
              title={c.amount > 0 ? `${c.amount.toLocaleString()}원` : ""}
            >
              <span className="heatcal-day">{c.day}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
