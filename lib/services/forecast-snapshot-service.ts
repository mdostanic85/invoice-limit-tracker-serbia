import { prisma } from "@/lib/db/prisma";
import { writeAuditEvent } from "@/lib/services/audit-service";
import {
  FORECAST_SCENARIOS,
  MONTHLY_PLAN_NOTE,
  STILT_MONTHLY_PLAN_NOTE,
  type ForecastScenario,
} from "@/lib/constants/forecast";
import { FORECAST_CURRENCIES } from "@/lib/constants/currencies";
import type { ForecastSnapshotData } from "@/lib/domain/forecast-snapshot";
import Decimal from "decimal.js";

type ConvertToRsd = (
  currency: string,
  originalAmount: string
) => Promise<{
  rsdAmount: string;
  planningRateLabel: string;
  planningRateUsed: string;
}>;

function getEditableFromMonth(year: number, now = new Date()): number {
  if (year > now.getFullYear()) return 1;
  if (year < now.getFullYear()) return 13;
  return now.getMonth() + 2;
}

async function upsertMonthlyPlanCell({
  organizationId,
  userId,
  year,
  month,
  scenario,
  originalAmount,
  currency,
  convertToRsd,
}: {
  organizationId: string;
  userId: string;
  year: number;
  month: number;
  scenario: ForecastScenario;
  originalAmount: string;
  currency: string;
  convertToRsd: ConvertToRsd;
}) {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);

  const stiltEntry = await prisma.forecastEntry.findFirst({
    where: {
      organizationId,
      status: "ACTIVE",
      scenario,
      notes: STILT_MONTHLY_PLAN_NOTE,
      expectedDate: { gte: monthStart, lte: monthEnd },
    },
  });

  const existing = await prisma.forecastEntry.findFirst({
    where: {
      organizationId,
      status: "ACTIVE",
      scenario,
      notes: MONTHLY_PLAN_NOTE,
      expectedDate: { gte: monthStart, lte: monthEnd },
    },
  });

  const amount = new Decimal(originalAmount || "0");
  if (amount.lte(0)) {
    if (existing) {
      await prisma.forecastEntry.update({
        where: { id: existing.id },
        data: { status: "CANCELLED" },
      });
      await writeAuditEvent({
        organizationId,
        entityType: "ForecastEntry",
        entityId: existing.id,
        action: "FORECAST_CANCELLED",
        actorUserId: userId,
        payload: { reason: "snapshot_load_cleared" },
      });
    }
    return;
  }

  if (stiltEntry) {
    await prisma.forecastEntry.update({
      where: { id: stiltEntry.id },
      data: { status: "CANCELLED" },
    });
  }

  const { rsdAmount, planningRateLabel, planningRateUsed } = await convertToRsd(
    currency,
    amount.toFixed(4)
  );
  const expectedDate = new Date(year, month - 1, 15);
  const originalAmountStr = amount.toFixed(4);

  if (existing) {
    await prisma.forecastEntry.update({
      where: { id: existing.id },
      data: {
        originalAmount: originalAmountStr,
        estimatedRsdAmount: rsdAmount,
        currency,
        planningRateUsed,
        planningRateLabel,
        expectedDate,
      },
    });
    return;
  }

  await prisma.forecastEntry.create({
    data: {
      organizationId,
      expectedDate,
      originalAmount: originalAmountStr,
      currency,
      scenario,
      confidence: "PLANNED",
      recurrence: "ONE_TIME",
      planningRateUsed,
      estimatedRsdAmount: rsdAmount,
      planningRateLabel,
      notes: MONTHLY_PLAN_NOTE,
      createdBy: userId,
    },
  });
}

export async function applyForecastSnapshot({
  organizationId,
  userId,
  year,
  data,
  convertToRsd,
}: {
  organizationId: string;
  userId: string;
  year: number;
  data: ForecastSnapshotData;
  convertToRsd: ConvertToRsd;
}) {
  const editableFromMonth = getEditableFromMonth(year);

  for (const scenario of FORECAST_SCENARIOS) {
    for (const [monthKey, cell] of Object.entries(data.monthlyPlan[scenario])) {
      if (!monthKey.startsWith(String(year))) continue;

      const month = Number(monthKey.split("-")[1]);
      if (!Number.isFinite(month) || month < editableFromMonth) continue;

      const currency = FORECAST_CURRENCIES.includes(
        cell.currency as (typeof FORECAST_CURRENCIES)[number]
      )
        ? cell.currency
        : "RSD";

      await upsertMonthlyPlanCell({
        organizationId,
        userId,
        year,
        month,
        scenario,
        originalAmount: cell.originalAmount,
        currency,
        convertToRsd,
      });
    }
  }
}
