/**
 * Limit service — fetches all relevant invoices/forecasts and delegates
 * to the pure domain functions in lib/domain/limit-calculations.ts
 */

import { prisma } from "@/lib/db/prisma";
import {
  computeLimitStatus,
  computeProjection,
  expandForecastOccurrences,
  groupByMonth,
  groupByClient,
  InvoiceSummary,
  ReportingBasis,
  LimitCalculation,
  ProjectedCalculation,
} from "@/lib/domain/limit-calculations";
import { getLimitCurrency } from "@/lib/domain/country-tax-rules";

export async function getYtdInvoices(
  organizationId: string,
  year: number
): Promise<InvoiceSummary[]> {
  // Fetch a wide range to support both issue-date and payment-date basis
  const yearStart = new Date(year - 1, 11, 1); // Dec of prior year (payment dates can be early)
  const yearEnd = new Date(year + 1, 0, 31); // Jan of next year

  const invoices = await prisma.invoice.findMany({
    where: {
      organizationId,
      OR: [
        {
          issueDate: { gte: new Date(year, 0, 1), lte: new Date(year, 11, 31) },
        },
        {
          paymentDate: { gte: yearStart, lte: yearEnd },
        },
      ],
    },
    select: {
      id: true,
      rsdAmount: true,
      issueDate: true,
      paymentDate: true,
      status: true,
      includeInLimit: true,
      currency: true,
      originalAmount: true,
      clientId: true,
      invoiceNumber: true,
    },
  });

  return invoices.map((inv: typeof invoices[0]) => ({
    id: inv.id,
    rsdAmount: inv.rsdAmount.toString(),
    issueDate: inv.issueDate,
    paymentDate: inv.paymentDate,
    status: inv.status,
    includeInLimit: inv.includeInLimit,
    currency: inv.currency,
    originalAmount: inv.originalAmount.toString(),
    clientId: inv.clientId,
    invoiceNumber: inv.invoiceNumber,
  }));
}

export async function getLimitStatus(
  organizationId: string,
  year: number,
  basis: ReportingBasis,
  threshold: string,
  countryCode: string
): Promise<LimitCalculation> {
  const invoices = await getYtdInvoices(organizationId, year);
  const limitCurrency = getLimitCurrency(countryCode);
  return computeLimitStatus(invoices, basis, year, threshold, limitCurrency);
}

export async function getProjection(
  organizationId: string,
  year: number,
  basis: ReportingBasis,
  threshold: string,
  scenario: "CONSERVATIVE" | "EXPECTED" | "OPTIMISTIC",
  countryCode: string
): Promise<ProjectedCalculation> {
  const limitCurrency = getLimitCurrency(countryCode);

  const [invoices, forecastEntries] = await Promise.all([
    getYtdInvoices(organizationId, year),
    prisma.forecastEntry.findMany({
      where: {
        organizationId,
        status: "ACTIVE",
        scenario,
      },
      select: {
        id: true,
        clientId: true,
        expectedDate: true,
        originalAmount: true,
        currency: true,
        estimatedRsdAmount: true,
        scenario: true,
        recurrence: true,
        recurrenceEndDate: true,
        planningRateLabel: true,
        status: true,
      },
    }),
  ]);

  const occurrences = forecastEntries.flatMap((f: typeof forecastEntries[0]) =>
    expandForecastOccurrences(
      {
        ...f,
        originalAmount: f.originalAmount.toString(),
        estimatedRsdAmount: f.estimatedRsdAmount.toString(),
      },
      year
    )
  );

  return computeProjection(invoices, occurrences, basis, year, threshold, scenario, limitCurrency);
}

export async function getDashboardData(
  organizationId: string,
  year: number,
  basis: ReportingBasis,
  threshold: string,
  scenario: "CONSERVATIVE" | "EXPECTED" | "OPTIMISTIC",
  countryCode: string
) {
  const limitCurrency = getLimitCurrency(countryCode);

  const [invoices, forecastEntries] = await Promise.all([
    getYtdInvoices(organizationId, year),
    prisma.forecastEntry.findMany({
      where: { organizationId, status: "ACTIVE", scenario },
      select: {
        id: true,
        clientId: true,
        expectedDate: true,
        originalAmount: true,
        currency: true,
        estimatedRsdAmount: true,
        scenario: true,
        recurrence: true,
        recurrenceEndDate: true,
        planningRateLabel: true,
        status: true,
      },
    }),
  ]);

  const occurrences = forecastEntries.flatMap((f: typeof forecastEntries[0]) =>
    expandForecastOccurrences(
      {
        ...f,
        originalAmount: f.originalAmount.toString(),
        estimatedRsdAmount: f.estimatedRsdAmount.toString(),
      },
      year
    )
  );

  const limitStatus = computeLimitStatus(invoices, basis, year, threshold, limitCurrency);
  const projection = computeProjection(
    invoices,
    occurrences,
    basis,
    year,
    threshold,
    scenario,
    limitCurrency
  );
  const monthlyData = groupByMonth(invoices, basis, year, limitCurrency, {
    includeExpectedDrafts: scenario === "EXPECTED",
  });
  const clientData = groupByClient(invoices, basis, year, 10, limitCurrency);

  // Status summary counts
  const statusCounts = invoices.reduce(
    (acc, inv) => {
      acc[inv.status] = (acc[inv.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return {
    limitStatus,
    projection,
    monthlyData,
    clientData,
    statusCounts,
    excludedCount: limitStatus.excludedCount,
  };
}
