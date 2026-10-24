import { getSetting } from "@/lib/db/settings";
import { translate, type Dictionary, getCatalog } from "./catalog";
import { DEFAULT_LOCALE, resolveLocale, type LocaleCode } from "./config";

export async function getLocale(): Promise<LocaleCode> {
  try {
    const raw = await getSetting("uiLanguage");
    return resolveLocale(raw);
  } catch {
    // Build / prerender without a ready SQLite binding
    return DEFAULT_LOCALE;
  }
}

export async function getDictionary(): Promise<{ locale: LocaleCode; dictionary: Dictionary }> {
  const locale = await getLocale();
  return { locale, dictionary: getCatalog(locale) };
}

export async function createTranslator() {
  const locale = await getLocale();
  return (key: string, params?: Record<string, string | number>) =>
    translate(locale, key, params);
}
