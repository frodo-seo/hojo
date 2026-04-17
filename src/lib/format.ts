export function formatMoney(amount: number): string {
  return amount.toLocaleString("ko-KR") + "원";
}

/** 숫자 문자열에서 숫자만 남기고 천 단위 콤마 포맷. 빈 입력은 "" 반환. */
export function formatAmountInput(raw: string): string {
  const digits = raw.replace(/[^\d]/g, "");
  if (!digits) return "";
  const n = parseInt(digits, 10);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("ko-KR");
}

/** 콤마 포함 문자열 → 숫자. 실패 시 0. */
export function parseAmountInput(formatted: string): number {
  const digits = formatted.replace(/[^\d]/g, "");
  if (!digits) return 0;
  const n = parseInt(digits, 10);
  return Number.isFinite(n) ? n : 0;
}

/** 금액 한글 요약 (예: 1234567 → "약 123만원"). 0이면 "". */
export function amountKoreanHint(n: number): string {
  if (n <= 0) return "";
  const eok = Math.floor(n / 100_000_000);
  const man = Math.floor((n % 100_000_000) / 10_000);
  const rest = n % 10_000;
  const parts: string[] = [];
  if (eok) parts.push(`${eok.toLocaleString("ko-KR")}억`);
  if (man) parts.push(`${man.toLocaleString("ko-KR")}만`);
  if (!eok && !man && rest) parts.push(`${rest.toLocaleString("ko-KR")}`);
  return parts.length ? parts.join(" ") + "원" : "";
}

/** 1000000 → "백만원" 같은 순 한글 표기. 큰 자릿수는 힌트 포함. */
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
    // 일십/일백/일천은 생략, 일만은 유지
    const numeral = d === 1 && unit ? "" : KO_DIGITS[d];
    out += numeral + unit;
  }
  return out;
}

export function amountKoreanWord(n: number): string {
  if (n <= 0) return "";
  let remaining = n;
  const chunks: string[] = [];
  for (let i = 0; i < KO_BIG_UNITS.length && remaining > 0; i++) {
    const chunk = remaining % 10000;
    if (chunk > 0) chunks.unshift(koreanChunk(chunk) + KO_BIG_UNITS[i]);
    remaining = Math.floor(remaining / 10000);
  }
  return chunks.join("") + "원";
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  const weekday = weekdays[d.getDay()];
  return `${month}월 ${day}일 (${weekday})`;
}

export function getMonthLabel(month: string): string {
  const [y, m] = month.split("-");
  return `${y}년 ${parseInt(m)}월`;
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
