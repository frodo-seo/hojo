import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { isNative } from "./platform";

interface NotificationPayload {
  pkg: string;
  title: string;
  body: string;
  postedAt: number;
  key: string;
}

interface HojoNotificationsPlugin {
  isListenerEnabled(): Promise<{ enabled: boolean }>;
  openListenerSettings(): Promise<void>;
  addListener(
    event: "notificationPosted",
    cb: (payload: NotificationPayload) => void,
  ): Promise<PluginListenerHandle>;
}

const HojoNotifications = registerPlugin<HojoNotificationsPlugin>("HojoNotifications");

export async function isListenerEnabled(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const res = await HojoNotifications.isListenerEnabled();
    return !!res.enabled;
  } catch {
    return false;
  }
}

export async function openListenerSettings(): Promise<void> {
  if (!isNative()) return;
  await HojoNotifications.openListenerSettings();
}

export async function subscribeNotifications(
  cb: (payload: NotificationPayload) => void,
): Promise<PluginListenerHandle | null> {
  if (!isNative()) return null;
  return HojoNotifications.addListener("notificationPosted", cb);
}
