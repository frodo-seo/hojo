/**
 * 매일 저녁 9시 기록 알림.
 * - 권한 요청은 유저가 Settings에서 토글할 때만 진행.
 * - 스케줄링은 setTimeout 기반 (앱이 열려있거나 백그라운드에 있을 때만 동작).
 */

import { currentLang } from "./i18n";

const KEY_ENABLED = "reminder_enabled";
const KEY_LAST_FIRED = "reminder_last_fired";
const REMINDER_HOUR = 21;
const MESSAGES_KO = [
  "오늘의 지출을 기록해보세요.",
  "하루를 정리할 시간입니다.",
  "오늘 쓴 금액을 확인해보세요.",
  "잊기 전에 오늘의 기록을 남겨보세요.",
];
const MESSAGES_EN = [
  "Log today's spending.",
  "Time to wrap up the day.",
  "Check what you spent today.",
  "Capture today's entries before you forget.",
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
    const pool = currentLang() === "en" ? MESSAGES_EN : MESSAGES_KO;
    const msg = pool[Math.floor(Math.random() * pool.length)];
    new Notification("Hojo", {
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
