import { prisma } from "@/lib/db/prisma";
import {
  MONTHLY_PLAN_NOTE,
  STILT_MONTHLY_PLAN_NOTE,
} from "@/lib/constants/forecast";
import {
  calculateStiltForecastAmount,
  isStiltClientName,
} from "@/lib/domain/stilt-monthly-forecast";

interface RateConversion {
  rsdAmount: string;
  planningRateLabel: string;
  planningRateUsed: string;
}

interface SyncStiltMonthlyForecastInput {
  organizationId: string;
  userId: string;
  year: number;
  editableFromMonth: number;
  convertToRsd: (currency: string, originalAmount: string) => Promise<RateConversion>;
}

export async function syncStiltMonthlyForecast({
  organizationId,
  userId,
  year,
  editableFromMonth,
  convertToRsd,
}: SyncStiltMonthlyForecastInput): Promise<number> {
  const clients = await prisma.client.findMany({
    where: {
      organizationId,
      status: "ACTIVE",
      billingModel: "HOURLY",
    },
    select: {
      id: true,
      displayName: true,
      hourlyRate: true,
      hourlyCurrency: true,
    },
  });

  const client = clients.find((entry) => isStiltClientName(entry.displayName));
  if (!client?.hourlyRate) return 0;

  const hourlyRate = client.hourlyRate.toString();
  const currency = client.hourlyCurrency ?? "EUR";
  let synced = 0;

  for (let month = editableFromMonth; month <= 12; month++) {
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);

    const manualEntry = await prisma.forecastEntry.findFirst({
      where: {
        organizationId,
        status: "ACTIVE",
        scenario: "EXPECTED",
        notes: MONTHLY_PLAN_NOTE,
        expectedDate: { gte: monthStart, lte: monthEnd },
      },
    });
    if (manualEntry) continue;

    const { billableDays, originalAmount } = calculateStiltForecastAmount(
      year,
      month,
      hourlyRate
    );

    const { rsdAmount, planningRateLabel, planningRateUsed } = await convertToRsd(
      currency,
      originalAmount
    );

    const expectedDate = new Date(year, month - 1, 15);
    const existing = await prisma.forecastEntry.findFirst({
      where: {
        organizationId,
        status: "ACTIVE",
        scenario: "EXPECTED",
        notes: STILT_MONTHLY_PLAN_NOTE,
        expectedDate: { gte: monthStart, lte: monthEnd },
      },
    });

    const entryData = {
      clientId: client.id,
      expectedDate,
      originalAmount,
      currency,
      estimatedRsdAmount: rsdAmount,
      planningRateUsed,
      planningRateLabel,
      billableHours: String(billableDays),
      billingModel: "HOURLY" as const,
    };

    if (existing) {
      const unchanged =
        existing.originalAmount.toString() === originalAmount &&
        existing.currency === currency &&
        existing.estimatedRsdAmount.toString() === rsdAmount &&
        existing.billableHours?.toString() === String(billableDays);

      if (unchanged) continue;

      await prisma.forecastEntry.update({
        where: { id: existing.id },
        data: entryData,
      });
    } else {
      await prisma.forecastEntry.create({
        data: {
          organizationId,
          ...entryData,
          scenario: "EXPECTED",
          confidence: "PLANNED",
          recurrence: "ONE_TIME",
          notes: STILT_MONTHLY_PLAN_NOTE,
          createdBy: userId,
        },
      });
    }

    synced += 1;
  }

  return synced;
}
