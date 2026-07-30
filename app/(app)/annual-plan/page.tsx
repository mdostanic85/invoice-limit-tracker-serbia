import { getOrgContext } from "@/lib/auth/get-org-context";
import { getYtdInvoices } from "@/lib/services/limit-service";
import {
  computeProjection,
  expandForecastOccurrences,
  type InvoiceSummary,
} from "@/lib/domain/limit-calculations";
import { getLimitCurrency } from "@/lib/domain/country-tax-rules";
import { prisma } from "@/lib/db/prisma";
import { AnnualPlanClient } from "./AnnualPlanClient";

interface PageProps {
  searchParams: Promise<{ year?: string; scenario?: string }>;
}

export default async function AnnualPlanPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const ctx = await getOrgContext();
  const year = params.year ? parseInt(params.year) : new Date().getFullYear();
  const scenario = (params.scenario ?? "EXPECTED") as "CONSERVATIVE" | "EXPECTED" | "OPTIMISTIC";

  const [invoices, forecastEntries] = await Promise.all([
    getYtdInvoices(ctx.organizationId, year),
    prisma.forecastEntry.findMany({
      where: { organizationId: ctx.organizationId, status: "ACTIVE" },
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

  // Compute projections for all 3 scenarios
  const scenarios = ["CONSERVATIVE", "EXPECTED", "OPTIMISTIC"] as const;
  const projections: Record<string, { projectedTotal: string; crossingMonth: string | null; forecastContribution: string }> = {};
  const limitCurrency = getLimitCurrency(ctx.organization.countryCode);

  for (const s of scenarios) {
    const occurrences = forecastEntries
      .filter((f: typeof forecastEntries[0]) => f.scenario === s)
      .flatMap((f: typeof forecastEntries[0]) =>
        expandForecastOccurrences(
          {
            ...f,
            originalAmount: f.originalAmount.toString(),
            estimatedRsdAmount: f.estimatedRsdAmount.toString(),
          },
          year
        )
      );

    const proj = computeProjection(
      invoices,
      occurrences,
      ctx.organization.defaultReportingBasis,
      year,
      ctx.organization.annualThresholdRsd.toString(),
      s,
      limitCurrency
    );

    projections[s] = {
      projectedTotal: proj.projectedTotal.toFixed(4),
      crossingMonth: proj.crossingMonth,
      forecastContribution: proj.forecastContribution.toFixed(4),
    };
  }

  // Monthly data for chart
  const monthlyActuals: Record<string, number> = {};
  for (let m = 0; m < 12; m++) {
    const key = `${year}-${String(m + 1).padStart(2, "0")}`;
    monthlyActuals[key] = 0;
  }
  for (const inv of invoices as InvoiceSummary[]) {
    if (inv.status === "DRAFT" || inv.status === "CANCELLED") continue;
    if (!inv.includeInLimit) continue;
    const d = new Date(
      ctx.organization.defaultReportingBasis === "ISSUE_DATE"
        ? inv.issueDate
        : (inv.paymentDate ?? inv.issueDate)
    );
    if (d.getFullYear() !== year) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (key in monthlyActuals) {
      monthlyActuals[key] += parseFloat(inv.rsdAmount);
    }
  }

  // Cumulative monthly totals
  const sortedMonthlyActuals = Object.entries(monthlyActuals).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  const cumulativeData = sortedMonthlyActuals.map(([month, actual], index) => ({
    month,
    actual,
    cumulative: sortedMonthlyActuals
      .slice(0, index + 1)
      .reduce((total, [, monthlyActual]) => total + monthlyActual, 0),
  }));

  return (
    <AnnualPlanClient
      year={year}
      selectedScenario={scenario}
      threshold={ctx.organization.annualThresholdRsd.toString()}
      basis={ctx.organization.defaultReportingBasis}
      projections={projections}
      cumulativeData={cumulativeData}
    />
  );
}
