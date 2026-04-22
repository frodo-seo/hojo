import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Asset, AssetKind, Currency } from "../types";
import { addAsset, deleteAsset, getAssets, updateAsset } from "../lib/db";
import { valuePortfolio, searchTicker, valuationsInBase, valuePortfolioFromCacheSync, valuationsInBaseFromCacheSync, type AssetValuation, type BaseValued, type TickerSearchResult } from "../lib/prices";
import { formatCurrency, formatPercent } from "../lib/format";
import { useBaseCurrency } from "../lib/settings";
import PortfolioPie from "../components/PortfolioPie";
import { colorForIndex } from "../lib/palette";

type Props = {
  refresh: number;
  onBack: () => void;
};

const KINDS: AssetKind[] = ["stock", "crypto", "commodity"];

type CommodityPreset = { ticker: string; nameKey: string; unitHint: string };
const COMMODITY_PRESETS: CommodityPreset[] = [
  { ticker: "GC=F", nameKey: "assets.commodityGold", unitHint: "oz" },
  { ticker: "SI=F", nameKey: "assets.commoditySilver", unitHint: "oz" },
  { ticker: "PL=F", nameKey: "assets.commodityPlatinum", unitHint: "oz" },
];

const CURRENCIES: Currency[] = ["USD", "KRW", "EUR", "JPY", "GBP"];

type FormState = {
  id: string | null;
  kind: AssetKind;
  ticker: string;
  name: string;
  quantity: string;
  avgCost: string;
  currency: Currency;
  note: string;
  externalId?: string;
  exchange?: string;
};

export default function Assets({ refresh, onBack }: Props) {
  const { t } = useTranslation();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [valuations, setValuations] = useState<AssetValuation[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState | null>(null);
  const [searchResults, setSearchResults] = useState<TickerSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [based, setBased] = useState<BaseValued[]>([]);
  const baseCcy = useBaseCurrency();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await getAssets();
      if (cancelled) return;
      setAssets(list);
      if (list.length === 0) {
        setValuations([]);
        setBased([]);
        setLoading(false);
        return;
      }
      const cachedVs = valuePortfolioFromCacheSync(list);
      setValuations(cachedVs);
      setBased(valuationsInBaseFromCacheSync(cachedVs, baseCcy));
      setLoading(true);
      const vs = await valuePortfolio(list);
      if (cancelled) return;
      setValuations(vs);
      const fresh = await valuationsInBase(vs, baseCcy);
      if (cancelled) return;
      setBased(fresh);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [refresh, baseCcy]);

  const totals = useMemo(() => {
    let cost = 0;
    let value = 0;
    let hasMissingValue = false;
    let hasMissingFx = false;
    for (const b of based) {
      if (b.costBase !== null) cost += b.costBase;
      if (b.valueBase !== null) value += b.valueBase;
      if (b.valuation.marketValue === null) hasMissingValue = true;
      else if (b.valueBase === null) hasMissingFx = true;
    }
    return { cost, value, hasMissingValue, hasMissingFx };
  }, [based]);

  const pieSlices = useMemo(() => {
    return based
      .map((b, i) => ({
        id: b.valuation.asset.id,
        label: b.valuation.asset.ticker,
        value: b.valueBase ?? 0,
        color: colorForIndex(i),
      }))
      .filter((s) => s.value > 0);
  }, [based]);

  async function handleSave() {
    if (!form) return;
    const qty = Number(form.quantity);
    const avg = Number(form.avgCost);
    if (!form.ticker.trim() || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(avg) || avg < 0) return;

    const asset: Asset = {
      id: form.id ?? crypto.randomUUID(),
      kind: form.kind,
      ticker: form.ticker.trim().toUpperCase(),
      name: form.name.trim() || form.ticker.trim().toUpperCase(),
      quantity: qty,
      avgCost: avg,
      currency: form.currency,
      externalId: form.externalId,
      exchange: form.exchange,
      note: form.note.trim() || undefined,
      createdAt: form.id ? (assets.find((a) => a.id === form.id)?.createdAt ?? new Date().toISOString()) : new Date().toISOString(),
    };

    if (form.id) await updateAsset(asset);
    else await addAsset(asset);

    const list = await getAssets();
    setAssets(list);
    const vs = await valuePortfolio(list);
    setValuations(vs);
    setBased(await valuationsInBase(vs, baseCcy));
    setForm(null);
  }

  async function handleDelete(id: string) {
    if (!confirm(t("assets.confirmDelete"))) return;
    await deleteAsset(id);
    const list = await getAssets();
    setAssets(list);
    const vs = await valuePortfolio(list);
    setValuations(vs);
    setBased(await valuationsInBase(vs, baseCcy));
  }

  function openEdit(a: Asset) {
    setForm({
      id: a.id,
      kind: a.kind,
      ticker: a.ticker,
      name: a.name,
      quantity: String(a.quantity),
      avgCost: String(a.avgCost),
      currency: a.currency,
      note: a.note ?? "",
      externalId: a.externalId,
      exchange: a.exchange,
    });
    setSearchResults([]);
    setSearchOpen(false);
  }

  const formKind = form?.kind;
  const formTicker = form?.ticker;
  useEffect(() => {
    if (formKind !== "stock" && formKind !== "crypto") {
      setSearchResults([]);
      return;
    }
    const q = (formTicker ?? "").trim();
    if (q.length < 1 || !searchOpen) {
      setSearchResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const handle = setTimeout(async () => {
      try {
        const results = await searchTicker(q, formKind);
        if (!cancelled) setSearchResults(results);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [formTicker, formKind, searchOpen]);

  function pickSearchResult(r: TickerSearchResult) {
    if (!form) return;
    setForm({
      ...form,
      ticker: r.ticker,
      name: r.name,
      externalId: r.externalId,
      exchange: r.exchange,
    });
    setSearchOpen(false);
    setSearchResults([]);
  }

  const tickerPlaceholder =
    form?.kind === "crypto"
      ? t("assets.tickerPlaceholderCrypto")
      : t("assets.tickerPlaceholderStock");

  return (
    <div className="screen assets-screen">
      <header className="add-header">
        <button className="back-btn" onClick={onBack}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M11 4L6 9l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1>{t("assets.title")}</h1>
      </header>

      <p className="section-desc" style={{ marginBottom: 16 }}>{t("assets.subtitle")}</p>

      {based.length > 0 && pieSlices.length > 0 && (() => {
        const { cost, value, hasMissingValue, hasMissingFx } = totals;
        const gain = value - cost;
        const pct = cost > 0 ? gain / cost : 0;
        const gainClass = gain >= 0 ? "positive" : "negative";
        const pieTotal = pieSlices.reduce((s, x) => s + x.value, 0);
        return (
          <div className="assets-total-card">
            <div className="assets-total-head">
              <span className="assets-total-label">{t("assets.netWorth")} · {baseCcy}</span>
            </div>
            <div className="assets-total-value">{formatCurrency(value, baseCcy)}</div>
            <div className="assets-total-row">
              <span>{t("assets.totalCost")}: {formatCurrency(cost, baseCcy)}</span>
              <span className={gainClass}>
                {gain >= 0 ? "+" : ""}{formatCurrency(gain, baseCcy)} ({formatPercent(pct)})
              </span>
            </div>
            {(hasMissingValue || hasMissingFx) && (
              <p className="assets-total-note">
                {hasMissingFx ? t("assets.fxMissing") : t("assets.priceMissing")}
              </p>
            )}
            <div className="portfolio-pie-wrap">
              <PortfolioPie slices={pieSlices} />
              <ul className="portfolio-legend">
                {pieSlices.map((s) => (
                  <li key={s.id}>
                    <span className="legend-dot" style={{ background: s.color }} />
                    <span className="legend-label">{s.label}</span>
                    <span className="legend-pct">{formatPercent(s.value / pieTotal)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );
      })()}

      {assets.length === 0 && !form && (
        <div className="empty">
          <p>{t("assets.emptyTitle")}</p>
          <p className="empty-sub">{t("assets.emptySub")}</p>
        </div>
      )}

      {loading && assets.length > 0 && (
        <p className="section-desc">{t("assets.loading")}</p>
      )}

      {valuations.length > 0 && (
        <div className="asset-list">
          {valuations.map((v) => {
            const gain = v.gain;
            const gainClass = gain === null ? "" : gain >= 0 ? "positive" : "negative";
            return (
              <button key={v.asset.id} className="asset-row" onClick={() => openEdit(v.asset)}>
                <div className="asset-row-head">
                  <span className="asset-ticker">{v.asset.ticker}</span>
                  <span className="asset-name">{v.asset.name}</span>
                </div>
                <div className="asset-row-body">
                  <div className="asset-row-col">
                    <span className="asset-row-label">{t("assets.quantityLabel")}</span>
                    <span>{v.asset.quantity.toLocaleString()}</span>
                  </div>
                  <div className="asset-row-col">
                    <span className="asset-row-label">{t("assets.avgCostLabel")}</span>
                    <span>{formatCurrency(v.asset.avgCost, v.asset.currency)}</span>
                  </div>
                  <div className="asset-row-col">
                    <span className="asset-row-label">{t("assets.currentPrice")}</span>
                    <span>
                      {v.quote
                        ? formatCurrency(v.quote.price, v.quote.currency)
                        : t("assets.unavailable")}
                    </span>
                  </div>
                  <div className="asset-row-col">
                    <span className="asset-row-label">{t("assets.marketValue")}</span>
                    <span>
                      {v.marketValue !== null
                        ? formatCurrency(v.marketValue, v.asset.currency)
                        : "—"}
                    </span>
                  </div>
                  {gain !== null && (
                    <div className={`asset-row-col ${gainClass}`}>
                      <span className="asset-row-label">{t("assets.totalGain")}</span>
                      <span>
                        {v.gainPct !== null
                          ? formatPercent(v.gainPct)
                          : `${gain >= 0 ? "+" : ""}${formatCurrency(gain, v.asset.currency)}`}
                      </span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {form ? (
        <div className="asset-form">
          <div className="asset-form-kinds">
            {KINDS.map((k) => (
              <button
                key={k}
                className={`asset-kind-btn ${form.kind === k ? "on" : ""}`}
                onClick={() => {
                  if (k === "commodity") {
                    const preset = COMMODITY_PRESETS[0];
                    setForm({
                      ...form,
                      kind: k,
                      ticker: form.kind === "commodity" ? form.ticker : preset.ticker,
                      name: form.kind === "commodity" ? form.name : t(preset.nameKey),
                      currency: "USD",
                      externalId: undefined,
                      exchange: undefined,
                    });
                  } else {
                    setForm({ ...form, kind: k });
                  }
                }}
              >
                {t(`assets.kind${k.charAt(0).toUpperCase()}${k.slice(1)}`)}
              </button>
            ))}
          </div>

          {form.kind === "commodity" && (
            <>
              <label className="form-label">{t("assets.commodityPreset")}</label>
              <select
                className="form-input"
                value={form.ticker || COMMODITY_PRESETS[0].ticker}
                onChange={(e) => {
                  const preset = COMMODITY_PRESETS.find((p) => p.ticker === e.target.value);
                  if (!preset) return;
                  setForm({
                    ...form,
                    ticker: preset.ticker,
                    name: form.name || t(preset.nameKey),
                    currency: "USD",
                  });
                }}
              >
                {COMMODITY_PRESETS.map((p) => (
                  <option key={p.ticker} value={p.ticker}>
                    {t(p.nameKey)} ({p.ticker})
                  </option>
                ))}
              </select>
              <p className="section-desc" style={{ marginTop: 4 }}>
                {t("assets.commodityUnitHint", { unit: "oz" })}
              </p>
            </>
          )}

          {form.kind !== "commodity" && (
          <>
          <label className="form-label">{t("assets.tickerLabel")}</label>
          <div className="ticker-search">
            <input
              className="form-input"
              placeholder={tickerPlaceholder}
              value={form.ticker}
              onChange={(e) => {
                setForm({ ...form, ticker: e.target.value, externalId: undefined, exchange: undefined });
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
              autoCapitalize="characters"
              spellCheck={false}
            />
            {searchOpen && (form.kind === "stock" || form.kind === "crypto") && form.ticker.trim() && (
              <div className="ticker-search-dropdown">
                {searching && <div className="ticker-search-status">{t("assets.searching")}</div>}
                {!searching && searchResults.length === 0 && (
                  <div className="ticker-search-status">{t("assets.searchNoResults")}</div>
                )}
                {searchResults.map((r) => (
                  <button
                    key={`${r.ticker}-${r.externalId ?? r.exchange ?? ""}`}
                    type="button"
                    className="ticker-search-item"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickSearchResult(r)}
                  >
                    <span className="ticker-search-symbol">{r.ticker}</span>
                    <span className="ticker-search-name">{r.name}</span>
                    {r.exchange && <span className="ticker-search-meta">{r.exchange}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          </>
          )}

          <label className="form-label">{t("assets.nameLabel")}</label>
          <input
            className="form-input"
            placeholder={t("assets.namePlaceholder")}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />

          <div className="asset-form-row">
            <div className="asset-form-col">
              <label className="form-label">{t("assets.quantityLabel")}</label>
              <input
                className="form-input"
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
            </div>
            <div className="asset-form-col">
              <label className="form-label">{t("assets.avgCostLabel")}</label>
              <input
                className="form-input"
                type="number"
                inputMode="decimal"
                placeholder="0"
                value={form.avgCost}
                onChange={(e) => setForm({ ...form, avgCost: e.target.value })}
              />
            </div>
          </div>

          <label className="form-label">{t("assets.currencyLabel")}</label>
          <select
            className="form-input"
            value={form.currency}
            onChange={(e) => setForm({ ...form, currency: e.target.value as Currency })}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <label className="form-label">{t("assets.noteLabel")}</label>
          <input
            className="form-input"
            placeholder={t("assets.notePlaceholder")}
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />

          <div className="asset-form-actions">
            <button className="btn-ghost" onClick={() => setForm(null)}>
              {t("common.cancel")}
            </button>
            <button className="save-btn small" onClick={handleSave}>
              {form.id ? t("assets.editButton") : t("assets.addButton")}
            </button>
          </div>
          {form.id && (
            <button
              className="btn-danger-outline"
              onClick={() => { handleDelete(form.id!); setForm(null); }}
            >
              {t("common.delete")}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
