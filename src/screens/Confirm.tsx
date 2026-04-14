import { useRef, useState } from "react";
import {
  countPeopleInPhoto,
  fileToParts,
  finalizeReceipt,
  type ReceiptDraft,
} from "../lib/pipeline";
import { insertReceipt, uploadReceiptPhoto } from "../lib/receipts";
import { CATEGORIES } from "../lib/categories";
import { won } from "../lib/format";
import type { Mode, PhotoKind, Receipt, ReceiptItem } from "../types";

type Props = {
  draft: ReceiptDraft;
  onBack: () => void;
  onDone: (r: Receipt) => void;
};

const MODE_LABEL: Record<Mode, string> = {
  daily: "일상",
  memory: "추억",
  settle: "정산",
};

const MODE_HINT: Record<Mode, string> = {
  daily: "영수증만 저장해요",
  memory: "사진과 함께 한 줄 스토리를 만들어요",
  settle: "인원수로 정산하고 공유할 수 있어요",
};

const kindForMode = (mode: Mode): PhotoKind => {
  if (mode === "memory") return "food";
  if (mode === "settle") return "group";
  return "none";
};

export default function Confirm({ draft, onBack, onDone }: Props) {
  const [store, setStore] = useState(draft.store);
  const [date, setDate] = useState(draft.date);
  const [total, setTotal] = useState(draft.total);
  const [items, setItems] = useState<ReceiptItem[]>(draft.items);
  const [mode, setMode] = useState<Mode>("daily");
  const [partySize, setPartySize] = useState<number>(2);

  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>();
  const [photoMediaType, setPhotoMediaType] = useState<string | undefined>();
  const [counting, setCounting] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateItem = (idx: number, patch: Partial<ReceiptItem>) =>
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    );
  const setCategory = (idx: number, major: string) =>
    updateItem(idx, { category: { major, minor: "" } });
  const removeItem = (idx: number) =>
    setItems((prev) => prev.filter((_, i) => i !== idx));
  const addItem = () =>
    setItems((prev) => [
      ...prev,
      { name: "", price: 0, category: { major: "식비", minor: "" } },
    ]);

  async function handlePhoto(f: File) {
    const parts = await fileToParts(f);
    setPhotoDataUrl(parts.dataUrl);
    setPhotoMediaType(parts.mediaType);
    if (mode === "settle") {
      setCounting(true);
      try {
        const n = await countPeopleInPhoto(f);
        setPartySize(n);
      } catch {
        // 실패해도 사용자가 직접 입력
      } finally {
        setCounting(false);
      }
    }
  }

  function clearPhoto() {
    setPhotoDataUrl(undefined);
    setPhotoMediaType(undefined);
  }

  const itemsSum = items.reduce((a, b) => a + (b.price || 0), 0);
  const showPhoto = mode === "memory" || mode === "settle";

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const finalDraft: ReceiptDraft = {
        store: store.trim() || "이름 없음",
        date,
        total,
        items: items.filter((it) => it.name.trim().length > 0),
        mode,
        photoDataUrl: showPhoto ? photoDataUrl : undefined,
        photoMediaType: showPhoto ? photoMediaType : undefined,
        photoKind: showPhoto && photoDataUrl ? kindForMode(mode) : "none",
        partySize: mode === "settle" ? partySize : undefined,
      };
      const receipt = await finalizeReceipt(finalDraft);
      let photoUrl: string | undefined;
      if (receipt.photoDataUrl) {
        photoUrl = await uploadReceiptPhoto(
          receipt.photoDataUrl,
          photoMediaType ?? "image/jpeg",
        );
      }
      const saved = await insertReceipt(receipt, photoUrl);
      onDone(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장 실패");
      setSaving(false);
    }
  }

  const saveLabel = saving
    ? mode === "daily"
      ? "저장 중…"
      : "AI 정리 중…"
    : "확정하고 저장";

  return (
    <div className="screen">
      <header className="screen-head">
        <button className="back" onClick={onBack} disabled={saving}>
          ←
        </button>
        <h2>확인하고 저장</h2>
        <div style={{ width: 32 }} />
      </header>

      <section className="capture-body">
        <div className="capture-card">
          <div className="card-label">어떻게 기록할까요?</div>
          <div className="mode-picker">
            {(["daily", "memory", "settle"] as Mode[]).map((m) => (
              <button
                key={m}
                className={`mode-btn ${mode === m ? "on" : ""}`}
                onClick={() => setMode(m)}
                disabled={saving}
              >
                {MODE_LABEL[m]}
              </button>
            ))}
          </div>
          <p className="muted small" style={{ margin: 0 }}>
            {MODE_HINT[mode]}
          </p>

          {showPhoto && (
            <div className="mode-extra">
              {photoDataUrl ? (
                <div className="photo-preview">
                  <img src={photoDataUrl} alt="첨부" />
                  <button
                    className="link"
                    onClick={() => photoRef.current?.click()}
                    disabled={saving}
                  >
                    다시 선택
                  </button>
                  <button
                    className="link"
                    onClick={clearPhoto}
                    disabled={saving}
                  >
                    제거
                  </button>
                </div>
              ) : (
                <button
                  className="picker subtle"
                  onClick={() => photoRef.current?.click()}
                  disabled={saving}
                >
                  <span className="picker-icon">🖼️</span>
                  <span>
                    {mode === "memory" ? "음식·풍경 사진" : "단체샷 (선택)"}
                  </span>
                </button>
              )}
              <input
                ref={photoRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handlePhoto(f);
                }}
              />
            </div>
          )}

          {mode === "settle" && (
            <label className="field">
              <span>인원수</span>
              <input
                type="number"
                min={1}
                value={partySize}
                onChange={(e) => setPartySize(Number(e.target.value) || 1)}
                disabled={saving || counting}
              />
              {counting && (
                <span className="muted small" style={{ gridColumn: "2" }}>
                  사진에서 인원을 세고 있어요…
                </span>
              )}
            </label>
          )}
        </div>

        <div className="capture-card">
          <div className="card-label">영수증 정보</div>
          <label className="field">
            <span>가게</span>
            <input
              value={store}
              onChange={(e) => setStore(e.target.value)}
              disabled={saving}
            />
          </label>
          <label className="field">
            <span>날짜</span>
            <input
              type="date"
              value={date.slice(0, 10)}
              onChange={(e) => setDate(e.target.value)}
              disabled={saving}
            />
          </label>
          <label className="field">
            <span>총액</span>
            <input
              type="number"
              value={total}
              onChange={(e) => setTotal(Number(e.target.value) || 0)}
              disabled={saving}
            />
          </label>
        </div>

        <div className="capture-card">
          <div className="card-label">
            품목{" "}
            <span className="muted small">
              ({items.length}개 · 합계 {won(itemsSum)})
            </span>
          </div>
          <ul className="edit-items">
            {items.map((it, idx) => (
              <li key={idx}>
                <input
                  className="item-name"
                  value={it.name}
                  placeholder="품목"
                  onChange={(e) => updateItem(idx, { name: e.target.value })}
                  disabled={saving}
                />
                <input
                  className="item-price"
                  type="number"
                  value={it.price}
                  onChange={(e) =>
                    updateItem(idx, { price: Number(e.target.value) || 0 })
                  }
                  disabled={saving}
                />
                <select
                  className="item-cat"
                  value={it.category?.major ?? "기타"}
                  onChange={(e) => setCategory(idx, e.target.value)}
                  disabled={saving}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <button
                  className="link"
                  onClick={() => removeItem(idx)}
                  disabled={saving}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
          <button className="link" onClick={addItem} disabled={saving}>
            + 품목 추가
          </button>
        </div>

        {error && <p className="error">{error}</p>}
      </section>

      <div className="bottom-bar">
        <button className="primary" onClick={handleSave} disabled={saving}>
          {saveLabel}
        </button>
      </div>
    </div>
  );
}
