import { useMemo } from "react";
import type { Receipt } from "../types";
import { groupByDay } from "../lib/stats";
import { won } from "../lib/format";

type Props = {
  receipts: Receipt[];
  onOpen: (id: string) => void;
};

const modeMeta: Record<Receipt["mode"], { emoji: string; label: string }> = {
  daily: { emoji: "🧾", label: "일상" },
  memory: { emoji: "📸", label: "추억" },
  settle: { emoji: "🤝", label: "정산" },
};

export default function Timeline({ receipts, onOpen }: Props) {
  const groups = useMemo(() => groupByDay(receipts), [receipts]);

  return (
    <div className="screen">
      <header className="screen-head">
        <div style={{ width: 32 }} />
        <h2>타임라인</h2>
        <div style={{ width: 32 }} />
      </header>

      {groups.length === 0 ? (
        <div className="empty" style={{ margin: 16 }}>
          <p>아직 기록이 없어요.</p>
          <p className="muted">영수증을 찍으면 여기 쌓여요.</p>
        </div>
      ) : (
        <div className="timeline-body">
          {groups.map((g) => {
            const dayTotal = g.receipts.reduce((a, r) => a + r.total, 0);
            return (
              <section key={g.date} className="timeline-group">
                <div className="timeline-day">
                  <span>{g.label}</span>
                  <span className="muted small">{won(dayTotal)}</span>
                </div>
                <ul className="receipt-list">
                  {g.receipts.map((r) => {
                    const m = modeMeta[r.mode];
                    return (
                      <li key={r.id}>
                        <button
                          className="receipt-card"
                          onClick={() => onOpen(r.id)}
                        >
                          <div className="row">
                            <span className="mode-tag">
                              {m.emoji} {m.label}
                            </span>
                            <span className="total">{won(r.total)}</span>
                          </div>
                          <div className="store">{r.store}</div>
                          {r.story && <div className="story">{r.story}</div>}
                          {r.photoDataUrl && (
                            <img
                              src={r.photoDataUrl}
                              alt=""
                              className="timeline-thumb"
                            />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
