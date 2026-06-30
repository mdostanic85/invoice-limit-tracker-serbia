"use server";

import { getOrgContext } from "@/lib/auth/get-org-context";
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import { writeAuditEvent } from "@/lib/services/audit-service";
import { serializeForClient } from "@/lib/utils/serialize";
import {
  FORECAST_SNAPSHOT_VERSION,
  isForecastSnapshotData,
  type ForecastSnapshotData,
  type ForecastSnapshotMonthCell,
} from "@/lib/domain/forecast-snapshot";
import {
  FORECAST_SCENARIOS,
  type ForecastScenario,
} from "@/lib/constants/forecast";
import { applyForecastSnapshot } from "@/lib/services/forecast-snapshot-service";
import { getExchangeRateProvider } from "@/lib/exchange-rate";
import Decimal from "decimal.js";

const SNAPSHOT_NAME_MAX = 80;
const SNAPSHOT_DESCRIPTION_MAX = 500;

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

function normalizeSnapshotInput(
  monthlyPlan: Record<ForecastScenario, Record<string, ForecastSnapshotMonthCell>>
): ForecastSnapshotData {
  const normalized = {
    version: FORECAST_SNAPSHOT_VERSION,
    monthlyPlan: {
      CONSERVATIVE: {} as Record<string, ForecastSnapshotMonthCell>,
      EXPECTED: {} as Record<string, ForecastSnapshotMonthCell>,
      OPTIMISTIC: {} as Record<string, ForecastSnapshotMonthCell>,
    },
  } satisfies ForecastSnapshotData;

  for (const scenario of FORECAST_SCENARIOS) {
    for (const [monthKey, cell] of Object.entries(monthlyPlan[scenario] ?? {})) {
      normalized.monthlyPlan[scenario][monthKey] = {
        originalAmount: cell.originalAmount || "0",
        currency: cell.currency || "RSD",
      };
    }
  }

  return normalized;
}

export async function listForecastSnapshotsAction(year?: number) {
  const ctx = await getOrgContext();

  const snapshots = await prisma.forecastSnapshot.findMany({
    where: {
      organizationId: ctx.organizationId,
      ...(year !== undefined ? { year } : {}),
    },
    orderBy: [{ year: "desc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      name: true,
      year: true,
      description: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return { data: serializeForClient(snapshots) };
}

export async function getForecastSnapshotAction(id: string) {
  const ctx = await getOrgContext();

  const snapshot = await prisma.forecastSnapshot.findUnique({
    where: { id },
  });

  if (!snapshot || snapshot.organizationId !== ctx.organizationId) {
    return { error: "SNAPSHOT_NOT_FOUND" };
  }

  if (!isForecastSnapshotData(snapshot.data)) {
    return { error: "SNAPSHOT_INVALID" };
  }

  return {
    data: serializeForClient({
      id: snapshot.id,
      name: snapshot.name,
      year: snapshot.year,
      description: snapshot.description,
      createdAt: snapshot.createdAt,
      updatedAt: snapshot.updatedAt,
      data: snapshot.data,
    }),
  };
}

export async function saveForecastSnapshotAction(input: {
  name: string;
  year: number;
  description?: string | null;
  monthlyPlan: Record<ForecastScenario, Record<string, ForecastSnapshotMonthCell>>;
}) {
  const ctx = await getOrgContext();
  const name = input.name.trim();

  if (!name) return { error: "SNAPSHOT_NAME_REQUIRED" };
  if (name.length > SNAPSHOT_NAME_MAX) return { error: "SNAPSHOT_NAME_TOO_LONG" };

  const description = input.description?.trim() || null;
  if (description && description.length > SNAPSHOT_DESCRIPTION_MAX) {
    return { error: "SNAPSHOT_DESCRIPTION_TOO_LONG" };
  }

  const data = normalizeSnapshotInput(input.monthlyPlan);

  const snapshot = await prisma.forecastSnapshot.upsert({
    where: {
      organizationId_year_name: {
        organizationId: ctx.organizationId,
        year: input.year,
        name,
      },
    },
    update: {
      description,
      data: data as unknown as Prisma.InputJsonValue,
      createdBy: ctx.userId,
    },
    create: {
      organizationId: ctx.organizationId,
      name,
      year: input.year,
      description,
      data: data as unknown as Prisma.InputJsonValue,
      createdBy: ctx.userId,
    },
  });

  await writeAuditEvent({
    organizationId: ctx.organizationId,
    entityType: "ForecastSnapshot",
    entityId: snapshot.id,
    action: "FORECAST_SNAPSHOT_SAVED",
    actorUserId: ctx.userId,
    payload: { name, year: input.year },
  });

  return {
    data: serializeForClient({
      id: snapshot.id,
      name: snapshot.name,
      year: snapshot.year,
      description: snapshot.description,
      createdAt: snapshot.createdAt,
      updatedAt: snapshot.updatedAt,
    }),
  };
}

export async function loadForecastSnapshotAction(id: string) {
  const ctx = await getOrgContext();

  const snapshot = await prisma.forecastSnapshot.findUnique({
    where: { id },
  });

  if (!snapshot || snapshot.organizationId !== ctx.organizationId) {
    return { error: "SNAPSHOT_NOT_FOUND" };
  }

  if (!isForecastSnapshotData(snapshot.data)) {
    return { error: "SNAPSHOT_INVALID" };
  }

  await applyForecastSnapshot({
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    year: snapshot.year,
    data: snapshot.data,
    convertToRsd: computeCurrentRsd,
  });

  await writeAuditEvent({
    organizationId: ctx.organizationId,
    entityType: "ForecastSnapshot",
    entityId: snapshot.id,
    action: "FORECAST_SNAPSHOT_LOADED",
    actorUserId: ctx.userId,
    payload: { name: snapshot.name, year: snapshot.year },
  });

  return { data: { id: snapshot.id, year: snapshot.year } };
}

export async function deleteForecastSnapshotAction(id: string) {
  const ctx = await getOrgContext();

  const snapshot = await prisma.forecastSnapshot.findUnique({
    where: { id },
  });

  if (!snapshot || snapshot.organizationId !== ctx.organizationId) {
    return { error: "SNAPSHOT_NOT_FOUND" };
  }

  await prisma.forecastSnapshot.delete({ where: { id } });

  await writeAuditEvent({
    organizationId: ctx.organizationId,
    entityType: "ForecastSnapshot",
    entityId: id,
    action: "FORECAST_SNAPSHOT_DELETED",
    actorUserId: ctx.userId,
    payload: { name: snapshot.name, year: snapshot.year },
  });

  return { data: { id } };
}
