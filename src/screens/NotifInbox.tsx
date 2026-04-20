import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getPendingNotifs,
  updatePendingNotif,
  dismissPendingNotif,
  addTransaction,
  type PendingNotif,
} from "../lib/db";
import { EXPENSE_CATEGORIES, categoryName } from "../lib/categories";
import { formatAmountInput, parseAmountInput } from "../lib/format";
import type { Transaction } from "../types";

type Props = {
  onBack: () => void;
  onDone: () => void;
};

export default function NotifInbox({ onBack, onDone }: Props) {
  const { t } = useTranslation();
  const [items, setItems] = useState<PendingNotif[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getPendingNotifs().then(setItems);
  }, []);

  const updateItem = (id: string, patch: Partial<PendingNotif>) => {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  };

  const saveOne = async (n: PendingNotif) => {
    if (!n.categoryId) return;
    const tx: Transaction = {
      id: `notif_${n.id}_${Date.now()}`,
      type: "expense",
      amount: n.amount,
      categoryId: n.categoryId,
      memo: n.store || "",
      date: n.date,
      createdAt: new Date().toISOString(),
    };
    try {
      await addTransaction(tx);
      await dismissPendingNotif(n.id);
      setItems((xs) => xs.filter((x) => x.id !== n.id));
    } catch (err) {
      console.error("[hojo] notif save failed", err);
      alert(`저장 실패: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const dismiss = async (id: string) => {
    await dismissPendingNotif(id);
    setItems((xs) => xs.filter((x) => x.id !== id));
  };

  const saveAll = async () => {
    setBusy(true);
    try {
      const ready = items.filter((n) => n.categoryId);
      for (const n of ready) {
        await saveOne(n);
      }
    } finally {
      setBusy(false);
    }
    if (items.every((n) => n.categoryId)) onDone();
  };

  const persistEdit = async (n: PendingNotif) => {
    await updatePendingNotif(n);
  };

  const hasReady = items.some((n) => n.categoryId);

  return (
    <div className="screen">
      <header className="scan-header">
        <button className="scan-back" onClick={onBack}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="scan-title">{t("notifInbox.title")}</h1>
      </header>

      <p className="section-desc notif-subtitle">{t("notifInbox.subtitle")}</p>

      {items.length === 0 ? (
        <div className="empty"><p>{t("notifInbox.empty")}</p></div>
      ) : (
        <>
          <div className="notif-list">
            {items.map((n) => (
              <NotifRow
                key={n.id}
                notif={n}
                onChange={(patch) => {
                  const next = { ...n, ...patch };
                  updateItem(n.id, patch);
                  persistEdit(next);
                }}
                onSave={() => saveOne(n)}
                onDismiss={() => dismiss(n.id)}
              />
            ))}
          </div>

          {hasReady && (
            <div className="scan-actions">
              <button className="save-btn" disabled={busy} onClick={saveAll}>
                {busy ? t("notifInbox.saving") : t("notifInbox.saveAll")}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function NotifRow({
  notif,
  onChange,
  onSave,
  onDismiss,
}: {
  notif: PendingNotif;
  onChange: (patch: Partial<PendingNotif>) => void;
  onSave: () => void;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  const ready = !!notif.categoryId;

  return (
    <div className="notif-item">
      <div className="notif-head">
        <span className="notif-store">{notif.store || t("notifInbox.unknownStore")}</span>
        <span className="notif-amount">-{formatAmountInput(String(notif.amount))}</span>
      </div>

      <div className="notif-fields">
        <label className="notif-field">
          <span className="notif-field-label">{t("notifInbox.storeLabel")}</span>
          <input
            type="text"
            value={notif.store || ""}
            onChange={(e) => onChange({ store: e.target.value })}
          />
        </label>

        <label className="notif-field">
          <span className="notif-field-label">{t("notifInbox.amountLabel")}</span>
          <input
            type="text"
            inputMode="numeric"
            value={formatAmountInput(String(notif.amount))}
            onChange={(e) => {
              const v = parseAmountInput(e.target.value);
              if (!Number.isNaN(v)) onChange({ amount: v });
            }}
          />
        </label>

        <label className="notif-field">
          <span className="notif-field-label">{t("notifInbox.dateLabel")}</span>
          <input
            type="date"
            value={notif.date}
            onChange={(e) => onChange({ date: e.target.value })}
          />
        </label>

        <label className="notif-field">
          <span className="notif-field-label">{t("notifInbox.categoryLabel")}</span>
          <select
            value={notif.categoryId || ""}
            onChange={(e) => onChange({ categoryId: e.target.value || undefined })}
          >
            <option value="">{t("notifInbox.pickCategory")}</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{categoryName(c.id)}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="notif-row-actions">
        <button className="notif-dismiss" onClick={onDismiss}>{t("notifInbox.dismiss")}</button>
        <button className="notif-save" disabled={!ready} onClick={onSave}>
          {t("notifInbox.saveOne")}
        </button>
      </div>
    </div>
  );
}
