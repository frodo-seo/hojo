import { useState } from "react";
import type { Receipt } from "../types";
import { won } from "../lib/format";
import { shareReceipt } from "../lib/shareCard";

type Props = {
  receipt: Receipt;
  onHome: () => void;
};

const modeMeta: Record<Receipt["mode"], { title: string; emoji: string }> = {
  daily: { title: "일상 모드", emoji: "🧾" },
  memory: { title: "추억 모드", emoji: "📸" },
  settle: { title: "정산 모드", emoji: "🤝" },
};

export default function Result({ receipt, onHome }: Props) {
  const meta = modeMeta[receipt.mode];
  const [sharing, setSharing] = useState(false);
  const [shareHint, setShareHint] = useState<string | null>(null);

  async function handleShare() {
    setSharing(true);
    setShareHint(null);
    try {
      const result = await shareReceipt(receipt);
      if (result === "downloaded") {
        setShareHint("이미지를 저장했고 문구는 복사했어요");
      } else if (result === "failed") {
        setShareHint("공유에 실패했어요");
      }
    } catch (e) {
      setShareHint(e instanceof Error ? e.message : "공유 실패");
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="screen">
      <header className="screen-head">
        <button className="back" onClick={onHome}>
          ←
        </button>
        <h2>
          {meta.emoji} {meta.title}
        </h2>
        <div style={{ width: 32 }} />
      </header>

      <section className="result-body">
        {receipt.photoDataUrl && (
          <div className="result-photo">
            <img src={receipt.photoDataUrl} alt="첨부" />
          </div>
        )}

        {receipt.story && <h3 className="story-headline">"{receipt.story}"</h3>}

        <div className="capture-card">
          <div className="row">
            <div className="store">{receipt.store}</div>
            <div className="total">{won(receipt.total)}</div>
          </div>
          <ul className="item-list">
            {receipt.items.map((it, i) => (
              <li key={i}>
                <span>{it.name}</span>
                <span className="muted">{won(it.price)}</span>
                {it.category && (
                  <span className="cat-tag">
                    {it.category.major} · {it.category.minor}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>

        {receipt.mode === "settle" && receipt.partySize && receipt.perPerson && (
          <div className="capture-card settle-box">
            <div className="card-label">정산</div>
            <div className="row big">
              <span>{receipt.partySize}명 균등 분배</span>
              <span className="total">1인 {won(receipt.perPerson)}</span>
            </div>
            <button
              className="ghost"
              onClick={handleShare}
              disabled={sharing}
            >
              {sharing ? "카드 만드는 중…" : "정산 카드 공유"}
            </button>
            {shareHint && (
              <p className="muted small" style={{ margin: "6px 0 0" }}>
                {shareHint}
              </p>
            )}
          </div>
        )}

        {receipt.insight && (
          <div className="capture-card insight">
            <div className="card-label">AI 인사이트</div>
            <p>{receipt.insight}</p>
          </div>
        )}

        {receipt.tags && receipt.tags.length > 0 && (
          <div className="tag-row">
            {receipt.tags.map((t) => (
              <span key={t} className="tag">
                {t}
              </span>
            ))}
          </div>
        )}
      </section>

      <div className="bottom-bar">
        <button className="primary" onClick={onHome}>
          홈으로
        </button>
      </div>
    </div>
  );
}
