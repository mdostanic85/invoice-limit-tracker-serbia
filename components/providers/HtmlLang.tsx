"use client";

import { useEffect } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";

export function HtmlLang() {
  const { locale, t } = useLocale();

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = t("layout.pageTitle");
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute("content", t("layout.pageDescription"));
    }
  }, [locale, t]);

  return null;
}
