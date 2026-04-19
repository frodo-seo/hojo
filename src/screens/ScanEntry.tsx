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
import { compressImage, parseExpenseFromText, parseFixedExpense, type ParsedReceipt, type ParsedFixedExpense } from "../lib/receipt";
import { parseIncome, parseFixedIncome, type ParsedIncome, type ParsedFixedIncome } from "../lib/incomeParse";
import { parseAssetTrade, type ParsedAssetTrade } from "../lib/assetParse";
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
  | { kind: "expense"; data: ParsedReceipt }
  | { kind: "income"; data: ParsedIncome }
  | { kind: "fixed_expense"; data: ParsedFixedExpense }
  | { kind: "fixed_income"; data: ParsedFixedIncome }
  | { kind: "asset_trade"; data: ParsedAssetTrade };

const KIND_KEYS: Exclude<ScanKind, "unknown">[] = [
  "expense",
  "income",
  "fixed_expense",
  "fixed_income",
  "asset_trade",
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
    case "expense": {
      const data = await parseExpenseFromText(cleaned, anthropicKey, hint);
      return { kind, data };
    }
    case "income": {
      const data = await parseIncome(cleaned, anthropicKey, hint);
      return { kind, data };
    }
    case "fixed_expense": {
      const data = await parseFixedExpense(cleaned, anthropicKey, hint);
      return { kind, data };
    }
    case "fixed_income": {
      const data = await parseFixedIncome(cleaned, anthropicKey, hint);
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
    case "expense": {
      const { data } = result;
      const date = data.date || today();
      const storeName = data.store || "";
      for (const item of data.items) {
        if (!item.category) continue;
        const tx: Transaction = {
          id: crypto.randomUUID(),
          type: "expense",
          amount: item.price,
          categoryId: item.category,
          memo: storeName ? `${storeName} — ${item.name}` : item.name,
          date,
          createdAt: now,
        };
        await addTransaction(tx);
      }
      return;
    }
    case "income": {
      const { data } = result;
      const tx: Transaction = {
        id: crypto.randomUUID(),
        type: "income",
        amount: data.amount,
        categoryId: data.category,
        memo: data.memo || data.source || "",
        date: data.date || today(),
        createdAt: now,
      };
      await addTransaction(tx);
      return;
    }
    case "fixed_income": {
      const { data } = result;
      const item: FixedIncome = {
        id: crypto.randomUUID(),
        name: data.name,
        amount: data.amount,
        categoryId: data.category,
      };
      await addFixedIncome(item);
      return;
    }
    case "fixed_expense": {
      const { data } = result;
      const item: FixedExpense = {
        id: crypto.randomUUID(),
        name: data.name,
        amount: data.amount,
        categoryId: data.categoryId,
        day: data.day,
      };
      await addFixedExpense(item);
      return;
    }
    case "asset_trade": {
      const { data } = result;
      if (data.avgCost == null) throw new Error(i18n.t("scan.avgCostRequired"));
      const asset: Asset = {
        id: crypto.randomUUID(),
        kind: data.kind,
        ticker: data.ticker,
        name: data.name || data.ticker,
        quantity: data.quantity,
        avgCost: data.avgCost,
        currency: data.currency,
        createdAt: now,
      };
      await addAsset(asset);
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

      {result.kind === "expense" && (
        <ExpensePreview data={result.data} onChange={(data) => setResult({ kind: "expense", data })} />
      )}
      {result.kind === "income" && (
        <IncomePreview data={result.data} onChange={(data) => setResult({ kind: "income", data })} />
      )}
      {result.kind === "fixed_expense" && (
        <FixedExpensePreview data={result.data} onChange={(data) => setResult({ kind: "fixed_expense", data })} />
      )}
      {result.kind === "fixed_income" && (
        <FixedIncomePreview data={result.data} onChange={(data) => setResult({ kind: "fixed_income", data })} />
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
    case "expense":
      return r.data.items.length > 0 && r.data.items.every((i) => !!i.category);
    case "income":
      return r.data.amount > 0;
    case "fixed_income":
      return r.data.amount > 0 && !!r.data.name;
    case "fixed_expense":
      return r.data.amount > 0 && !!r.data.name;
    case "asset_trade":
      return r.data.quantity > 0 && r.data.avgCost != null && r.data.avgCost > 0 && !!r.data.ticker;
  }
}

function ExpensePreview({ data, onChange }: { data: ParsedReceipt; onChange: (d: ParsedReceipt) => void }) {
  const { t } = useTranslation();
  return (
    <div className="scan-fields">
      <Field label={t("scan.store")}>
        <input
          type="text"
          value={data.store || ""}
          onChange={(e) => onChange({ ...data, store: e.target.value })}
        />
      </Field>
      <Field label={t("scan.date")}>
        <input
          type="date"
          value={data.date || today()}
          onChange={(e) => onChange({ ...data, date: e.target.value })}
        />
      </Field>
      <div className="scan-items">
        {data.items.map((item, idx) => (
          <div key={idx} className="scan-item-row">
            <input
              type="text"
              value={item.name}
              onChange={(e) => {
                const items = [...data.items];
                items[idx] = { ...item, name: e.target.value };
                onChange({ ...data, items });
              }}
            />
            <input
              type="number"
              value={item.price}
              onChange={(e) => {
                const items = [...data.items];
                items[idx] = { ...item, price: Number(e.target.value) };
                onChange({ ...data, items });
              }}
            />
            <select
              value={item.category || ""}
              onChange={(e) => {
                const items = [...data.items];
                items[idx] = { ...item, category: e.target.value || null };
                onChange({ ...data, items });
              }}
            >
              <option value="">{t("scan.pickCategory")}</option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>{categoryName(c.id)}</option>
              ))}
            </select>
            <button
              className="scan-item-remove"
              onClick={() => onChange({ ...data, items: data.items.filter((_, i) => i !== idx) })}
            >×</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function IncomePreview({ data, onChange }: { data: ParsedIncome; onChange: (d: ParsedIncome) => void }) {
  const { t } = useTranslation();
  return (
    <div className="scan-fields">
      <Field label={t("scan.amount")}>
        <input type="number" value={data.amount}
          onChange={(e) => onChange({ ...data, amount: Number(e.target.value) })} />
      </Field>
      <Field label={t("scan.category")}>
        <select value={data.category}
          onChange={(e) => onChange({ ...data, category: e.target.value as ParsedIncome["category"] })}>
          {INCOME_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>{categoryName(c.id)}</option>
          ))}
        </select>
      </Field>
      <Field label={t("scan.date")}>
        <input type="date" value={data.date || today()}
          onChange={(e) => onChange({ ...data, date: e.target.value })} />
      </Field>
      <Field label={t("scan.source")}>
        <input type="text" value={data.source || ""}
          onChange={(e) => onChange({ ...data, source: e.target.value })} />
      </Field>
    </div>
  );
}

function FixedIncomePreview({ data, onChange }: { data: ParsedFixedIncome; onChange: (d: ParsedFixedIncome) => void }) {
  const { t } = useTranslation();
  return (
    <div className="scan-fields">
      <Field label={t("scan.name")}>
        <input type="text" value={data.name}
          onChange={(e) => onChange({ ...data, name: e.target.value })} />
      </Field>
      <Field label={t("scan.monthlyAmount")}>
        <input type="number" value={data.amount}
          onChange={(e) => onChange({ ...data, amount: Number(e.target.value) })} />
      </Field>
      <Field label={t("scan.category")}>
        <select value={data.category}
          onChange={(e) => onChange({ ...data, category: e.target.value as ParsedFixedIncome["category"] })}>
          {INCOME_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>{categoryName(c.id)}</option>
          ))}
        </select>
      </Field>
    </div>
  );
}

function FixedExpensePreview({ data, onChange }: { data: ParsedFixedExpense; onChange: (d: ParsedFixedExpense) => void }) {
  const { t } = useTranslation();
  return (
    <div className="scan-fields">
      <Field label={t("scan.name")}>
        <input type="text" value={data.name}
          onChange={(e) => onChange({ ...data, name: e.target.value })} />
      </Field>
      <Field label={t("scan.monthlyAmount")}>
        <input type="number" value={data.amount}
          onChange={(e) => onChange({ ...data, amount: Number(e.target.value) })} />
      </Field>
      <Field label={t("scan.category")}>
        <select value={data.categoryId}
          onChange={(e) => onChange({ ...data, categoryId: e.target.value })}>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>{categoryName(c.id)}</option>
          ))}
        </select>
      </Field>
      <Field label={t("scan.dueDay")}>
        <input type="number" min={1} max={28} value={data.day}
          onChange={(e) => onChange({ ...data, day: Math.max(1, Math.min(28, Number(e.target.value))) })} />
      </Field>
    </div>
  );
}

function AssetPreview({ data, onChange }: { data: ParsedAssetTrade; onChange: (d: ParsedAssetTrade) => void }) {
  const { t } = useTranslation();
  return (
    <div className="scan-fields">
      <Field label={t("scan.assetKind")}>
        <select value={data.kind}
          onChange={(e) => onChange({ ...data, kind: e.target.value as ParsedAssetTrade["kind"] })}>
          <option value="stock">{t("scan.assetKindStock")}</option>
          <option value="crypto">{t("scan.assetKindCrypto")}</option>
          <option value="commodity">{t("scan.assetKindCommodity")}</option>
        </select>
      </Field>
      <Field label={t("scan.ticker")}>
        <input type="text" value={data.ticker}
          onChange={(e) => onChange({ ...data, ticker: e.target.value.toUpperCase() })} />
      </Field>
      <Field label={t("scan.name")}>
        <input type="text" value={data.name || ""}
          onChange={(e) => onChange({ ...data, name: e.target.value })} />
      </Field>
      <Field label={t("scan.quantity")}>
        <input type="number" step="any" value={data.quantity}
          onChange={(e) => onChange({ ...data, quantity: Number(e.target.value) })} />
      </Field>
      <Field label={t("scan.avgCost")}>
        <input type="number" step="any" value={data.avgCost ?? ""}
          placeholder={data.avgCost == null ? t("scan.avgCostHint") : ""}
          onChange={(e) => {
            const v = e.target.value;
            onChange({ ...data, avgCost: v === "" ? null : Number(v) });
          }} />
      </Field>
      <Field label={t("scan.currency")}>
        <select value={data.currency}
          onChange={(e) => onChange({ ...data, currency: e.target.value as ParsedAssetTrade["currency"] })}>
          <option value="USD">USD</option>
          <option value="KRW">KRW</option>
          <option value="EUR">EUR</option>
          <option value="JPY">JPY</option>
          <option value="GBP">GBP</option>
        </select>
      </Field>
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
