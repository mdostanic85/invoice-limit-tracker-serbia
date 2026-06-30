import type { Translator } from "./types";

export function invoiceStatusLabel(t: Translator, status: string): string {
  const key = `status.invoice.${status}`;
  const label = t(key);
  return label === key ? status : label;
}

export function forecastScenarioLabel(t: Translator, scenario: string): string {
  const key = `scenario.${scenario}`;
  const label = t(key);
  return label === key ? scenario : label;
}

export function forecastConfidenceLabel(t: Translator, confidence: string): string {
  const key = `confidence.${confidence}`;
  const label = t(key);
  return label === key ? confidence : label;
}

export function forecastRecurrenceLabel(t: Translator, recurrence: string): string {
  const key = `recurrence.${recurrence}`;
  const label = t(key);
  return label === key ? recurrence : label;
}

export function auditActionLabel(t: Translator, action: string): string {
  const key = `audit.action.${action}`;
  const label = t(key);
  return label === key ? action.replace(/_/g, " ") : label;
}

export function reportingBasisLabel(t: Translator, basis: "ISSUE_DATE" | "PAYMENT_DATE"): string {
  return basis === "PAYMENT_DATE" ? t("common.paymentDate") : t("common.issueDate");
}

function serbianInvoiceWord(count: number): "faktura" | "fakture" {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "faktura";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "fakture";
  return "faktura";
}

/** Localized invoice count phrase, e.g. "3 fakture" / "3 invoices". */
export function invoiceCountLabel(
  count: number,
  t: Translator,
  locale: string
): string {
  if (locale === "sr") {
    return `${count} ${serbianInvoiceWord(count)}`;
  }
  return count === 1
    ? t("invoices.countSingular")
    : t("invoices.countPlural", { count: String(count) });
}
