export type ClaudeUsage = {
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
};

const PRICE: Record<
  string,
  { in: number; out: number; cache_write: number; cache_read: number }
> = {
  "claude-sonnet-4-6": { in: 3, out: 15, cache_write: 3.75, cache_read: 0.3 },
  "claude-opus-4-6": { in: 15, out: 75, cache_write: 18.75, cache_read: 1.5 },
  "claude-haiku-4-5": { in: 1, out: 5, cache_write: 1.25, cache_read: 0.1 },
};
const USD_KRW = 1380;

export function usageCost(u: ClaudeUsage): { usd: number; krw: number } {
  const p = PRICE[u.model];
  if (!p) return { usd: 0, krw: 0 };
  const usd =
    (u.input_tokens * p.in +
      u.output_tokens * p.out +
      (u.cache_creation_input_tokens ?? 0) * p.cache_write +
      (u.cache_read_input_tokens ?? 0) * p.cache_read) /
    1_000_000;
  return { usd, krw: usd * USD_KRW };
}

type LogEntry = {
  label: string;
  usage: ClaudeUsage;
  at: number;
  krw: number;
};

const KEY = "sobi-ilgi:usage-log";
const LIMIT = 100;

export function logUsage(label: string, usage: ClaudeUsage) {
  const { usd, krw } = usageCost(usage);
  // eslint-disable-next-line no-console
  console.log(
    `[usage:${label}] ${usage.model} in=${usage.input_tokens} out=${usage.output_tokens} ` +
      `$${usd.toFixed(5)} (${Math.round(krw)}원)`,
  );
  try {
    const raw = localStorage.getItem(KEY);
    const log = raw ? (JSON.parse(raw) as LogEntry[]) : [];
    log.unshift({ label, usage, at: Date.now(), krw });
    if (log.length > LIMIT) log.length = LIMIT;
    localStorage.setItem(KEY, JSON.stringify(log));
  } catch {
    // ignore
  }
}

export function readUsageLog(): LogEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LogEntry[]) : [];
  } catch {
    return [];
  }
}

export function usageTotals() {
  const log = readUsageLog();
  return log.reduce(
    (acc, e) => {
      acc.calls += 1;
      acc.input += e.usage.input_tokens;
      acc.output += e.usage.output_tokens;
      acc.krw += e.krw;
      return acc;
    },
    { calls: 0, input: 0, output: 0, krw: 0 },
  );
}

export function clearUsageLog() {
  localStorage.removeItem(KEY);
}
