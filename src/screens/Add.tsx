import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Transaction, TransactionType } from "../types";
import { updateTransaction, deleteTransaction } from "../lib/db";
import { formatAmountInput, amountKoreanWord, formatMoney } from "../lib/format";
import CategoryPicker from "../components/CategoryPicker";

type Props = {
  editTx: Transaction;
  onDone: () => void;
  onBack: () => void;
};

export default function Add({ editTx, onDone, onBack }: Props) {
  const { t } = useTranslation();
  const [type, setType] = useState<TransactionType>(editTx.type);
  const [amount, setAmount] = useState(String(editTx.amount));
  const [categoryId, setCategoryId] = useState(editTx.categoryId);
  const [memo, setMemo] = useState(editTx.memo);
  const [date, setDate] = useState(editTx.date);
  const [saving, setSaving] = useState(false);

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
      const ok = confirm(t("add.confirmLargeAmount", { amount: formatMoney(amt) }));
      if (!ok) return;
    }
    setSaving(true);

    await updateTransaction({
      id: editTx.id,
      type,
      amount: amt,
      categoryId,
      memo: memo.trim(),
      date,
      createdAt: editTx.createdAt,
    });
    onDone();
  }

  async function handleDelete() {
    if (!confirm(t("common.confirmDelete"))) return;
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
        <h1>{t("add.editTitle")}</h1>
        <button className="delete-btn" onClick={handleDelete}>
          {t("common.delete")}
        </button>
      </header>

      <div className="type-toggle">
        <button
          className={`toggle-btn ${type === "expense" ? "on expense" : ""}`}
          onClick={() => {
            setType("expense");
            setCategoryId("food");
          }}
        >
          {t("add.typeExpense")}
        </button>
        <button
          className={`toggle-btn ${type === "income" ? "on income" : ""}`}
          onClick={() => {
            setType("income");
            setCategoryId("salary");
          }}
        >
          {t("add.typeIncome")}
        </button>
      </div>

      <div className="amount-input-wrap">
        <input
          type="text"
          className="amount-input"
          placeholder={t("add.amountPlaceholder")}
          value={formatAmountInput(amount)}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
          inputMode="numeric"
        />
        <span className="amount-unit">{t("format.amountUnit")}</span>
      </div>
      {amountKoreanWord(parseInt(amount) || 0) && (
        <p className="amount-hint amount-hint-center">
          {amountKoreanWord(parseInt(amount) || 0)}
        </p>
      )}

      <div className="quick-amount-chips">
        <button className="quick-chip" onClick={() => addAmount(1000)}>{t("add.quickThousand")}</button>
        <button className="quick-chip" onClick={() => addAmount(10000)}>{t("add.quickTenK")}</button>
        <button className="quick-chip" onClick={() => addAmount(100000)}>{t("add.quickHundredK")}</button>
        <button className="quick-chip" onClick={() => pad("000")}>{t("add.quickZero")}</button>
        <button className="quick-chip quick-chip-clear" onClick={clearAmount} aria-label={t("add.clearAmount")}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="form-field">
        <label>{t("add.categoryLabel")}</label>
        <CategoryPicker
          type={type}
          selected={categoryId}
          onSelect={setCategoryId}
        />
      </div>

      <div className="form-field">
        <label>{t("add.dateLabel")}</label>
        <input
          type="date"
          className="form-input"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      <div className="form-field">
        <label>{t("add.memoLabel")}</label>
        <input
          type="text"
          className="form-input"
          placeholder={t("add.memoPlaceholder")}
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
        />
      </div>

      <button
        className="save-btn"
        onClick={handleSave}
        disabled={!amount || parseInt(amount) <= 0 || saving}
      >
        {saving ? t("common.saving") : t("add.editButton")}
      </button>
    </div>
  );
}
