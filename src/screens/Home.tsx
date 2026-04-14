import { useState, type FormEvent } from "react";
import type { Receipt } from "../types";
import { relativeDate, won } from "../lib/format";
import { compareMonth, toMonthKey } from "../lib/stats";
import { askCoach } from "../lib/coach";
import { signOut } from "../lib/auth";

type Props = {
  receipts: Receipt[];
  onOpen: (id: string) => void;
};

const SAMPLE_QUESTIONS = [
  "이번달 술에 얼마 썼어?",
  "저번달보다 카페 지출 줄었어?",
  "이번달 제일 많이 쓴 가게는?",
];

const modeLabel: Record<Receipt["mode"], { text: string; emoji: string }> = {
  daily: { text: "일상", emoji: "🧾" },
  memory: { text: "추억", emoji: "📸" },
  settle: { text: "정산", emoji: "🤝" },
};

export default function Home({ receipts, onOpen }: Props) {
  const cmp = compareMonth(receipts, toMonthKey(new Date()));
  const recent = receipts.slice(0, 5);

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [coachError, setCoachError] = useState<string | null>(null);

  async function ask(q: string) {
    if (!q.trim()) return;
    setAsking(true);
    setAnswer(null);
    setCoachError(null);
    try {
      const a = await askCoach(q.trim());
      setAnswer(a);
    } catch (e) {
      setCoachError(e instanceof Error ? e.message : "실패했어요");
    } finally {
      setAsking(false);
    }
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    ask(question);
  };

  return (
    <div className="screen">
      <header className="hero-head">
        <div className="hero-top">
          <span className="badge">소비일기 · beta</span>
          <button className="link" onClick={() => signOut()}>
            로그아웃
          </button>
        </div>
        <h1>내 소비가 이야기가 되는 곳</h1>
        <p className="sub">영수증 한 장 + 사진 한 장이면 충분해요</p>
        <div className="home-total">
          <span className="muted small">이번달 지출</span>
          <span className="total">{won(cmp.current)}</span>
          {cmp.previous > 0 && (
            <span
              className={`delta ${cmp.delta > 0 ? "up" : "down"}`}
              style={{ marginLeft: 6 }}
            >
              {cmp.delta > 0 ? "▲" : "▼"} {(Math.abs(cmp.ratio) * 100).toFixed(0)}%
            </span>
          )}
        </div>
      </header>

      <section className="coach">
        <form className="coach-form" onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="AI 코치에게 물어보세요"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            disabled={asking}
          />
          <button type="submit" disabled={asking || !question.trim()}>
            {asking ? "…" : "물어보기"}
          </button>
        </form>
        {!answer && !asking && !coachError && (
          <div className="coach-samples">
            {SAMPLE_QUESTIONS.map((q) => (
              <button
                key={q}
                className="coach-chip"
                onClick={() => {
                  setQuestion(q);
                  ask(q);
                }}
              >
                {q}
              </button>
            ))}
          </div>
        )}
        {asking && <div className="coach-answer loading">생각 중…</div>}
        {answer && <div className="coach-answer">{answer}</div>}
        {coachError && <div className="coach-answer error">{coachError}</div>}
      </section>

      <section className="recent">
        <h2>최근 기록</h2>
        {recent.length === 0 ? (
          <div className="empty">
            <p>아직 기록이 없어요.</p>
            <p className="muted">아래 ＋ 버튼으로 첫 영수증을 찍어보세요.</p>
          </div>
        ) : (
          <ul className="receipt-list">
            {recent.map((r) => {
              const m = modeLabel[r.mode];
              return (
                <li key={r.id}>
                  <button className="receipt-card" onClick={() => onOpen(r.id)}>
                    <div className="row">
                      <span className="mode-tag">
                        {m.emoji} {m.text}
                      </span>
                      <span className="muted small">{relativeDate(r.createdAt)}</span>
                    </div>
                    <div className="store">{r.store}</div>
                    {r.story && <div className="story">{r.story}</div>}
                    <div className="row">
                      <span className="total">{won(r.total)}</span>
                      {r.mode === "settle" && r.perPerson && (
                        <span className="muted small">1인 {won(r.perPerson)}</span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

    </div>
  );
}
