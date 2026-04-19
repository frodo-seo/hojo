import { getApiKeys } from "./apiKeys";
import { parseNotification } from "./notifParse";
import { addPendingNotif, hasNotifKey, type PendingNotif } from "./db";

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

/**
 * 단일 알림 처리:
 * 1. sbn.key dedup
 * 2. 키워드 1차 필터
 * 3. Haiku 파싱
 * 4. is_payment=true면 대기열 저장
 */
export async function handleNotification(payload: NotificationPayload): Promise<void> {
  if (!payload.key) return;

  if (await hasNotifKey(payload.key)) return;
  if (!isLikelyPayment(payload.title, payload.body)) return;

  const keys = await getApiKeys();
  if (!keys.anthropic) return;

  let parsed;
  try {
    parsed = await parseNotification(payload.title, payload.body, payload.pkg, keys.anthropic);
  } catch (err) {
    console.warn("[hojo] notif parse failed", err);
    return;
  }

  if (!parsed.is_payment || !parsed.amount || parsed.amount <= 0) return;

  const notif: PendingNotif = {
    id: payload.key,
    pkg: payload.pkg,
    title: payload.title,
    body: payload.body,
    postedAt: payload.postedAt,
    parsedAt: new Date().toISOString(),
    status: "pending",
    amount: parsed.amount,
    store: parsed.store,
    categoryId: parsed.category ?? undefined,
    date: parsed.date || toDate(payload.postedAt),
  };

  await addPendingNotif(notif);
}
