export const DEFAULT_LOCALE = "en";

export const SUPPORTED_LOCALES = [
  { code: "en", label: "English" },
  { code: "de", label: "Deutsch" },
] as const;

export type LocaleCode = (typeof SUPPORTED_LOCALES)[number]["code"];

export function isSupportedLocale(code: string): code is LocaleCode {
  return SUPPORTED_LOCALES.some((l) => l.code === code);
}

export function resolveLocale(code: string | null | undefined): LocaleCode {
  if (code && isSupportedLocale(code)) return code;
  return DEFAULT_LOCALE;
}
