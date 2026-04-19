import i18n from "./i18n";

function locale(): string {
  const lang = (i18n.resolvedLanguage || i18n.language || "en").split("-")[0];
  return lang === "ko" ? "ko-KR" : "en-US";
}

export function formatMoney(amount: number): string {
  const formatted = amount.toLocaleString(locale());
  return i18n.t("format.currency", { amount: formatted });
}

/** Currency-aware formatter for multi-ccy asset values. */
export function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(locale(), {
      style: "currency",
      currency,
      maximumFractionDigits: currency === "KRW" || currency === "JPY" ? 0 : 2,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString(locale())} ${currency}`;
  }
}

export function formatPercent(pct: number): string {
  const sign = pct > 0 ? "+" : "";
  return `${sign}${(pct * 100).toFixed(2)}%`;
}

/** 숫자 문자열에서 숫자만 남기고 천 단위 콤마 포맷. 빈 입력은 "" 반환. */
export function formatAmountInput(raw: string): string {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return "";
  const n = parseInt(digits, 10);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString(locale());
}

export function parseAmountInput(formatted: string): number {
  const digits = formatted.replace(/[^\d]/g, "");
  if (!digits) return 0;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n : 0;
}

const KO_DIGITS = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
const KO_SMALL_UNITS = ["", "십", "백", "천"];
const KO_BIG_UNITS = ["", "만", "억", "조"];

function koreanChunk(n: number): string {
  let out = "";
  const digits = String(n).padStart(4, "0").split("").map(Number);
  for (let i = 0; i < 4; i++) {
    const d = digits[i];
    if (d === 0) continue;
    const unit = KO_SMALL_UNITS[3 - i];
    const numeral = d === 1 && unit ? "" : KO_DIGITS[d];
    out += numeral + unit;
  }
  return out;
}

/** 한국어 locale에서만 의미 있는 힌트. 영문 locale에서는 빈 문자열 반환. */
export function amountKoreanWord(n: number): string {
  if (n <= 0) return "";
  const lang = (i18n.resolvedLanguage || i18n.language || "en").split("-")[0];
  if (lang !== "ko") return "";
  let remaining = n;
  const chunks: string[] = [];
  for (let i = 0; i < KO_BIG_UNITS.length && remaining > 0; i++) {
    const chunk = remaining % 10000;
    if (chunk > 0) chunks.unshift(koreanChunk(chunk) + KO_BIG_UNITS[i]);
    remaining = Math.floor(remaining / 10000);
  }
  return chunks.join("") + "원";
}

const EN_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const EN_MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const weekdays = i18n.t("format.weekdays", { returnObjects: true }) as string[];
  const weekday = weekdays[d.getDay()];
  const lang = (i18n.resolvedLanguage || i18n.language || "en").split("-")[0];
  const monthName = lang === "ko" ? String(month) : EN_MONTHS_SHORT[d.getMonth()];
  return i18n.t("format.dateWithWeekday", { month, day, monthName, weekday });
}

export function getMonthLabel(month: string): string {
  const [y, m] = month.split("-");
  const monthNum = parseInt(m);
  const lang = (i18n.resolvedLanguage || i18n.language || "en").split("-")[0];
  const monthName = lang === "ko" ? String(monthNum) : EN_MONTHS[monthNum - 1];
  return i18n.t("format.monthLabel", { year: y, month: monthNum, monthName });
}

export function today(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function currentMonth(): string {
  return today().slice(0, 7);
}

export function prevMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function nextMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
