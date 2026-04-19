import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import ko from "../locales/ko.json";
import en from "../locales/en.json";

export const SUPPORTED_LANGS = ["ko", "en"] as const;
export type Lang = (typeof SUPPORTED_LANGS)[number];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ko: { translation: ko },
      en: { translation: en },
    },
    fallbackLng: "en",
    supportedLngs: SUPPORTED_LANGS,
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "hojo.lang",
      caches: ["localStorage"],
    },
  });

export function setLang(lang: Lang) {
  i18n.changeLanguage(lang);
}

export function currentLang(): Lang {
  const l = (i18n.resolvedLanguage || i18n.language || "en").split("-")[0];
  return (SUPPORTED_LANGS as readonly string[]).includes(l) ? (l as Lang) : "en";
}

export default i18n;
