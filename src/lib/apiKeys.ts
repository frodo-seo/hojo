import { useEffect, useState } from "react";
import { Preferences } from "@capacitor/preferences";

const ANTHROPIC_KEY = "hojo.anthropic_key";
const DATALAB_KEY = "hojo.datalab_key";

type ApiKeys = {
  anthropic: string;
  datalab: string;
};

export async function getApiKeys(): Promise<ApiKeys> {
  const [a, d] = await Promise.all([
    Preferences.get({ key: ANTHROPIC_KEY }),
    Preferences.get({ key: DATALAB_KEY }),
  ]);
  return {
    anthropic: a.value ?? "",
    datalab: d.value ?? "",
  };
}

export async function setAnthropicKey(value: string): Promise<void> {
  const v = value.trim();
  if (!v) await Preferences.remove({ key: ANTHROPIC_KEY });
  else await Preferences.set({ key: ANTHROPIC_KEY, value: v });
  notify();
}

export async function setDatalabKey(value: string): Promise<void> {
  const v = value.trim();
  if (!v) await Preferences.remove({ key: DATALAB_KEY });
  else await Preferences.set({ key: DATALAB_KEY, value: v });
  notify();
}

const listeners = new Set<() => void>();

function notify() {
  for (const fn of listeners) fn();
}

export function useApiKeysStatus() {
  const [status, setStatus] = useState({ anthropic: false, datalab: false, loaded: false });
  useEffect(() => {
    let mounted = true;
    async function load() {
      const { anthropic, datalab } = await getApiKeys();
      if (!mounted) return;
      setStatus({ anthropic: !!anthropic, datalab: !!datalab, loaded: true });
    }
    load();
    const fn = () => { load(); };
    listeners.add(fn);
    return () => { mounted = false; listeners.delete(fn); };
  }, []);
  return status;
}

export function maskKey(key: string): string {
  if (!key) return "";
  if (key.length <= 8) return "•".repeat(key.length);
  return key.slice(0, 4) + "•".repeat(Math.max(4, key.length - 8)) + key.slice(-4);
}
