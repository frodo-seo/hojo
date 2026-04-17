/**
 * 매일 저녁 9시 "장부 펼치시옵소서" 알림.
 * - 권한 요청은 유저가 Settings에서 토글할 때만 진행.
 * - 스케줄링은 setTimeout 기반 (앱이 열려있거나 백그라운드에 있을 때만 동작).
 * - PWA/TWA 환경에서 SW push를 쓰려면 서버 인프라 필요 → MVP는 로컬 노티로 충분.
 */

const KEY_ENABLED = "reminder_enabled";
const KEY_LAST_FIRED = "reminder_last_fired";
const REMINDER_HOUR = 21;
const MESSAGES = [
  "전하, 오늘 장부를 펼치시옵소서.",
  "소신 호조, 전하의 오늘 장부를 기다리옵나이다.",
  "하루의 쓰임을 헤아리시옵소서.",
  "전하, 저녁 상소를 위해 오늘의 기록을 올려주시옵소서.",
];

export function isReminderEnabled(): boolean {
  return localStorage.getItem(KEY_ENABLED) === "1";
}

export async function enableReminder(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  let perm = Notification.permission;
  if (perm === "default") perm = await Notification.requestPermission();
  if (perm !== "granted") return false;
  localStorage.setItem(KEY_ENABLED, "1");
  scheduleNext();
  return true;
}

export function disableReminder() {
  localStorage.setItem(KEY_ENABLED, "0");
  if (timerId !== null) {
    clearTimeout(timerId);
    timerId = null;
  }
}

let timerId: ReturnType<typeof setTimeout> | null = null;

function msUntilNextReminder(): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(REMINDER_HOUR, 0, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function fire() {
  const lastFired = localStorage.getItem(KEY_LAST_FIRED);
  if (lastFired === todayKey()) return;
  if (Notification.permission !== "granted") return;
  try {
    const msg = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
    new Notification("호조", {
      body: msg,
      icon: "/icon-192.svg",
      badge: "/icon-192.svg",
      tag: "hojo-daily",
    });
    localStorage.setItem(KEY_LAST_FIRED, todayKey());
  } catch {
    // ignore
  }
}

function scheduleNext() {
  if (timerId !== null) clearTimeout(timerId);
  const ms = msUntilNextReminder();
  timerId = setTimeout(() => {
    fire();
    scheduleNext();
  }, ms);
}

/** 앱 부팅 시 호출. 권한 허용 & 오늘 아직 안 울렸고 9시 지났으면 즉시 1회 발사. */
export function bootReminder() {
  if (!isReminderEnabled()) return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const now = new Date();
  const alreadyFiredToday = localStorage.getItem(KEY_LAST_FIRED) === todayKey();
  if (!alreadyFiredToday && now.getHours() >= REMINDER_HOUR) {
    fire();
  }
  scheduleNext();
}
