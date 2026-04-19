import { httpJson } from "./http";
import type { Asset, Currency } from "../types";

/**
 * BYOK-free price adapter.
 * - Stock: Yahoo Finance public chart endpoint (no key).
 * - Crypto: CoinGecko /coins/markets (no key).
 * - FX: exchangerate.host (no key).
 * 10-minute localStorage cache with stale-while-error fallback.
 */

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_PREFIX = "hojo.price.";

export interface PriceQuote {
  price: number;        // per-unit price
  currency: Currency;   // currency the price is quoted in
  asOf: number;         // epoch ms
}

type CacheEntry = PriceQuote & { stored: number };

function cacheGet(key: string): CacheEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as CacheEntry;
  } catch {
    return null;
  }
}

function cacheSet(key: string, q: PriceQuote) {
  try {
    const entry: CacheEntry = { ...q, stored: Date.now() };
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // ignore quota
  }
}

function fresh(entry: CacheEntry | null): boolean {
  return !!entry && Date.now() - entry.stored < CACHE_TTL_MS;
}

async function fetchStockQuote(ticker: string): Promise<PriceQuote> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
  const res = await httpJson<{
    chart?: {
      result?: Array<{
        meta?: {
          regularMarketPrice?: number;
          currency?: string;
        };
      }>;
      error?: { description?: string } | null;
    };
  }>(url);
  if (!res.ok) throw new Error(`Yahoo request failed (${res.status})`);
  const meta = res.data.chart?.result?.[0]?.meta;
  const price = meta?.regularMarketPrice;
  const currency = (meta?.currency || "USD").toUpperCase() as Currency;
  if (typeof price !== "number") throw new Error(`No price for ${ticker}`);
  return { price, currency, asOf: Date.now() };
}

// Common symbol → CoinGecko id overrides. Unknown symbols fall through to /coins/markets by symbol.
const CRYPTO_ID_HINT: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  XRP: "ripple",
  ADA: "cardano",
  DOGE: "dogecoin",
  DOT: "polkadot",
  AVAX: "avalanche-2",
  MATIC: "matic-network",
  LINK: "chainlink",
  LTC: "litecoin",
  BCH: "bitcoin-cash",
  USDT: "tether",
  USDC: "usd-coin",
};

async function fetchCryptoQuote(ticker: string, vs: Currency, externalId?: string): Promise<PriceQuote> {
  const upper = ticker.toUpperCase();
  const vsLower = vs.toLowerCase();
  const hintId = externalId || CRYPTO_ID_HINT[upper];

  if (hintId) {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${hintId}&vs_currencies=${vsLower}`;
    const res = await httpJson<Record<string, Record<string, number>>>(url);
    if (res.ok) {
      const price = res.data[hintId]?.[vsLower];
      if (typeof price === "number") {
        return { price, currency: vs, asOf: Date.now() };
      }
    }
  }

  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=${vsLower}&symbols=${encodeURIComponent(upper.toLowerCase())}`;
  const res = await httpJson<Array<{ current_price?: number }>>(url);
  if (!res.ok) throw new Error(`CoinGecko request failed (${res.status})`);
  const price = res.data?.[0]?.current_price;
  if (typeof price !== "number") throw new Error(`No price for ${ticker}`);
  return { price, currency: vs, asOf: Date.now() };
}

async function fetchFxRate(base: Currency, quote: Currency): Promise<number> {
  if (base === quote) return 1;
  // Primary: Frankfurter (ECB data, no key, all our supported currencies).
  const primary = `https://api.frankfurter.app/latest?from=${base}&to=${quote}`;
  const res = await httpJson<{ rates?: Record<string, number> }>(primary);
  if (res.ok) {
    const rate = res.data.rates?.[quote];
    if (typeof rate === "number") return rate;
  }
  // Fallback: open.er-api.com (broader coverage, daily-updated).
  const fallback = `https://open.er-api.com/v6/latest/${base}`;
  const res2 = await httpJson<{ rates?: Record<string, number> }>(fallback);
  if (res2.ok) {
    const rate = res2.data.rates?.[quote];
    if (typeof rate === "number") return rate;
  }
  throw new Error(`No FX rate ${base}→${quote}`);
}

async function getQuote(asset: Asset): Promise<PriceQuote | null> {
  if (asset.kind === "cash" || asset.kind === "other") {
    return { price: asset.avgCost, currency: asset.currency, asOf: Date.now() };
  }

  const key = `${asset.kind}:${asset.ticker.toUpperCase()}`;
  const cached = cacheGet(key);
  if (cached && fresh(cached)) return cached;

  try {
    let quote: PriceQuote;
    if (asset.kind === "stock" || asset.kind === "commodity") {
      quote = await fetchStockQuote(asset.ticker);
    } else {
      quote = await fetchCryptoQuote(asset.ticker, asset.currency, asset.externalId);
    }
    cacheSet(key, quote);
    return quote;
  } catch {
    return cached ?? null;
  }
}

/** Convert a quote's native currency to `target`. Returns null if FX lookup fails. */
async function convert(
  amount: number,
  from: Currency,
  to: Currency,
): Promise<number | null> {
  if (from === to) return amount;
  const key = `fx:${from}:${to}`;
  const cached = cacheGet(key);
  if (cached && fresh(cached)) return amount * cached.price;
  try {
    const rate = await fetchFxRate(from, to);
    cacheSet(key, { price: rate, currency: to, asOf: Date.now() });
    return amount * rate;
  } catch {
    return cached ? amount * cached.price : null;
  }
}

export interface AssetValuation {
  asset: Asset;
  quote: PriceQuote | null;
  marketValue: number | null; // in asset.currency
  cost: number;               // in asset.currency
  gain: number | null;        // marketValue - cost
  gainPct: number | null;     // gain / cost
}

async function valueAsset(asset: Asset): Promise<AssetValuation> {
  const quote = await getQuote(asset);
  const cost = asset.quantity * asset.avgCost;
  let marketValue: number | null = null;

  if (quote) {
    const priceInAssetCcy =
      quote.currency === asset.currency
        ? quote.price
        : await convert(quote.price, quote.currency, asset.currency);
    if (priceInAssetCcy !== null) {
      marketValue = asset.quantity * priceInAssetCcy;
    }
  }

  const gain = marketValue !== null ? marketValue - cost : null;
  const gainPct = gain !== null && cost > 0 ? gain / cost : null;

  return { asset, quote, marketValue, cost, gain, gainPct };
}

export interface TickerSearchResult {
  ticker: string;      // display symbol (uppercase for stock/crypto)
  name: string;        // human-readable name
  exchange?: string;   // e.g. "NASDAQ", "KRX"
  externalId?: string; // provider-specific id (CoinGecko coin id)
}

export async function searchTicker(
  query: string,
  kind: "stock" | "crypto",
): Promise<TickerSearchResult[]> {
  const q = query.trim();
  if (q.length < 1) return [];

  if (kind === "stock") {
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=8&newsCount=0`;
    const res = await httpJson<{
      quotes?: Array<{
        symbol?: string;
        shortname?: string;
        longname?: string;
        exchange?: string;
        quoteType?: string;
      }>;
    }>(url);
    if (!res.ok) return [];
    const quotes = res.data.quotes ?? [];
    return quotes
      .filter((q) => q.symbol && (q.quoteType === "EQUITY" || q.quoteType === "ETF" || q.quoteType === "MUTUALFUND" || q.quoteType === "INDEX"))
      .slice(0, 8)
      .map((q) => ({
        ticker: q.symbol!.toUpperCase(),
        name: q.longname || q.shortname || q.symbol!,
        exchange: q.exchange,
      }));
  }

  // crypto
  const url = `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(q)}`;
  const res = await httpJson<{
    coins?: Array<{
      id?: string;
      symbol?: string;
      name?: string;
      market_cap_rank?: number | null;
    }>;
  }>(url);
  if (!res.ok) return [];
  const coins = res.data.coins ?? [];
  return coins
    .filter((c) => c.id && c.symbol && c.name)
    .slice(0, 8)
    .map((c) => ({
      ticker: c.symbol!.toUpperCase(),
      name: c.name!,
      externalId: c.id,
    }));
}

export async function valuePortfolio(assets: Asset[]): Promise<AssetValuation[]> {
  return Promise.all(assets.map(valueAsset));
}

export interface BaseValued {
  valuation: AssetValuation;
  valueBase: number | null; // marketValue in base currency
  costBase: number | null;  // cost in base currency
}

export async function valuationsInBase(
  valuations: AssetValuation[],
  base: Currency,
): Promise<BaseValued[]> {
  return Promise.all(
    valuations.map(async (v) => {
      const valueBase =
        v.marketValue === null
          ? null
          : v.asset.currency === base
          ? v.marketValue
          : await convert(v.marketValue, v.asset.currency, base);
      const costBase =
        v.asset.currency === base
          ? v.cost
          : await convert(v.cost, v.asset.currency, base);
      return { valuation: v, valueBase, costBase };
    }),
  );
}

/** Serialize portfolio state for AI prompts. Language-agnostic numbers + tickers. */
export function portfolioToText(valuations: AssetValuation[]): string {
  if (valuations.length === 0) return "";
  const byCcy = new Map<Currency, { cost: number; value: number }>();
  const lines: string[] = [];
  for (const v of valuations) {
    const ccy = v.asset.currency;
    const entry = byCcy.get(ccy) ?? { cost: 0, value: 0 };
    entry.cost += v.cost;
    if (v.marketValue !== null) entry.value += v.marketValue;
    byCcy.set(ccy, entry);
    const mv = v.marketValue !== null ? v.marketValue.toFixed(2) : "?";
    const g = v.gain !== null ? `${v.gain >= 0 ? "+" : ""}${v.gain.toFixed(2)}` : "?";
    const pct = v.gainPct !== null ? ` (${(v.gainPct * 100).toFixed(2)}%)` : "";
    lines.push(`- ${v.asset.ticker} (${v.asset.kind}, ${ccy}) qty=${v.asset.quantity} cost=${v.cost.toFixed(2)} mv=${mv} gain=${g}${pct}`);
  }
  const totals = [...byCcy.entries()].map(([ccy, t]) => {
    const gain = t.value - t.cost;
    const pct = t.cost > 0 ? (gain / t.cost) * 100 : 0;
    return `  ${ccy}: cost=${t.cost.toFixed(2)} value=${t.value.toFixed(2)} gain=${gain >= 0 ? "+" : ""}${gain.toFixed(2)} (${pct.toFixed(2)}%)`;
  });
  return `Portfolio totals:\n${totals.join("\n")}\nHoldings:\n${lines.join("\n")}`;
}
