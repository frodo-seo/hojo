import { getApiKeys } from "./apiKeys";
import { parseNotification } from "./notifParse";
import { addPendingNotif, hasNotifKey, hasRecentNotifByContent, type PendingNotif } from "./db";
import { fetchFxRate } from "./prices";
import { getBaseCurrency } from "./settings";
import type { Currency } from "../types";

const SUPPORTED_CURRENCIES: Currency[] = ["USD", "KRW", "EUR", "JPY", "GBP"];

const DUP_WINDOW_MS = 10 * 1000; // 10초 내 같은 pkg/금액/가맹점은 중복으로 간주

// Haiku 429/5xx를 맞으면 일정 시간 파싱을 전면 중단해서 크레딧 소진을 막는다.
const RATE_LIMIT_COOLDOWN_MS = 5 * 60 * 1000;
let rateLimitedUntil = 0;

function isApiCooldown(): boolean {
  return Date.now() < rateLimitedUntil;
}

function markApiCooldown(): void {
  rateLimitedUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
}

interface NotificationPayload {
  pkg: string;
  title: string;
  body: string;
  postedAt: number;
  key: string;
}

// 프로모·한도 안내 제외용 1차 키워드 필터.
// 하나라도 포함되면 Haiku로 전달. 아니면 drop.
const PAYMENT_KEYWORDS = [
  "승인", "결제", "사용", "출금", "이체", "송금", "입금", "카드",
  "원", "₩",
  "approved", "paid", "payment", "charge",
];

function isLikelyPayment(title: string, body: string): boolean {
  const text = `${title} ${body}`;
  return PAYMENT_KEYWORDS.some((k) => text.includes(k));
}

function toDate(postedAt: number): string {
  const d = new Date(postedAt);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildFailedNotif(payload: NotificationPayload, notifId: string): PendingNotif {
  return {
    id: notifId,
    pkg: payload.pkg,
    title: payload.title,
    body: payload.body,
    postedAt: payload.postedAt,
    parsedAt: new Date().toISOString(),
    status: "failed",
    amount: 0,
    date: toDate(payload.postedAt),
  };
}

/**
 * 단일 알림 처리:
 * 1. sbn.key dedup
 * 2. 키워드 1차 필터
 * 3. Haiku 파싱
 * 4. is_payment=true면 대기열 저장
 */
export async function handleNotification(payload: NotificationPayload): Promise<void> {
  if (!payload.key) return;

  const notifId = `${payload.key}:${payload.postedAt}`;
  if (await hasNotifKey(notifId)) return;
  if (!isLikelyPayment(payload.title, payload.body)) return;

  const keys = await getApiKeys();
  if (!keys.anthropic) return;

  // 최근 429/5xx가 있었으면 파싱을 건너뛰고 failed로 마크해 무한 재호출을 막는다.
  if (isApiCooldown()) {
    await addPendingNotif(buildFailedNotif(payload, notifId));
    return;
  }

  let parsed;
  try {
    parsed = await parseNotification(payload.title, payload.body, payload.pkg, keys.anthropic);
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 429 || (typeof status === "number" && status >= 500)) {
      markApiCooldown();
    }
    console.warn("[hojo] notif parse failed", err);
    // 실패한 알림도 id로 기록해둬서 같은 알림이 다시 와도 재호출하지 않는다.
    try {
      await addPendingNotif(buildFailedNotif(payload, notifId));
    } catch (dbErr) {
      console.warn("[hojo] failed-notif save failed", dbErr);
    }
    return;
  }

  if (!parsed.is_payment || !parsed.amount || parsed.amount <= 0) return;

  let amount = parsed.amount;
  const baseCcy = getBaseCurrency();
  const rawCcy = (parsed.currency || "KRW").toUpperCase() as Currency;
  const parsedCcy: Currency = SUPPORTED_CURRENCIES.includes(rawCcy) ? rawCcy : "KRW";
  if (parsedCcy !== baseCcy) {
    try {
      const rate = await fetchFxRate(parsedCcy, baseCcy);
      amount = Math.round(amount * rate);
    } catch (err) {
      console.warn("[hojo] fx convert failed, keeping raw amount", err);
    }
  }

  if (await hasRecentNotifByContent(payload.pkg, amount, parsed.store, DUP_WINDOW_MS)) {
    return;
  }

  const notif: PendingNotif = {
    id: notifId,
    pkg: payload.pkg,
    title: payload.title,
    body: payload.body,
    postedAt: payload.postedAt,
    parsedAt: new Date().toISOString(),
    status: "pending",
    amount,
    store: parsed.store,
    categoryId: parsed.category ?? undefined,
    date: parsed.date || toDate(payload.postedAt),
  };

  await addPendingNotif(notif);
}
