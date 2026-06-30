/**
 * Formatting utilities for currency and numbers.
 * All formatting is done without raw hex/pixel values — presentation only.
 */

export function formatRsd(amount: number | string, locale = "en-RS"): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  const numberLocale = locale === "sr" || locale === "sr-RS" ? "sr-RS" : "en-RS";
  const formatted = new Intl.NumberFormat(numberLocale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
  return `${formatted} RSD`;
}

export function formatCurrency(
  amount: number | string,
  currency: string
): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  if (currency === "RSD") return formatRsd(n);

  try {
    return new Intl.NumberFormat("en-RS", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${n.toFixed(2)} ${currency}`;
  }
}

export function formatRate(rate: number | string, decimals = 4): string {
  const n = typeof rate === "string" ? parseFloat(rate) : rate;
  return n.toFixed(decimals);
}

export function formatDate(
  date: Date | string | null,
  locale = "en-GB"
): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(
  date: Date | string | null,
  locale = "en-GB"
): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatIsoDate(date: Date | string | null): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().split("T")[0];
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function rsdConversionFormula(
  originalAmount: string,
  currency: string,
  ratePerUnit: string,
  rsdAmount: string
): string {
  if (currency === "RSD") return `${formatRsd(originalAmount)} (RSD — no conversion)`;
  const amt = parseFloat(originalAmount).toFixed(2);
  const rate = parseFloat(ratePerUnit).toFixed(4);
  const rsd = parseFloat(rsdAmount).toFixed(2);
  return `${amt} ${currency} × ${rate} = ${Number(rsd).toLocaleString("en-RS")} RSD`;
}
