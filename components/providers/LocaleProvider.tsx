"use client";

import { ConfigProvider } from "antd";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import enUS from "antd/locale/en_US";
import srRS from "antd/locale/sr_RS";
import dayjs from "dayjs";
import "dayjs/locale/sr";
import { HtmlLang } from "@/components/providers/HtmlLang";
import { getMessages } from "@/lib/i18n";
import { updateLocaleAction } from "@/app/actions/org-actions";
import {
  createTranslator,
  dbLocaleToLocale,
  localeToDbLocale,
  type AppLocaleDb,
  type Locale,
  type Translator,
} from "@/lib/i18n/types";

const antLocales = { en: enUS, sr: srRS } as const;

interface LocaleContextValue {
  locale: Locale;
  t: Translator;
  setLocale: (locale: Locale) => Promise<void>;
  isPending: boolean;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  initialLocale,
  children,
}: {
  initialLocale: AppLocaleDb;
  children: React.ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(() => dbLocaleToLocale(initialLocale));
  const [isPending, setIsPending] = useState(false);

  const t = useMemo(() => createTranslator(getMessages(locale)), [locale]);

  const setLocale = useCallback(async (next: Locale) => {
    setIsPending(true);
    try {
      const result = await updateLocaleAction(localeToDbLocale(next));
      if ("error" in result && result.error) return;
      setLocaleState(next);
      dayjs.locale(next === "sr" ? "sr" : "en");
    } finally {
      setIsPending(false);
    }
  }, []);

  return (
    <LocaleContext.Provider value={{ locale, t, setLocale, isPending }}>
      <ConfigProvider locale={antLocales[locale]}>
        <HtmlLang />
        {children}
      </ConfigProvider>
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used within LocaleProvider");
  }
  return ctx;
}
