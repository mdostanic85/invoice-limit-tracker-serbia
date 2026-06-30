"use client";

import { useMemo } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";
import {
  formatCurrency,
  formatDate as formatDateBase,
  formatDateTime as formatDateTimeBase,
  formatPercent,
  formatRsd,
} from "@/lib/utils/format";

export function useFormat() {
  const { locale } = useLocale();
  const dateLocale = locale === "sr" ? "sr-RS" : "en-GB";

  return useMemo(
    () => ({
      formatDate: (date: Date | string | null) => formatDateBase(date, dateLocale),
      formatDateTime: (date: Date | string | null) =>
        formatDateTimeBase(date, dateLocale),
      formatRsd: (amount: number | string) => formatRsd(amount, locale),
      formatCurrency,
      formatPercent,
      dateLocale,
    }),
    [dateLocale]
  );
}
