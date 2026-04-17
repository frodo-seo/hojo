import { useState } from "react";
import type { Transaction, TransactionType } from "../types";
import { addTransaction, updateTransaction, deleteTransaction } from "../lib/db";
import { EXPENSE_CATEGORIES } from "../lib/categories";
import { today, formatAmountInput, amountKoreanWord } from "../lib/format";
import CategoryPicker from "../components/CategoryPicker";

type Props = {
  editTx?: Transaction;
  onDone: () => void;
  onBack: () => void;
};

export default function Add({ editTx, onDone, onBack }: Props) {
  const [type, setType] = useState<TransactionType>(editTx?.type ?? "expense");
  const [amount, setAmount] = useState(editTx ? String(editTx.amount) : "");
  const [categoryId, setCategoryId] = useState(
    editTx?.categoryId ?? EXPENSE_CATEGORIES[0].id,
  );
  const [memo, setMemo] = useState(editTx?.memo ?? "");
  const [date, setDate] = useState(editTx?.date ?? today());
  const [saving, setSaving] = useState(false);

  const isEdit = !!editTx;

  function pad(extra: string) {
    setAmount((prev) => {
      const base = prev === "" || prev === "0" ? "" : prev;
      return base + extra;
    });
  }

  function addAmount(delta: number) {
    setAmount((prev) => {
      const cur = parseInt(prev) || 0;
      return String(cur + delta);
    });
  }

  function clearAmount() {
    setAmount("");
  }

  async function handleSave() {
    const amt = parseInt(amount);
    if (!amt || amt <= 0) return;
    if (type === "expense" && amt >= 1_000_000) {
      const ok = confirm(`${amt.toLocaleString("ko-KR")}원, 큰 금액이옵니다. 진실로 올리시겠사옵니까?`);
      if (!ok) return;
    }
    setSaving(true);

    const tx: Transaction = {
      id: editTx?.id ?? crypto.randomUUID(),
      type,
      amount: amt,
      categoryId,
      memo: memo.trim(),
      date,
      createdAt: editTx?.createdAt ?? new Date().toISOString(),
    };

    if (isEdit) {
      await updateTransaction(tx);
    } else {
      await addTransaction(tx);
    }
    onDone();
  }

  async function handleDelete() {
    if (!editTx) return;
    if (!confirm("삭제할까요?")) return;
    await deleteTransaction(editTx.id);
    onDone();
  }

  return (
    <div className="screen add-screen">
      <header className="add-header">
        <button className="back-btn" onClick={onBack}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1>{isEdit ? "수정" : "추가"}</h1>
        {isEdit && (
          <button className="delete-btn" onClick={handleDelete}>
            삭제
          </button>
        )}
      </header>

      <div className="type-toggle">
        <button
          className={`toggle-btn ${type === "expense" ? "on expense" : ""}`}
          onClick={() => {
            setType("expense");
            setCategoryId("food");
          }}
        >
          지출
        </button>
        <button
          className={`toggle-btn ${type === "income" ? "on income" : ""}`}
          onClick={() => {
            setType("income");
            setCategoryId("salary");
          }}
        >
          수입
        </button>
      </div>

      <div className="amount-input-wrap">
        <input
          type="text"
          className="amount-input"
          placeholder="0"
          value={formatAmountInput(amount)}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
          inputMode="numeric"
          autoFocus
        />
        <span className="amount-unit">원</span>
      </div>
      {amountKoreanWord(parseInt(amount) || 0) && (
        <p className="amount-hint amount-hint-center">
          {amountKoreanWord(parseInt(amount) || 0)}
        </p>
      )}

      <div className="quick-amount-chips">
        <button className="quick-chip" onClick={() => addAmount(1000)}>+1천</button>
        <button className="quick-chip" onClick={() => addAmount(10000)}>+1만</button>
        <button className="quick-chip" onClick={() => addAmount(100000)}>+10만</button>
        <button className="quick-chip" onClick={() => pad("000")}>000</button>
        <button className="quick-chip quick-chip-clear" onClick={clearAmount} aria-label="지우기">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="form-field">
        <label>카테고리</label>
        <CategoryPicker
          type={type}
          selected={categoryId}
          onSelect={setCategoryId}
        />
      </div>

      <div className="form-field">
        <label>날짜</label>
        <input
          type="date"
          className="form-input"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <div className="form-field">
        <label>메모</label>
        <input
          type="text"
          className="form-input"
          placeholder="메모 (선택)"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
        />
      </div>

      <button
        className="save-btn"
        onClick={handleSave}
        disabled={!amount || parseInt(amount) <= 0 || saving}
      >
        {saving ? "저장 중..." : isEdit ? "수정 완료" : "저장"}
      </button>
    </div>
  );
}
