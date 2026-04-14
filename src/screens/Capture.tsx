import { useRef, useState } from "react";
import { runOcr, type ReceiptDraft } from "../lib/pipeline";

type Props = {
  onBack: () => void;
  onDone: (draft: ReceiptDraft) => void;
};

export default function Capture({ onBack, onDone }: Props) {
  const receiptRef = useRef<HTMLInputElement>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!receiptFile) {
      setError("영수증 사진을 먼저 선택해주세요");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const draft = await runOcr(receiptFile);
      onDone(draft);
    } catch (e) {
      setError(e instanceof Error ? e.message : "처리 중 문제가 생겼어요");
      setBusy(false);
    }
  }

  return (
    <div className="screen">
      <header className="screen-head">
        <button className="back" onClick={onBack} disabled={busy}>
          ←
        </button>
        <h2>영수증 찍기</h2>
        <div style={{ width: 32 }} />
      </header>

      <section className="capture-body">
        <div className="capture-card">
          <div className="card-label">영수증</div>
          {receiptFile ? (
            <div className="picked">
              <span>📄</span>
              <span className="filename">{receiptFile.name}</span>
              <button
                className="link"
                onClick={() => receiptRef.current?.click()}
                disabled={busy}
              >
                다시 선택
              </button>
            </div>
          ) : (
            <button
              className="picker"
              onClick={() => receiptRef.current?.click()}
              disabled={busy}
            >
              <span className="picker-icon">📷</span>
              <span>영수증 사진 선택</span>
              <span className="muted small">카메라 또는 갤러리</span>
            </button>
          )}
          <input
            ref={receiptRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setReceiptFile(f);
            }}
          />
        </div>

        {error && <p className="error">{error}</p>}
      </section>

      <div className="bottom-bar">
        <button
          className="primary"
          disabled={!receiptFile || busy}
          onClick={submit}
        >
          {busy ? "영수증을 읽고 있어요…" : "다음"}
        </button>
      </div>
    </div>
  );
}
