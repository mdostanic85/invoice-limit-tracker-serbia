/**
 * Pure domain calculation functions for annual limit tracking.
 * No I/O, no DB calls — all inputs are plain data.
 * Uses strings for Decimal values to avoid floating-point issues.
 */

import Decimal from "decimal.js";
import { getInvoiceLimitAmount, getForecastLimitAmount } from "./country-tax-rules";

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export interface InvoiceSummary {
  id: string;
  rsdAmount: string; // Decimal string
  issueDate: Date;
  paymentDate: Date | null;
  status: string;
  includeInLimit: boolean;
  currency: string;
  originalAmount: string;
  clientId: string;
  invoiceNumber: string;
}

export interface ForecastOccurrence {
  forecastId: string;
  clientId: string | null;
  expectedDate: Date;
  estimatedRsdAmount: string;
  scenario: string;
  currency: string;
  originalAmount: string;
  planningRateLabel: string;
}

export type ReportingBasis = "ISSUE_DATE" | "PAYMENT_DATE";

export interface LimitCalculation {
  actualTotal: Decimal;
  threshold: Decimal;
  remaining: Decimal;
  percentUsed: number;
  thresholdState: "neutral" | "warning" | "high_warning" | "exceeded";
  excludedCount: number; // invoices excluded due to missing payment date in PAYMENT_DATE mode
}

export interface ProjectedCalculation extends LimitCalculation {
  projectedTotal: Decimal;
  projectedRemaining: Decimal;
  projectedPercentUsed: number;
  projectedThresholdState: "neutral" | "warning" | "high_warning" | "exceeded";
  forecastContribution: Decimal;
  crossingMonth: string | null; // "YYYY-MM" or null if not projected to cross
}

export interface MonthlyInvoiceTotal {
  month: string;
  label: string;
  actual: number;
}

export interface MonthlyDraftInvoiceTotal {
  month: string;
  label: string;
  draft: number;
}

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * Determines if an invoice is eligible to count toward the annual limit.
 */
export function isEligible(
  invoice: InvoiceSummary,
  basis: ReportingBasis,
  year: number
): boolean {
  if (invoice.status === "DRAFT" || invoice.status === "CANCELLED") return false;
  if (!invoice.includeInLimit) return false;

  const basisDate =
    basis === "ISSUE_DATE" ? invoice.issueDate : invoice.paymentDate;

  if (!basisDate) return false;

  const basisYear = new Date(basisDate).getFullYear();
  return basisYear === year;
}

/**
 * Draft invoices are projections, not actual revenue. They count only toward
 * the Expected scenario and always use their issue date as the expected month.
 */
export function isExpectedDraftEligible(
  invoice: InvoiceSummary,
  year: number
): boolean {
  return (
    invoice.status === "DRAFT" &&
    invoice.includeInLimit &&
    new Date(invoice.issueDate).getFullYear() === year
  );
}

/**
 * Computes the actual YTD total and limit status.
 */
export function computeLimitStatus(
  invoices: InvoiceSummary[],
  basis: ReportingBasis,
  year: number,
  threshold: string,
  limitCurrency = "RSD"
): LimitCalculation {
  const thresholdDec = new Decimal(threshold);
  let actualTotal = new Decimal(0);
  let excludedCount = 0;

  for (const inv of invoices) {
    if (inv.status === "DRAFT" || inv.status === "CANCELLED") continue;
    if (!inv.includeInLimit) continue;

    if (basis === "PAYMENT_DATE" && !inv.paymentDate) {
      // Invoice exists but has no payment date — exclude and count
      if (new Date(inv.issueDate).getFullYear() <= year) {
        excludedCount++;
      }
      continue;
    }

    if (isEligible(inv, basis, year)) {
      actualTotal = actualTotal.plus(
        new Decimal(getInvoiceLimitAmount(inv, limitCurrency))
      );
    }
  }

  const remaining = Decimal.max(thresholdDec.minus(actualTotal), new Decimal(0));
  const percentUsed = thresholdDec.isZero()
    ? 0
    : actualTotal.div(thresholdDec).times(100).toNumber();

  return {
    actualTotal,
    threshold: thresholdDec,
    remaining,
    percentUsed,
    thresholdState: getThresholdState(percentUsed),
    excludedCount,
  };
}

/**
 * Returns the threshold state bucket for a given percentage.
 */
export function getThresholdState(
  percentUsed: number
): "neutral" | "warning" | "high_warning" | "exceeded" {
  if (percentUsed >= 100) return "exceeded";
  if (percentUsed >= 90) return "high_warning";
  if (percentUsed >= 80) return "warning";
  return "neutral";
}

/**
 * Expands a forecast entry into individual occurrences within the given year.
 * Handles ONE_TIME, MONTHLY, QUARTERLY recurrences.
 */
export function expandForecastOccurrences(
  entry: {
    id: string;
    clientId: string | null;
    expectedDate: Date;
    originalAmount: string;
    currency: string;
    estimatedRsdAmount: string;
    scenario: string;
    recurrence: string;
    recurrenceEndDate: Date | null;
    planningRateLabel: string;
    status: string;
  },
  year: number
): ForecastOccurrence[] {
  if (entry.status === "CANCELLED") return [];

  const occurrences: ForecastOccurrence[] = [];
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  const endDate = entry.recurrenceEndDate
    ? new Date(Math.min(entry.recurrenceEndDate.getTime(), yearEnd.getTime()))
    : yearEnd;

  if (entry.recurrence === "ONE_TIME") {
    const d = new Date(entry.expectedDate);
    if (d.getFullYear() === year) {
      occurrences.push({
        forecastId: entry.id,
        clientId: entry.clientId,
        expectedDate: d,
        estimatedRsdAmount: entry.estimatedRsdAmount,
        scenario: entry.scenario,
        currency: entry.currency,
        originalAmount: entry.originalAmount,
        planningRateLabel: entry.planningRateLabel,
      });
    }
    return occurrences;
  }

  // Find first occurrence in or after year start
  let current = new Date(entry.expectedDate);

  // Advance to year if base date is before year
  while (current < yearStart) {
    current = advanceDate(current, entry.recurrence);
  }

  while (current <= endDate) {
    occurrences.push({
      forecastId: entry.id,
      clientId: entry.clientId,
      expectedDate: new Date(current),
      estimatedRsdAmount: entry.estimatedRsdAmount,
      scenario: entry.scenario,
      currency: entry.currency,
      originalAmount: entry.originalAmount,
      planningRateLabel: entry.planningRateLabel,
    });
    current = advanceDate(current, entry.recurrence);
  }

  return occurrences;
}

function advanceDate(d: Date, recurrence: string): Date {
  const next = new Date(d);
  if (recurrence === "MONTHLY") {
    next.setMonth(next.getMonth() + 1);
  } else if (recurrence === "QUARTERLY") {
    next.setMonth(next.getMonth() + 3);
  }
  return next;
}

/**
 * Computes projected total including forecast occurrences for a scenario.
 * Also calculates the estimated month where the threshold will be crossed.
 */
export function computeProjection(
  invoices: InvoiceSummary[],
  forecastOccurrences: ForecastOccurrence[],
  basis: ReportingBasis,
  year: number,
  threshold: string,
  scenario: string,
  limitCurrency = "RSD"
): ProjectedCalculation {
  const base = computeLimitStatus(invoices, basis, year, threshold, limitCurrency);
  const thresholdDec = new Decimal(threshold);

  const scenarioOccurrences = forecastOccurrences.filter(
    (f) => f.scenario === scenario
  );

  const forecastContribution = scenarioOccurrences.reduce(
    (sum, f) => sum.plus(new Decimal(getForecastLimitAmount(f, limitCurrency))),
    new Decimal(0)
  );
  const draftInvoiceContribution =
    scenario === "EXPECTED"
      ? invoices.reduce(
          (sum, invoice) =>
            isExpectedDraftEligible(invoice, year)
              ? sum.plus(
                  new Decimal(getInvoiceLimitAmount(invoice, limitCurrency))
                )
              : sum,
          new Decimal(0)
        )
      : new Decimal(0);
  const expectedContribution = forecastContribution.plus(
    draftInvoiceContribution
  );

  const projectedTotal = base.actualTotal.plus(expectedContribution);
  const projectedRemaining = Decimal.max(
    thresholdDec.minus(projectedTotal),
    new Decimal(0)
  );
  const projectedPercentUsed = thresholdDec.isZero()
    ? 0
    : projectedTotal.div(thresholdDec).times(100).toNumber();

  // Compute crossing month: cumulative sum by month
  const crossingMonth = computeCrossingMonth(
    invoices,
    scenarioOccurrences,
    basis,
    year,
    thresholdDec,
    limitCurrency,
    scenario === "EXPECTED"
  );

  return {
    ...base,
    projectedTotal,
    projectedRemaining,
    projectedPercentUsed,
    projectedThresholdState: getThresholdState(projectedPercentUsed),
    forecastContribution: expectedContribution,
    crossingMonth,
  };
}

/**
 * Groups amounts by YYYY-MM and walks forward to find the first month
 * where the cumulative total crosses the threshold.
 */
function computeCrossingMonth(
  invoices: InvoiceSummary[],
  forecastOccurrences: ForecastOccurrence[],
  basis: ReportingBasis,
  year: number,
  threshold: Decimal,
  limitCurrency = "RSD",
  includeExpectedDrafts = false
): string | null {
  const monthTotals: Record<string, Decimal> = {};

  // Actuals
  for (const inv of invoices) {
    const isExpectedDraft =
      includeExpectedDrafts && isExpectedDraftEligible(inv, year);
    if (!isExpectedDraft && !isEligible(inv, basis, year)) continue;
    const basisDate = isExpectedDraft
      ? inv.issueDate
      : basis === "ISSUE_DATE"
        ? inv.issueDate
        : inv.paymentDate;
    if (!basisDate) continue;
    const d = new Date(basisDate);
    if (d.getFullYear() !== year) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthTotals[key] = (monthTotals[key] ?? new Decimal(0)).plus(
      new Decimal(getInvoiceLimitAmount(inv, limitCurrency))
    );
  }

  // Forecasts
  for (const f of forecastOccurrences) {
    const d = new Date(f.expectedDate);
    if (d.getFullYear() !== year) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    monthTotals[key] = (monthTotals[key] ?? new Decimal(0)).plus(
      new Decimal(getForecastLimitAmount(f, limitCurrency))
    );
  }

  const months = Object.keys(monthTotals).sort();
  let cumulative = new Decimal(0);
  for (const month of months) {
    cumulative = cumulative.plus(monthTotals[month]);
    if (cumulative.gte(threshold)) {
      return month;
    }
  }

  return null;
}

/**
 * Computes safe billing capacity in RSD and optionally in a given currency.
 */
export function computeSafeBillingCapacity(
  remaining: Decimal,
  foreignCurrencyRate?: number
): { remainingRsd: Decimal; remainingForeignCurrency: Decimal | null } {
  if (foreignCurrencyRate && foreignCurrencyRate > 0) {
    return {
      remainingRsd: remaining,
      remainingForeignCurrency: remaining.div(
        new Decimal(foreignCurrencyRate)
      ),
    };
  }
  return { remainingRsd: remaining, remainingForeignCurrency: null };
}

/**
 * Checks whether adding a new RSD amount would exceed the threshold.
 */
export function wouldExceedLimit(
  currentActual: Decimal,
  newAmountRsd: Decimal,
  threshold: Decimal
): { exceeds: boolean; overage: Decimal; newTotal: Decimal; percentUsed: number } {
  const newTotal = currentActual.plus(newAmountRsd);
  const exceeds = newTotal.gt(threshold);
  const overage = Decimal.max(newTotal.minus(threshold), new Decimal(0));
  const percentUsed = threshold.isZero()
    ? 0
    : newTotal.div(threshold).times(100).toNumber();
  return { exceeds, overage, newTotal, percentUsed };
}

/**
 * Groups invoices by month (YYYY-MM) for chart data.
 */
export function groupByMonth(
  invoices: InvoiceSummary[],
  basis: ReportingBasis,
  year: number,
  limitCurrency = "RSD",
  options: { includeExpectedDrafts?: boolean } = {}
): MonthlyInvoiceTotal[] {
  const months: Record<string, Decimal> = {};

  for (let m = 0; m < 12; m++) {
    const key = `${year}-${String(m + 1).padStart(2, "0")}`;
    months[key] = new Decimal(0);
  }

  for (const inv of invoices) {
    const isExpectedDraft =
      options.includeExpectedDrafts === true &&
      isExpectedDraftEligible(inv, year);
    if (!isExpectedDraft && !isEligible(inv, basis, year)) continue;
    const basisDate = isExpectedDraft
      ? inv.issueDate
      : basis === "ISSUE_DATE"
        ? inv.issueDate
        : inv.paymentDate;
    if (!basisDate) continue;
    const d = new Date(basisDate);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (key in months) {
      months[key] = months[key].plus(
        new Decimal(getInvoiceLimitAmount(inv, limitCurrency))
      );
    }
  }

  return Object.entries(months)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, total], idx) => ({
      month: key,
      label: MONTH_LABELS[idx],
      actual: total.toNumber(),
    }));
}

export function groupDraftInvoicesByMonth(
  invoices: InvoiceSummary[],
  year: number,
  limitCurrency = "RSD"
): MonthlyDraftInvoiceTotal[] {
  const months: Record<string, Decimal> = {};

  for (let month = 0; month < 12; month++) {
    const key = `${year}-${String(month + 1).padStart(2, "0")}`;
    months[key] = new Decimal(0);
  }

  for (const invoice of invoices) {
    if (!isExpectedDraftEligible(invoice, year)) continue;
    const issueDate = new Date(invoice.issueDate);
    const key = `${issueDate.getFullYear()}-${String(
      issueDate.getMonth() + 1
    ).padStart(2, "0")}`;
    months[key] = months[key].plus(
      new Decimal(getInvoiceLimitAmount(invoice, limitCurrency))
    );
  }

  return Object.entries(months)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, total], index) => ({
      month,
      label: MONTH_LABELS[index],
      draft: total.toNumber(),
    }));
}

/**
 * Groups invoices by client for the revenue-by-client chart.
 */
export function groupByClient(
  invoices: InvoiceSummary[],
  basis: ReportingBasis,
  year: number,
  topN = 10,
  limitCurrency = "RSD"
): Array<{ clientId: string; totalRsd: number }> {
  const byClient: Record<string, Decimal> = {};

  for (const inv of invoices) {
    if (!isEligible(inv, basis, year)) continue;
    byClient[inv.clientId] = (byClient[inv.clientId] ?? new Decimal(0)).plus(
      new Decimal(getInvoiceLimitAmount(inv, limitCurrency))
    );
  }

  return Object.entries(byClient)
    .sort(([, a], [, b]) => b.minus(a).toNumber())
    .slice(0, topN)
    .map(([clientId, total]) => ({ clientId, totalRsd: total.toNumber() }));
}
