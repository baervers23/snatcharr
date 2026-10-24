import { DEFAULT_LOCALE, type LocaleCode } from "./config";
import en from "@/locales/en.json";
import de from "@/locales/de.json";

export type Dictionary = Record<string, unknown>;

const CATALOGS: Record<LocaleCode, Dictionary> = {
  en: en as Dictionary,
  de: de as Dictionary,
};

export function getCatalog(locale: LocaleCode): Dictionary {
  return CATALOGS[locale] ?? CATALOGS[DEFAULT_LOCALE];
}

function lookup(dict: Dictionary, key: string): string | undefined {
  const parts = key.split(".");
  let cur: unknown = dict;
  for (const part of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === "string" ? cur : undefined;
}

export function translate(
  locale: LocaleCode,
  key: string,
  params?: Record<string, string | number>,
): string {
  const primary = lookup(getCatalog(locale), key);
  const fallback =
    locale === DEFAULT_LOCALE ? undefined : lookup(getCatalog(DEFAULT_LOCALE), key);
  let text = primary ?? fallback ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replaceAll(`{${k}}`, String(v));
    }
  }
  return text;
}
