import { useEffect, useState } from "react";
import type { Currency } from "../types";

const BASE_CURRENCY_KEY = "hojo.base_currency";
const DEFAULT_BASE: Currency = "KRW";

const CURRENCIES: Currency[] = ["USD", "KRW", "EUR", "JPY", "GBP"];

export function getBaseCurrency(): Currency {
  try {
    const v = localStorage.getItem(BASE_CURRENCY_KEY);
    if (v && CURRENCIES.includes(v as Currency)) return v as Currency;
  } catch {
    // ignore
  }
  return DEFAULT_BASE;
}

const listeners = new Set<() => void>();

export function setBaseCurrency(ccy: Currency): void {
  try {
    localStorage.setItem(BASE_CURRENCY_KEY, ccy);
  } catch {
    // ignore
  }
  for (const fn of listeners) fn();
}

export function useBaseCurrency(): Currency {
  const [ccy, setCcy] = useState<Currency>(getBaseCurrency);
  useEffect(() => {
    const fn = () => setCcy(getBaseCurrency());
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  return ccy;
}
