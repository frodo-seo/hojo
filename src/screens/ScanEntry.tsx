import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import type { Asset, FixedExpense, FixedIncome, Transaction } from "../types";
import {
  addAsset,
  addFixedExpense,
  addFixedIncome,
  addTransaction,
} from "../lib/db";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, categoryName } from "../lib/categories";
import { today } from "../lib/format";
import { isNative } from "../lib/platform";
import { getApiKeys, useApiKeysStatus } from "../lib/apiKeys";
import { compressImage } from "../lib/receipt";
import { parseLedger, type LedgerItemType, type ParsedLedger, type ParsedLedgerItem } from "../lib/ledger";
import { parseAssetTrade, type ParsedAssetTrade, type ParsedAssetTrades } from "../lib/assetParse";
import { classifyScan, type ScanKind } from "../lib/classify";
import { runOcr } from "../lib/ocr";
import i18n from "../lib/i18n";

type Props = {
  onDone: () => void;
  onBack: () => void;
  onGoSettings: () => void;
};

type Stage = "idle" | "ocr" | "classify" | "parse" | "preview" | "error";

type PreviewState =
  | { kind: "ledger"; data: ParsedLedger }
  | { kind: "asset_trade"; data: ParsedAssetTrades };

const KIND_KEYS: Exclude<ScanKind, "unknown">[] = ["ledger", "asset_trade"];

const LEDGER_TYPES: LedgerItemType[] = [
  "expense",
  "income",
  "fixed_expense",
  "fixed_income",
];

export default function ScanEntry({ onDone, onBack, onGoSettings }: Props) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const keys = useApiKeysStatus();
  const keysReady = keys.anthropic && keys.datalab;
  const missingList: string[] = [];
  if (!keys.datalab) missingList.push("Datalab");
  if (!keys.anthropic) missingList.push("Anthropic");

  const [hint, setHint] = useState("");
  const [preview, setPreviewImg] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<PreviewState | null>(null);
  const [cleanedText, setCleanedText] = useState("");
  const [saving, setSaving] = useState(false);

  async function runPipeline(base64: string, mediaType: string) {
    const { anthropic, datalab } = await getApiKeys();
    if (!anthropic || !datalab) throw new Error(t("apiKeys.missingTitle"));

    setStage("ocr");
    const cleaned = await runOcr(base64, mediaType, datalab);
    setCleanedText(cleaned);

    setStage("classify");
    const c = await classifyScan(cleaned, anthropic, hint);
    const kind: ScanKind = c.kind;
    if (kind === "unknown") {
      throw new Error(t("scan.unknownKind"));
    }

    setStage("parse");
    const parsed = await parseByKind(kind, cleaned, anthropic, hint);
    setResult(parsed);
    setStage("preview");
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewImg(URL.createObjectURL(file));
    setError("");
    try {
      const { base64, mediaType } = await compressImage(file);
      await runPipeline(base64, mediaType);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("receipt.scanFailed"));
      setStage("error");
    }
  }

  async function handleNativePick(source: CameraSource) {
    setError("");
    try {
      const photo = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.Base64,
        source,
        width: 1280,
        correctOrientation: true,
      });
      if (!photo.base64String) throw new Error(t("receipt.imageFailed"));
      const mediaType = `image/${photo.format || "jpeg"}`;
      setPreviewImg(`data:${mediaType};base64,${photo.base64String}`);
      await runPipeline(photo.base64String, mediaType);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("receipt.scanFailed");
      if (msg.includes("cancel")) {
        setStage("idle");
        return;
      }
      setError(msg);
      setStage("error");
    }
  }

  function handlePickClick() {
    if (isNative()) handleNativePick(CameraSource.Prompt);
    else fileRef.current?.click();
  }

  async function changeKind(newKind: Exclude<ScanKind, "unknown">) {
    if (!cleanedText) return;
    setStage("parse");
    try {
      const { anthropic } = await getApiKeys();
      if (!anthropic) throw new Error(t("apiKeys.missingTitle"));
      const parsed = await parseByKind(newKind, cleanedText, anthropic, hint);
      setResult(parsed);
      setStage("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("receipt.scanFailed"));
      setStage("error");
    }
  }

  async function handleSave() {
    if (!result) return;
    setSaving(true);
    try {
      await saveResult(result);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("scan.saveFailed"));
      setStage("error");
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setStage("idle");
    setPreviewImg(null);
    setResult(null);
    setCleanedText("");
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="screen receipt-screen">
      <header className="add-header">
        <button className="back-btn" onClick={onBack}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1>{t("scan.title")}</h1>
      </header>

      {keys.loaded && !keysReady && stage === "idle" && (
        <div className="keys-missing-card">
          <div className="keys-missing-title">{t("apiKeys.missingTitle")}</div>
          <div className="keys-missing-body">
            {t("apiKeys.receiptMissingBody", { keys: missingList.join(" · ") })}
          </div>
          <button className="keys-missing-btn" onClick={onGoSettings}>
            {t("apiKeys.goSettings")}
          </button>
        </div>
      )}

      {stage === "idle" && (
        <>
          <button
            className="receipt-upload"
            onClick={handlePickClick}
            disabled={!keysReady}
          >
            <div className="receipt-upload-icon">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <rect x="4" y="6" width="24" height="20" rx="2" stroke="currentColor" strokeWidth="1.6" />
                <circle cx="12" cy="14" r="3" stroke="currentColor" strokeWidth="1.6" />
                <path d="M4 22l6-6 4 4 6-6 8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <span className="receipt-upload-title">{t("scan.uploadTitle")}</span>
            <span className="receipt-upload-sub">{t("scan.uploadSub")}</span>
          </button>

          <div className="scan-hint-wrap">
            <label className="scan-hint-label">{t("scan.hintLabel")}</label>
            <textarea
              className="scan-hint-input"
              placeholder={t("scan.hintPlaceholder")}
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              rows={2}
              disabled={!keysReady}
            />
          </div>
        </>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        style={{ display: "none" }}
      />

      {preview && stage !== "idle" && stage !== "preview" && stage !== "error" && (
        <div className="receipt-preview-wrap">
          <img src={preview} alt="" className="receipt-preview" />
          <div className="receipt-loading">
            <div className="receipt-spinner" />
            <span>
              {stage === "ocr" ? t("scan.stageOcr")
                : stage === "classify" ? t("scan.stageClassify")
                : t("scan.stageParse")}
            </span>
          </div>
        </div>
      )}

      {stage === "error" && (
        <div className="receipt-error">
          <p>{error}</p>
          <button className="receipt-retry" onClick={reset}>
            {t("common.retry")}
          </button>
        </div>
      )}

      {stage === "preview" && result && (
        <PreviewPanel
          result={result}
          setResult={setResult}
          onChangeKind={changeKind}
          onSave={handleSave}
          saving={saving}
          onRetry={reset}
        />
      )}
    </div>
  );
}

async function parseByKind(
  kind: Exclude<ScanKind, "unknown">,
  cleaned: string,
  anthropicKey: string,
  hint: string,
): Promise<PreviewState> {
  switch (kind) {
    case "ledger": {
      const data = await parseLedger(cleaned, anthropicKey, hint);
      return { kind, data };
    }
    case "asset_trade": {
      const data = await parseAssetTrade(cleaned, anthropicKey, hint);
      return { kind, data };
    }
  }
}

async function saveResult(result: PreviewState): Promise<void> {
  const now = new Date().toISOString();
  switch (result.kind) {
    case "ledger": {
      const { data } = result;
      for (const it of data.items) {
        await saveLedgerItem(it, now);
      }
      return;
    }
    case "asset_trade": {
      const { data } = result;
      if (data.items.some((i) => i.avgCost == null)) {
        throw new Error(i18n.t("scan.avgCostRequired"));
      }
      for (const item of data.items) {
        const asset: Asset = {
          id: crypto.randomUUID(),
          kind: item.kind,
          ticker: item.ticker,
          name: item.name || item.ticker,
          quantity: item.quantity,
          avgCost: item.avgCost as number,
          currency: item.currency,
          createdAt: now,
        };
        await addAsset(asset);
      }
      return;
    }
  }
}

async function saveLedgerItem(it: ParsedLedgerItem, now: string): Promise<void> {
  switch (it.type) {
    case "expense":
    case "income": {
      const tx: Transaction = {
        id: crypto.randomUUID(),
        type: it.type,
        amount: it.amount,
        categoryId: it.categoryId,
        memo: it.name,
        date: it.date || today(),
        createdAt: now,
      };
      await addTransaction(tx);
      return;
    }
    case "fixed_expense": {
      const item: FixedExpense = {
        id: crypto.randomUUID(),
        name: it.name,
        amount: it.amount,
        categoryId: it.categoryId,
        day: it.day || 1,
      };
      await addFixedExpense(item);
      return;
    }
    case "fixed_income": {
      const item: FixedIncome = {
        id: crypto.randomUUID(),
        name: it.name,
        amount: it.amount,
        categoryId: it.categoryId,
      };
      await addFixedIncome(item);
      return;
    }
  }
}

type PreviewProps = {
  result: PreviewState;
  setResult: (r: PreviewState) => void;
  onChangeKind: (kind: Exclude<ScanKind, "unknown">) => void;
  onSave: () => void;
  saving: boolean;
  onRetry: () => void;
};

function PreviewPanel({ result, setResult, onChangeKind, onSave, saving, onRetry }: PreviewProps) {
  const { t } = useTranslation();
  return (
    <div className="scan-preview">
      <div className="scan-kind-row">
        <span className="scan-kind-label">{t("scan.kindLabel")}</span>
        <select
          className="scan-kind-select"
          value={result.kind}
          onChange={(e) => onChangeKind(e.target.value as Exclude<ScanKind, "unknown">)}
        >
          {KIND_KEYS.map((k) => (
            <option key={k} value={k}>{t(`scan.kind_${k}`)}</option>
          ))}
        </select>
      </div>

      {result.kind === "ledger" && (
        <LedgerPreview data={result.data} onChange={(data) => setResult({ kind: "ledger", data })} />
      )}
      {result.kind === "asset_trade" && (
        <AssetPreview data={result.data} onChange={(data) => setResult({ kind: "asset_trade", data })} />
      )}

      <div className="scan-actions">
        <button className="btn-ghost" onClick={onRetry}>{t("scan.retry")}</button>
        <button className="save-btn" onClick={onSave} disabled={saving || !canSave(result)}>
          {saving ? t("scan.saving") : t("scan.save")}
        </button>
      </div>
    </div>
  );
}

function canSave(r: PreviewState): boolean {
  switch (r.kind) {
    case "ledger":
      return r.data.items.length > 0
        && r.data.items.every((i) => i.amount > 0 && !!i.name && !!i.categoryId);
    case "asset_trade":
      return r.data.items.length > 0
        && r.data.items.every((i) => i.quantity > 0 && i.avgCost != null && i.avgCost > 0 && !!i.ticker);
  }
}

function LedgerPreview({
  data,
  onChange,
}: {
  data: ParsedLedger;
  onChange: (d: ParsedLedger) => void;
}) {
  const { t } = useTranslation();
  const update = (idx: number, patch: Partial<ParsedLedgerItem>) => {
    const items = data.items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
    onChange({ ...data, items });
  };
  const remove = (idx: number) => {
    onChange({ ...data, items: data.items.filter((_, i) => i !== idx) });
  };
  if (data.items.length === 0) {
    return <div className="scan-empty">{t("scan.ledgerEmpty")}</div>;
  }
  return (
    <div className="scan-fields">
      <div className="scan-ledger-summary">
        <span>{t("scan.ledgerCount", { count: data.items.length })}</span>
        {data.mixedCurrency && (
          <span className="scan-badge">{t("scan.mixedCurrencyBadge")}</span>
        )}
      </div>
      {data.items.map((item, idx) => {
        const isExpense = item.type === "expense" || item.type === "fixed_expense";
        const isFixed = item.type === "fixed_expense" || item.type === "fixed_income";
        const cats = isExpense ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
        const fallbackCat = isExpense ? "etc-expense" : "etc-income";
        const categoryValue = cats.find((c) => c.id === item.categoryId)?.id || fallbackCat;
        return (
          <div key={idx} className="scan-ledger-card">
            <div className="scan-ledger-card-head">
              <div className="scan-ledger-type">
                <select
                  value={item.type}
                  onChange={(e) => {
                    const nextType = e.target.value as LedgerItemType;
                    const nextIsExpense = nextType === "expense" || nextType === "fixed_expense";
                    const currIsExpense = item.type === "expense" || item.type === "fixed_expense";
                    const nextCat = nextIsExpense === currIsExpense
                      ? item.categoryId
                      : (nextIsExpense ? "etc-expense" : "etc-income");
                    update(idx, { type: nextType, categoryId: nextCat });
                  }}
                >
                  {LEDGER_TYPES.map((k) => (
                    <option key={k} value={k}>{t(`scan.type_${k}`)}</option>
                  ))}
                </select>
              </div>
              <button className="scan-item-remove" onClick={() => remove(idx)}>×</button>
            </div>
            <Field label={t("scan.name")}>
              <input
                type="text"
                value={item.name}
                onChange={(e) => update(idx, { name: e.target.value })}
              />
            </Field>
            <Field label={t("scan.amount")}>
              <input
                type="number"
                step="any"
                value={item.amount}
                onChange={(e) => update(idx, { amount: Number(e.target.value) })}
              />
            </Field>
            <Field label={t("scan.category")}>
              <select
                value={categoryValue}
                onChange={(e) => update(idx, { categoryId: e.target.value })}
              >
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>{categoryName(c.id)}</option>
                ))}
              </select>
            </Field>
            {isFixed ? (
              <Field label={t("scan.dueDay")}>
                <input
                  type="number"
                  min={1}
                  max={28}
                  value={item.day || 1}
                  onChange={(e) =>
                    update(idx, { day: Math.max(1, Math.min(28, Number(e.target.value))) })
                  }
                />
              </Field>
            ) : (
              <Field label={t("scan.date")}>
                <input
                  type="date"
                  value={item.date || today()}
                  onChange={(e) => update(idx, { date: e.target.value })}
                />
              </Field>
            )}
          </div>
        );
      })}
    </div>
  );
}

function AssetPreview({ data, onChange }: { data: ParsedAssetTrades; onChange: (d: ParsedAssetTrades) => void }) {
  const { t } = useTranslation();
  const update = (idx: number, patch: Partial<ParsedAssetTrade>) => {
    const items = data.items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
    onChange({ items });
  };
  const remove = (idx: number) => {
    onChange({ items: data.items.filter((_, i) => i !== idx) });
  };
  return (
    <div className="scan-fields">
      {data.items.map((item, idx) => (
        <div key={idx} className="scan-asset-card">
          <div className="scan-asset-card-head">
            <span className="scan-asset-card-title">
              {item.name || item.ticker || `#${idx + 1}`}
            </span>
            <button className="scan-item-remove" onClick={() => remove(idx)}>×</button>
          </div>
          <Field label={t("scan.assetKind")}>
            <select value={item.kind}
              onChange={(e) => update(idx, { kind: e.target.value as ParsedAssetTrade["kind"] })}>
              <option value="stock">{t("scan.assetKindStock")}</option>
              <option value="crypto">{t("scan.assetKindCrypto")}</option>
              <option value="commodity">{t("scan.assetKindCommodity")}</option>
            </select>
          </Field>
          <Field label={t("scan.ticker")}>
            <input type="text" value={item.ticker}
              onChange={(e) => update(idx, { ticker: e.target.value.toUpperCase() })} />
          </Field>
          <Field label={t("scan.name")}>
            <input type="text" value={item.name || ""}
              onChange={(e) => update(idx, { name: e.target.value })} />
          </Field>
          <Field label={t("scan.quantity")}>
            <input type="number" step="any" value={item.quantity}
              onChange={(e) => update(idx, { quantity: Number(e.target.value) })} />
          </Field>
          <Field label={t("scan.avgCost")}>
            <input type="number" step="any" value={item.avgCost ?? ""}
              placeholder={item.avgCost == null ? t("scan.avgCostHint") : ""}
              onChange={(e) => {
                const v = e.target.value;
                update(idx, { avgCost: v === "" ? null : Number(v) });
              }} />
          </Field>
          <Field label={t("scan.currency")}>
            <select value={item.currency}
              onChange={(e) => update(idx, { currency: e.target.value as ParsedAssetTrade["currency"] })}>
              <option value="USD">USD</option>
              <option value="KRW">KRW</option>
              <option value="EUR">EUR</option>
              <option value="JPY">JPY</option>
              <option value="GBP">GBP</option>
            </select>
          </Field>
        </div>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="scan-field">
      <label className="scan-field-label">{label}</label>
      {children}
    </div>
  );
}
