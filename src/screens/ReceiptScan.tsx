import { useRef, useState } from "react";
import type { Transaction } from "../types";
import { addTransaction } from "../lib/db";
import { getCategoryById, EXPENSE_CATEGORIES } from "../lib/categories";
import { formatMoney, today } from "../lib/format";
import {
  compressImage,
  scanReceipt,
  type ParsedReceipt,
  type ReceiptItem,
} from "../lib/receipt";

type Props = {
  onDone: () => void;
  onBack: () => void;
};

type Status = "idle" | "compressing" | "scanning" | "done" | "error";

export default function ReceiptScan({ onDone, onBack }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<ParsedReceipt | null>(null);
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [saving, setSaving] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setPreview(URL.createObjectURL(file));
    setError("");
    setStatus("compressing");

    try {
      const { base64, mediaType } = await compressImage(file);
      setStatus("scanning");
      const parsed = await scanReceipt(base64, mediaType);
      setResult(parsed);
      setItems(parsed.items);
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "스캔에 실패했습니다");
      setStatus("error");
    }
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateCategory(idx: number, categoryId: string) {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, category: categoryId } : item)),
    );
  }

  const hasUnset = items.some((i) => !i.category);

  async function handleSaveAll() {
    if (items.length === 0 || hasUnset) return;
    setSaving(true);

    const date = result?.date || today();
    const storeName = result?.store || "";

    for (const item of items) {
      const tx: Transaction = {
        id: crypto.randomUUID(),
        type: "expense",
        amount: item.price,
        categoryId: item.category!,
        memo: storeName ? `${storeName} — ${item.name}` : item.name,
        date,
        createdAt: new Date().toISOString(),
      };
      await addTransaction(tx);
    }

    onDone();
  }

  const totalAmount = items.reduce((sum, i) => sum + i.price, 0);

  return (
    <div className="screen receipt-screen">
      <header className="add-header">
        <button className="back-btn" onClick={onBack}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1>지출 스캔</h1>
      </header>

      {/* 업로드 영역 */}
      {status === "idle" && (
        <button className="receipt-upload" onClick={() => fileRef.current?.click()}>
          <div className="receipt-upload-icon">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect x="4" y="6" width="24" height="20" rx="2" stroke="currentColor" strokeWidth="1.6" />
              <circle cx="12" cy="14" r="3" stroke="currentColor" strokeWidth="1.6" />
              <path d="M4 22l6-6 4 4 6-6 8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="receipt-upload-title">지출 이미지를 선택하세요</span>
          <span className="receipt-upload-sub">영수증, 결제 알림, 배달앱 캡쳐 등</span>
        </button>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        style={{ display: "none" }}
      />

      {/* 프리뷰 + 로딩 */}
      {preview && status !== "idle" && status !== "done" && (
        <div className="receipt-preview-wrap">
          <img src={preview} alt="영수증" className="receipt-preview" />
          {(status === "compressing" || status === "scanning") && (
            <div className="receipt-loading">
              <div className="receipt-spinner" />
              <span>{status === "compressing" ? "이미지를 다듬는 중이옵니다..." : "호조가 장부를 살피는 중이옵니다..."}</span>
            </div>
          )}
        </div>
      )}

      {/* 에러 */}
      {status === "error" && (
        <div className="receipt-error">
          <p>{error}</p>
          <button
            className="receipt-retry"
            onClick={() => {
              setStatus("idle");
              setPreview(null);
              if (fileRef.current) fileRef.current.value = "";
            }}
          >
            다시 시도
          </button>
        </div>
      )}

      {/* 결과 */}
      {status === "done" && items.length > 0 && (
        <>
          {result?.store && (
            <div className="receipt-store">
              <span className="receipt-store-label">매장</span>
              <span className="receipt-store-name">{result.store}</span>
            </div>
          )}

          {hasUnset && (
            <div className="receipt-unset-notice">
              카테고리를 선택해주세요
            </div>
          )}

          <div className="receipt-items">
            {items.map((item, idx) => {
              const cat = item.category ? getCategoryById(item.category) : null;
              const isUnset = !item.category;
              return (
                <div key={idx} className={`receipt-item ${isUnset ? "unset" : ""}`}>
                  <div className="receipt-item-main">
                    <span className="receipt-item-icon">{cat?.icon ?? "❓"}</span>
                    <div className="receipt-item-info">
                      <span className="receipt-item-name">{item.name}</span>
                      <select
                        className={`receipt-item-cat ${isUnset ? "unset" : ""}`}
                        value={item.category || ""}
                        onChange={(e) => updateCategory(idx, e.target.value)}
                      >
                        {isUnset && <option value="">카테고리 선택</option>}
                        {EXPENSE_CATEGORIES.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.icon} {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <span className="receipt-item-price">{formatMoney(item.price)}</span>
                    <button className="receipt-item-remove" onClick={() => removeItem(idx)}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="receipt-total">
            <span>합계 ({items.length}건)</span>
            <span className="receipt-total-amount">{formatMoney(totalAmount)}</span>
          </div>

          <button
            className="save-btn"
            onClick={handleSaveAll}
            disabled={saving || items.length === 0 || hasUnset}
          >
            {saving ? "저장 중..." : hasUnset ? "카테고리를 선택해주세요" : `${items.length}건 전체 저장`}
          </button>
        </>
      )}

      {status === "done" && items.length === 0 && (
        <div className="empty">
          <p>인식된 품목이 없습니다</p>
          <button
            className="receipt-retry"
            onClick={() => {
              setStatus("idle");
              setPreview(null);
              if (fileRef.current) fileRef.current.value = "";
            }}
          >
            다시 시도
          </button>
        </div>
      )}
    </div>
  );
}
