"use client";

import { createContext, useCallback, useContext, useMemo } from "react";
import { translate, type Dictionary } from "./catalog";
import { DEFAULT_LOCALE, type LocaleCode } from "./config";

type I18nContextValue = {
  locale: LocaleCode;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue>({
  locale: DEFAULT_LOCALE,
  t: (key) => key,
});

export function I18nProvider({
  locale,
  dictionary,
  children,
}: {
  locale: LocaleCode;
  dictionary: Dictionary;
  children: React.ReactNode;
}) {
  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => translate(locale, key, params),
    [locale],
  );

  const value = useMemo(() => ({ locale, t }), [locale, t]);

  // dictionary is passed so the provider can re-render when catalogs change via locale;
  // lookup goes through translate() which reads the module catalogs.
  void dictionary;

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT() {
  return useContext(I18nContext).t;
}

export function useLocale() {
  return useContext(I18nContext).locale;
}
