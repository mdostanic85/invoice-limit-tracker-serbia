"use server";

import { getOrgContext } from "@/lib/auth/get-org-context";
import { prisma } from "@/lib/db/prisma";
import { writeAuditEvent } from "@/lib/services/audit-service";
import { createForecastSchema, updateForecastSchema } from "@/lib/validation/schemas";
import { getExchangeRateProvider } from "@/lib/exchange-rate";
import Decimal from "decimal.js";
import { serializeForClient } from "@/lib/utils/serialize";
import { calculateHourlyAmount } from "@/lib/utils/hourly-billing";
import { getYtdInvoices } from "@/lib/services/limit-service";
import {
  computeLimitStatus,
  computeProjection,
  expandForecastOccurrences,
  groupByMonth,
} from "@/lib/domain/limit-calculations";
import { getLimitCurrency } from "@/lib/domain/country-tax-rules";
import {
  FORECAST_SCENARIOS,
  MONTHLY_PLAN_NOTE,
  STILT_MONTHLY_PLAN_NOTE,
  type ForecastScenario,
} from "@/lib/constants/forecast";
import { FORECAST_CURRENCIES } from "@/lib/constants/currencies";
import { syncStiltMonthlyForecast } from "@/lib/services/sync-stilt-forecast";
import { isStiltClientName } from "@/lib/domain/stilt-monthly-forecast";

async function computeEstimatedRsd(
  currency: string,
  originalAmount: string,
  organizationId: string
): Promise<{ rsdAmount: string; planningRateLabel: string; planningRateUsed: string }> {
  if (currency === "RSD") {
    return {
      rsdAmount: originalAmount,
      planningRateLabel: "RSD (no conversion)",
      planningRateUsed: "1",
    };
  }

  // Check org planning rate override
  const planningRate = await prisma.planningExchangeRate.findUnique({
    where: {
      organizationId_currency: { organizationId, currency },
    },
  });

  if (planningRate) {
    const rsd = new Decimal(originalAmount).times(
      new Decimal(planningRate.ratePerUnit.toString())
    );
    return {
      rsdAmount: rsd.toFixed(4),
      planningRateLabel: planningRate.label ?? `Planning rate (${currency})`,
      planningRateUsed: planningRate.ratePerUnit.toString(),
    };
  }

  // Fall back to latest cached NBS rate
  const latestCache = await prisma.exchangeRateCache.findFirst({
    where: { currency },
    orderBy: { rateDate: "desc" },
  });

  if (latestCache) {
    const rsd = new Decimal(originalAmount).times(
      new Decimal(latestCache.ratePerUnit.toString())
    );
    return {
      rsdAmount: rsd.toFixed(4),
      planningRateLabel: `NBS estimate (${latestCache.effectiveDate.toISOString().split("T")[0]}) — not a future official rate`,
      planningRateUsed: latestCache.ratePerUnit.toString(),
    };
  }

  // Last resort — try fetching current NBS rate
  try {
    const provider = getExchangeRateProvider();
    const rate = await provider.getMiddleRate({ currency, date: new Date() });
    const rsd = new Decimal(originalAmount).times(rate.ratePerUnit);
    return {
      rsdAmount: rsd.toFixed(4),
      planningRateLabel: `NBS estimate (${rate.effectiveDate}) — not a future official rate`,
      planningRateUsed: rate.ratePerUnit.toFixed(6),
    };
  } catch {
    // Cannot determine rate — use 0 and flag
    return {
      rsdAmount: "0",
      planningRateLabel: "Rate unavailable — enter manually",
      planningRateUsed: "0",
    };
  }
}

async function computeCurrentRsd(
  currency: string,
  originalAmount: string
): Promise<{ rsdAmount: string; planningRateLabel: string; planningRateUsed: string }> {
  if (currency === "RSD") {
    return {
      rsdAmount: originalAmount,
      planningRateLabel: "RSD (no conversion)",
      planningRateUsed: "1",
    };
  }

  const latestCache = await prisma.exchangeRateCache.findFirst({
    where: { currency },
    orderBy: { rateDate: "desc" },
  });

  if (latestCache) {
    const rsd = new Decimal(originalAmount).times(
      new Decimal(latestCache.ratePerUnit.toString())
    );
    return {
      rsdAmount: rsd.toFixed(4),
      planningRateLabel: `NBS ${latestCache.effectiveDate.toISOString().split("T")[0]}`,
      planningRateUsed: latestCache.ratePerUnit.toString(),
    };
  }

  try {
    const provider = getExchangeRateProvider();
    const rate = await provider.getMiddleRate({ currency, date: new Date() });
    const rsd = new Decimal(originalAmount).times(rate.ratePerUnit);
    return {
      rsdAmount: rsd.toFixed(4),
      planningRateLabel: `NBS ${rate.effectiveDate}`,
      planningRateUsed: rate.ratePerUnit.toFixed(6),
    };
  } catch {
    return {
      rsdAmount: "0",
      planningRateLabel: "Rate unavailable",
      planningRateUsed: "0",
    };
  }
}

async function fetchCurrentExchangeRates(currencies: readonly string[]) {
  const rates: Record<
    string,
    { ratePerUnit: string; effectiveDate: string; label: string }
  > = {};

  await Promise.all(
    currencies
      .filter((currency) => currency !== "RSD")
      .map(async (currency) => {
        const latestCache = await prisma.exchangeRateCache.findFirst({
          where: { currency },
          orderBy: { rateDate: "desc" },
        });

        if (latestCache) {
          rates[currency] = {
            ratePerUnit: latestCache.ratePerUnit.toString(),
            effectiveDate: latestCache.effectiveDate.toISOString().split("T")[0],
            label: `NBS ${latestCache.effectiveDate.toISOString().split("T")[0]}`,
          };
          return;
        }

        try {
          const provider = getExchangeRateProvider();
          const rate = await provider.getMiddleRate({ currency, date: new Date() });
          rates[currency] = {
            ratePerUnit: rate.ratePerUnit.toFixed(6),
            effectiveDate: rate.effectiveDate,
            label: `NBS ${rate.effectiveDate}`,
          };
        } catch {
          rates[currency] = {
            ratePerUnit: "0",
            effectiveDate: "",
            label: "Rate unavailable",
          };
        }
      })
  );

  return rates;
}

async function resolveForecastBilling(
  organizationId: string,
  data: {
    billingModel?: "FIXED" | "HOURLY";
    billableHours?: string | null;
    originalAmount?: string;
    currency?: string;
    clientId?: string | null;
  }
): Promise<
  | { error: string }
  | {
      billingModel: "FIXED" | "HOURLY";
      billableHours: string | null;
      originalAmount: string;
      currency: string;
    }
> {
  const billingModel = data.billingModel ?? "FIXED";

  if (billingModel === "FIXED") {
    if (!data.originalAmount) return { error: "Amount is required" };
    if (!data.currency) return { error: "Currency is required" };
    return {
      billingModel: "FIXED",
      billableHours: null,
      originalAmount: data.originalAmount,
      currency: data.currency,
    };
  }

  if (!data.clientId) return { error: "HOURLY_CLIENT_REQUIRED" };
  if (!data.billableHours) return { error: "BILLABLE_HOURS_REQUIRED" };

  const client = await prisma.client.findUnique({ where: { id: data.clientId } });
  if (!client || client.organizationId !== organizationId) {
    return { error: "Client not found" };
  }
  if (client.billingModel !== "HOURLY" || !client.hourlyRate) {
    return { error: "CLIENT_NOT_HOURLY" };
  }

  const originalAmount = calculateHourlyAmount(
    data.billableHours,
    client.hourlyRate.toString()
  );
  const currency = client.hourlyCurrency ?? data.currency ?? "EUR";

  return {
    billingModel: "HOURLY",
    billableHours: data.billableHours,
    originalAmount,
    currency,
  };
}

export async function createForecastAction(formData: unknown) {
  const ctx = await getOrgContext();

  const parsed = createForecastSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten() };

  const billing = await resolveForecastBilling(ctx.organizationId, parsed.data);
  if ("error" in billing) return { error: billing.error };

  const { rsdAmount, planningRateLabel, planningRateUsed } =
    await computeEstimatedRsd(
      billing.currency,
      billing.originalAmount,
      ctx.organizationId
    );

  const entry = await prisma.forecastEntry.create({
    data: {
      organizationId: ctx.organizationId,
      clientId: parsed.data.clientId ?? null,
      expectedDate: new Date(parsed.data.expectedDate),
      billingModel: billing.billingModel,
      billableHours: billing.billableHours,
      originalAmount: billing.originalAmount,
      currency: billing.currency,
      scenario: parsed.data.scenario,
      confidence: parsed.data.confidence,
      recurrence: parsed.data.recurrence,
      recurrenceEndDate: parsed.data.recurrenceEndDate
        ? new Date(parsed.data.recurrenceEndDate)
        : null,
      planningRateUsed,
      estimatedRsdAmount: rsdAmount,
      planningRateLabel,
      notes: parsed.data.notes ?? null,
      createdBy: ctx.userId,
    },
  });

  await writeAuditEvent({
    organizationId: ctx.organizationId,
    entityType: "ForecastEntry",
    entityId: entry.id,
    action: "FORECAST_CREATED",
    actorUserId: ctx.userId,
    payload: {
      scenario: entry.scenario,
      currency: entry.currency,
      originalAmount: parsed.data.originalAmount,
      estimatedRsdAmount: rsdAmount,
      planningRateLabel,
    },
  });

  return { data: serializeForClient(entry) };
}

export async function updateForecastAction(id: string, formData: unknown) {
  const ctx = await getOrgContext();

  const entry = await prisma.forecastEntry.findUnique({ where: { id } });
  if (!entry || entry.organizationId !== ctx.organizationId) {
    return { error: "Forecast entry not found" };
  }

  const parsed = updateForecastSchema.safeParse(formData);
  if (!parsed.success) return { error: parsed.error.flatten() };

  const billing = await resolveForecastBilling(ctx.organizationId, {
    billingModel: parsed.data.billingModel ?? entry.billingModel,
    billableHours:
      parsed.data.billableHours !== undefined
        ? parsed.data.billableHours
        : entry.billableHours?.toString() ?? null,
    originalAmount:
      parsed.data.originalAmount ?? entry.originalAmount.toString(),
    currency: parsed.data.currency ?? entry.currency,
    clientId:
      parsed.data.clientId !== undefined ? parsed.data.clientId : entry.clientId,
  });
  if ("error" in billing) return { error: billing.error };

  const { rsdAmount, planningRateLabel, planningRateUsed } =
    await computeEstimatedRsd(billing.currency, billing.originalAmount, ctx.organizationId);

  const updated = await prisma.forecastEntry.update({
    where: { id },
    data: {
      clientId: parsed.data.clientId !== undefined ? parsed.data.clientId : undefined,
      expectedDate: parsed.data.expectedDate
        ? new Date(parsed.data.expectedDate)
        : undefined,
      billingModel: billing.billingModel,
      billableHours: billing.billableHours,
      originalAmount: billing.originalAmount,
      currency: billing.currency,
      scenario: parsed.data.scenario,
      confidence: parsed.data.confidence,
      recurrence: parsed.data.recurrence,
      recurrenceEndDate:
        parsed.data.recurrenceEndDate !== undefined
          ? parsed.data.recurrenceEndDate
            ? new Date(parsed.data.recurrenceEndDate)
            : null
          : undefined,
      planningRateUsed,
      estimatedRsdAmount: rsdAmount,
      planningRateLabel,
      notes: parsed.data.notes ?? undefined,
    },
  });

  await writeAuditEvent({
    organizationId: ctx.organizationId,
    entityType: "ForecastEntry",
    entityId: id,
    action: "FORECAST_UPDATED",
    actorUserId: ctx.userId,
    payload: { changes: parsed.data },
  });

  return { data: serializeForClient(updated) };
}

export async function cancelForecastAction(id: string) {
  const ctx = await getOrgContext();

  const entry = await prisma.forecastEntry.findUnique({ where: { id } });
  if (!entry || entry.organizationId !== ctx.organizationId) {
    return { error: "Forecast entry not found" };
  }

  const updated = await prisma.forecastEntry.update({
    where: { id },
    data: { status: "CANCELLED" },
  });

  await writeAuditEvent({
    organizationId: ctx.organizationId,
    entityType: "ForecastEntry",
    entityId: id,
    action: "FORECAST_CANCELLED",
    actorUserId: ctx.userId,
    payload: {},
  });

  return { data: serializeForClient(updated) };
}

export async function getForecastEntriesAction(
  scenario?: string,
  year?: number
) {
  const ctx = await getOrgContext();

  const yearStart = year ? new Date(year, 0, 1) : undefined;
  const yearEnd = year ? new Date(year, 11, 31) : undefined;

  const entries = await prisma.forecastEntry.findMany({
    where: {
      organizationId: ctx.organizationId,
      status: "ACTIVE",
      ...(scenario && { scenario: scenario as "CONSERVATIVE" | "EXPECTED" | "OPTIMISTIC" }),
      ...(yearStart && yearEnd && {
        expectedDate: { gte: yearStart, lte: yearEnd },
      }),
    },
    include: {
      client: { select: { displayName: true } },
    },
    orderBy: { expectedDate: "asc" },
  });

  return { data: serializeForClient(entries) };
}

export async function upsertPlanningRateAction(
  currency: string,
  ratePerUnit: string,
  label?: string
) {
  const ctx = await getOrgContext();

  const rate = await prisma.planningExchangeRate.upsert({
    where: {
      organizationId_currency: {
        organizationId: ctx.organizationId,
        currency,
      },
    },
    update: { ratePerUnit, label: label ?? null, updatedBy: ctx.userId },
    create: {
      organizationId: ctx.organizationId,
      currency,
      ratePerUnit,
      label: label ?? null,
      updatedBy: ctx.userId,
    },
  });

  return { data: serializeForClient(rate) };
}

const forecastEntrySelect = {
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
  notes: true,
  billableHours: true,
} as const;

function monthKeyFromDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function buildMonthKeys(year: number): string[] {
  return Array.from({ length: 12 }, (_, index) =>
    `${year}-${String(index + 1).padStart(2, "0")}`
  );
}

function getEditableFromMonth(year: number, now = new Date()): number {
  if (year > now.getFullYear()) return 1;
  if (year < now.getFullYear()) return 13;
  return now.getMonth() + 2;
}

const MONTHLY_PLAN_NOTES = [MONTHLY_PLAN_NOTE, STILT_MONTHLY_PLAN_NOTE] as const;

export async function getForecastPageDataAction(year?: number) {
  const ctx = await getOrgContext();
  const selectedYear = year ?? new Date().getFullYear();
  const basis = ctx.organization.defaultReportingBasis;
  const threshold = ctx.organization.annualThresholdRsd.toString();
  const limitCurrency = getLimitCurrency(ctx.organization.countryCode);
  const editableFromMonth = getEditableFromMonth(selectedYear);

  await syncStiltMonthlyForecast({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    year: selectedYear,
    editableFromMonth,
    convertToRsd: computeCurrentRsd,
  });

  const [invoices, forecastEntries, hourlyClients] = await Promise.all([
    getYtdInvoices(ctx.organizationId, selectedYear),
    prisma.forecastEntry.findMany({
      where: { organizationId: ctx.organizationId, status: "ACTIVE" },
      select: forecastEntrySelect,
    }),
    prisma.client.findMany({
      where: {
        organizationId: ctx.organizationId,
        status: "ACTIVE",
        billingModel: "HOURLY",
      },
      select: {
        displayName: true,
        hourlyRate: true,
        hourlyCurrency: true,
      },
    }),
  ]);

  const monthlyActuals = groupByMonth(invoices, basis, selectedYear, limitCurrency);
  const monthKeys = buildMonthKeys(selectedYear);

  const monthlyPlan: Record<
    ForecastScenario,
    Record<
      string,
      {
        originalAmount: string;
        currency: string;
        amountRsd: string;
        entryId: string | null;
        source: "manual" | "stilt" | null;
        billableDays: number | null;
      }
    >
  > = {
    CONSERVATIVE: {},
    EXPECTED: {},
    OPTIMISTIC: {},
  };

  for (const scenario of FORECAST_SCENARIOS) {
    for (const key of monthKeys) {
      monthlyPlan[scenario][key] = {
        originalAmount: "0",
        currency: "RSD",
        amountRsd: "0",
        entryId: null,
        source: null,
        billableDays: null,
      };
    }
  }

  for (const entry of forecastEntries) {
    if (
      !MONTHLY_PLAN_NOTES.includes(entry.notes as (typeof MONTHLY_PLAN_NOTES)[number]) ||
      entry.recurrence !== "ONE_TIME"
    ) {
      continue;
    }
    const key = monthKeyFromDate(new Date(entry.expectedDate));
    if (!key.startsWith(String(selectedYear))) continue;

    const scenario = entry.scenario as ForecastScenario;
    const cell = monthlyPlan[scenario][key];
    const isManual = entry.notes === MONTHLY_PLAN_NOTE;
    const isStilt = entry.notes === STILT_MONTHLY_PLAN_NOTE;

    if (isManual || (isStilt && cell.source !== "manual")) {
      cell.originalAmount = entry.originalAmount.toString();
      cell.currency = entry.currency;
      cell.amountRsd = entry.estimatedRsdAmount.toString();
      cell.entryId = entry.id;
      cell.source = isManual ? "manual" : "stilt";
      cell.billableDays = isStilt
        ? parseInt(entry.billableHours?.toString() ?? "0", 10) || null
        : null;
    }
  }

  const stiltClient = hourlyClients.find((client) =>
    isStiltClientName(client.displayName)
  );

  const exchangeRates = await fetchCurrentExchangeRates(FORECAST_CURRENCIES);

  const limitStatus = computeLimitStatus(
    invoices,
    basis,
    selectedYear,
    threshold,
    limitCurrency
  );

  const projections: Record<
    ForecastScenario,
    {
      projectedTotal: string;
      projectedRemaining: string;
      projectedPercentUsed: number;
      projectedThresholdState: string;
      forecastContribution: string;
      crossingMonth: string | null;
    }
  > = {
    CONSERVATIVE: {
      projectedTotal: "0",
      projectedRemaining: threshold,
      projectedPercentUsed: 0,
      projectedThresholdState: "neutral",
      forecastContribution: "0",
      crossingMonth: null,
    },
    EXPECTED: {
      projectedTotal: "0",
      projectedRemaining: threshold,
      projectedPercentUsed: 0,
      projectedThresholdState: "neutral",
      forecastContribution: "0",
      crossingMonth: null,
    },
    OPTIMISTIC: {
      projectedTotal: "0",
      projectedRemaining: threshold,
      projectedPercentUsed: 0,
      projectedThresholdState: "neutral",
      forecastContribution: "0",
      crossingMonth: null,
    },
  };

  for (const scenario of FORECAST_SCENARIOS) {
    const occurrences = forecastEntries
      .filter((entry) => entry.scenario === scenario)
      .flatMap((entry) =>
        expandForecastOccurrences(
          {
            ...entry,
            originalAmount: entry.originalAmount.toString(),
            estimatedRsdAmount: entry.estimatedRsdAmount.toString(),
          },
          selectedYear
        )
      );

    const projection = computeProjection(
      invoices,
      occurrences,
      basis,
      selectedYear,
      threshold,
      scenario,
      limitCurrency
    );

    projections[scenario] = {
      projectedTotal: projection.projectedTotal.toFixed(4),
      projectedRemaining: projection.projectedRemaining.toFixed(4),
      projectedPercentUsed: projection.projectedPercentUsed,
      projectedThresholdState: projection.projectedThresholdState,
      forecastContribution: projection.forecastContribution.toFixed(4),
      crossingMonth: projection.crossingMonth,
    };
  }

  const snapshots = await prisma.forecastSnapshot.findMany({
    where: {
      organizationId: ctx.organizationId,
      year: selectedYear,
    },
    orderBy: [{ updatedAt: "desc" }],
    select: {
      id: true,
      name: true,
      year: true,
      description: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return {
    data: serializeForClient({
      year: selectedYear,
      threshold,
      basis,
      limitStatus: {
        actualTotal: limitStatus.actualTotal.toFixed(4),
        remaining: limitStatus.remaining.toFixed(4),
        percentUsed: limitStatus.percentUsed,
        thresholdState: limitStatus.thresholdState,
        excludedCount: limitStatus.excludedCount,
      },
      monthlyActuals,
      monthlyPlan,
      exchangeRates,
      projections,
      snapshots,
      editableFromMonth,
      stiltAuto: stiltClient?.hourlyRate
        ? {
            clientName: stiltClient.displayName,
            hourlyRate: stiltClient.hourlyRate.toString(),
            currency: stiltClient.hourlyCurrency ?? "EUR",
          }
        : null,
    }),
  };
}

export async function upsertMonthlyForecastAction(input: {
  year: number;
  month: number;
  scenario: ForecastScenario;
  originalAmount: string;
  currency: string;
}) {
  const ctx = await getOrgContext();

  if (!FORECAST_SCENARIOS.includes(input.scenario)) {
    return { error: "Invalid scenario" };
  }

  if (input.month < 1 || input.month > 12) {
    return { error: "Invalid month" };
  }

  if (!FORECAST_CURRENCIES.includes(input.currency as (typeof FORECAST_CURRENCIES)[number])) {
    return { error: "Invalid currency" };
  }

  const now = new Date();
  const firstEditableMonth = now.getMonth() + 2;
  if (
    input.year < now.getFullYear() ||
    (input.year === now.getFullYear() && input.month < firstEditableMonth)
  ) {
    return { error: "PAST_MONTH_NOT_EDITABLE" };
  }

  const monthStart = new Date(input.year, input.month - 1, 1);
  const monthEnd = new Date(input.year, input.month, 0);

  const stiltEntry = await prisma.forecastEntry.findFirst({
    where: {
      organizationId: ctx.organizationId,
      status: "ACTIVE",
      scenario: input.scenario,
      notes: STILT_MONTHLY_PLAN_NOTE,
      expectedDate: { gte: monthStart, lte: monthEnd },
    },
  });

  const existing = await prisma.forecastEntry.findFirst({
    where: {
      organizationId: ctx.organizationId,
      status: "ACTIVE",
      scenario: input.scenario,
      notes: MONTHLY_PLAN_NOTE,
      expectedDate: { gte: monthStart, lte: monthEnd },
    },
  });

  const originalAmount = new Decimal(input.originalAmount || "0");
  if (originalAmount.lte(0)) {
    if (existing) {
      await prisma.forecastEntry.update({
        where: { id: existing.id },
        data: { status: "CANCELLED" },
      });
      await writeAuditEvent({
        organizationId: ctx.organizationId,
        entityType: "ForecastEntry",
        entityId: existing.id,
        action: "FORECAST_CANCELLED",
        actorUserId: ctx.userId,
        payload: { reason: "monthly_plan_cleared" },
      });
    }
    return {
      data: {
        entryId: null,
        originalAmount: "0",
        currency: input.currency,
        amountRsd: "0",
      },
    };
  }

  if (stiltEntry) {
    await prisma.forecastEntry.update({
      where: { id: stiltEntry.id },
      data: { status: "CANCELLED" },
    });
  }

  const { rsdAmount, planningRateLabel, planningRateUsed } = await computeCurrentRsd(
    input.currency,
    originalAmount.toFixed(4)
  );

  const expectedDate = new Date(input.year, input.month - 1, 15);
  const originalAmountStr = originalAmount.toFixed(4);

  if (existing) {
    const updated = await prisma.forecastEntry.update({
      where: { id: existing.id },
      data: {
        originalAmount: originalAmountStr,
        estimatedRsdAmount: rsdAmount,
        currency: input.currency,
        planningRateUsed,
        planningRateLabel,
        expectedDate,
      },
    });

    await writeAuditEvent({
      organizationId: ctx.organizationId,
      entityType: "ForecastEntry",
      entityId: existing.id,
      action: "FORECAST_UPDATED",
      actorUserId: ctx.userId,
      payload: {
        type: "monthly_plan",
        year: input.year,
        month: input.month,
        scenario: input.scenario,
        originalAmount: originalAmountStr,
        currency: input.currency,
        amountRsd: rsdAmount,
      },
    });

    return {
      data: serializeForClient({
        entryId: updated.id,
        originalAmount: originalAmountStr,
        currency: input.currency,
        amountRsd: rsdAmount,
      }),
    };
  }

  const created = await prisma.forecastEntry.create({
    data: {
      organizationId: ctx.organizationId,
      expectedDate,
      originalAmount: originalAmountStr,
      currency: input.currency,
      scenario: input.scenario,
      confidence: "PLANNED",
      recurrence: "ONE_TIME",
      planningRateUsed,
      estimatedRsdAmount: rsdAmount,
      planningRateLabel,
      notes: MONTHLY_PLAN_NOTE,
      createdBy: ctx.userId,
    },
  });

  await writeAuditEvent({
    organizationId: ctx.organizationId,
    entityType: "ForecastEntry",
    entityId: created.id,
    action: "FORECAST_CREATED",
    actorUserId: ctx.userId,
    payload: {
      type: "monthly_plan",
      year: input.year,
      month: input.month,
      scenario: input.scenario,
      originalAmount: originalAmountStr,
      currency: input.currency,
      amountRsd: rsdAmount,
    },
  });

  return {
    data: serializeForClient({
      entryId: created.id,
      originalAmount: originalAmountStr,
      currency: input.currency,
      amountRsd: rsdAmount,
    }),
  };
}
