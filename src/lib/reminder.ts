/**
 * 매일 아침 8시 일일 브리핑 알림.
 * 탭하면 앱이 열리고 Home에서 Haiku가 어제 소비 + 자산 변동을 요약.
 * 네이티브: Capacitor LocalNotifications 플러그인으로 OS에 예약 등록 (앱이 닫혀도 발송)
 * 웹: setTimeout + Web Notification API 폴백 (앱 열려있을 때만 동작)
 */

import { LocalNotifications } from "@capacitor/local-notifications";
import { isNative } from "./platform";
import { currentLang } from "./i18n";

const KEY_ENABLED = "reminder_enabled";
const KEY_LAST_FIRED = "reminder_last_fired";
const REMINDER_HOUR = 8;
const NOTIF_ID = 21001;

const MESSAGES_KO = [
  "오늘의 일일 브리핑이 도착했어요.",
  "어제 소비와 자산 변동을 정리했어요.",
  "오늘의 재무 요약을 확인해보세요.",
  "간밤의 자산 변화와 어제 지출을 모아봤어요.",
];
const MESSAGES_EN = [
  "Your daily briefing is ready.",
  "Yesterday's spending and overnight asset changes are in.",
  "Check today's financial recap.",
  "A quick snapshot of yesterday and your portfolio overnight.",
];

function pickMessage(): string {
  const pool = currentLang() === "en" ? MESSAGES_EN : MESSAGES_KO;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function isReminderEnabled(): boolean {
  return localStorage.getItem(KEY_ENABLED) === "1";
}

export async function enableReminder(): Promise<boolean> {
  if (isNative()) {
    const perm = await LocalNotifications.requestPermissions();
    if (perm.display !== "granted") return false;
    localStorage.setItem(KEY_ENABLED, "1");
    await scheduleNative();
    return true;
  }

  if (!("Notification" in window)) return false;
  let perm = Notification.permission;
  if (perm === "default") perm = await Notification.requestPermission();
  if (perm !== "granted") return false;
  localStorage.setItem(KEY_ENABLED, "1");
  scheduleWebNext();
  return true;
}

export async function disableReminder(): Promise<void> {
  localStorage.setItem(KEY_ENABLED, "0");
  if (isNative()) {
    try {
      await LocalNotifications.cancel({ notifications: [{ id: NOTIF_ID }] });
    } catch {
      /* ignore */
    }
    return;
  }
  if (webTimerId !== null) {
    clearTimeout(webTimerId);
    webTimerId = null;
  }
}

// ===== Native (Capacitor) path =====

async function scheduleNative(): Promise<void> {
  try {
    await LocalNotifications.cancel({ notifications: [{ id: NOTIF_ID }] });
  } catch {
    /* no-op if nothing scheduled */
  }

  const next = nextReminderDate();
  await LocalNotifications.schedule({
    notifications: [
      {
        id: NOTIF_ID,
        title: "Hojo",
        body: pickMessage(),
        schedule: {
          on: {
            hour: REMINDER_HOUR,
            minute: 0,
          },
          allowWhileIdle: true,
        },
        smallIcon: "ic_stat_icon_config_sample",
      },
    ],
  });
  // `on` with hour/minute repeats daily.
  void next;
}

// ===== Web fallback (setTimeout) =====

let webTimerId: ReturnType<typeof setTimeout> | null = null;

function nextReminderDate(): Date {
  const now = new Date();
  const next = new Date(now);
  next.setHours(REMINDER_HOUR, 0, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function fireWeb(): void {
  const lastFired = localStorage.getItem(KEY_LAST_FIRED);
  if (lastFired === todayKey()) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification("Hojo", {
      body: pickMessage(),
      icon: "/icon-192.svg",
      badge: "/icon-192.svg",
      tag: "hojo-daily",
    });
    localStorage.setItem(KEY_LAST_FIRED, todayKey());
  } catch {
    /* ignore */
  }
}

function scheduleWebNext(): void {
  if (webTimerId !== null) clearTimeout(webTimerId);
  const ms = nextReminderDate().getTime() - Date.now();
  webTimerId = setTimeout(() => {
    fireWeb();
    scheduleWebNext();
  }, ms);
}

/** 앱 부팅 시 호출. 네이티브는 OS가 예약을 소유하므로 재등록만, 웹은 즉시 1회 + 다음 예약. */
export async function bootReminder(): Promise<void> {
  if (!isReminderEnabled()) return;

  if (isNative()) {
    try {
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== "granted") return;
      // 저장된 예약이 있는지 확인해서 없으면 재등록 (기기 재부팅 등 대비).
      const pending = await LocalNotifications.getPending();
      if (!pending.notifications.some((n) => n.id === NOTIF_ID)) {
        await scheduleNative();
      }
    } catch (err) {
      console.warn("[hojo] reminder boot failed", err);
    }
    return;
  }

  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  const now = new Date();
  const alreadyFiredToday = localStorage.getItem(KEY_LAST_FIRED) === todayKey();
  if (!alreadyFiredToday && now.getHours() >= REMINDER_HOUR) {
    fireWeb();
  }
  scheduleWebNext();
}
