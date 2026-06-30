import {
  FORECAST_SCENARIOS,
  type ForecastScenario,
} from "@/lib/constants/forecast";

export const FORECAST_SNAPSHOT_VERSION = 1 as const;

export interface ForecastSnapshotMonthCell {
  originalAmount: string;
  currency: string;
}

export interface ForecastSnapshotData {
  version: typeof FORECAST_SNAPSHOT_VERSION;
  monthlyPlan: Record<ForecastScenario, Record<string, ForecastSnapshotMonthCell>>;
}

export interface ForecastSnapshotSummary {
  id: string;
  name: string;
  year: number;
  description: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export function isForecastSnapshotData(value: unknown): value is ForecastSnapshotData {
  if (!value || typeof value !== "object") return false;
  const data = value as ForecastSnapshotData;
  if (data.version !== FORECAST_SNAPSHOT_VERSION) return false;
  if (!data.monthlyPlan || typeof data.monthlyPlan !== "object") return false;

  return FORECAST_SCENARIOS.every((scenario) => {
    const plan = data.monthlyPlan[scenario];
    return plan && typeof plan === "object";
  });
}

export function buildMonthKeys(year: number): string[] {
  return Array.from({ length: 12 }, (_, index) =>
    `${year}-${String(index + 1).padStart(2, "0")}`
  );
}

export function emptySnapshotMonthlyPlan(
  year: number
): Record<ForecastScenario, Record<string, ForecastSnapshotMonthCell>> {
  const monthKeys = buildMonthKeys(year);
  return {
    CONSERVATIVE: Object.fromEntries(
      monthKeys.map((key) => [key, { originalAmount: "0", currency: "RSD" }])
    ),
    EXPECTED: Object.fromEntries(
      monthKeys.map((key) => [key, { originalAmount: "0", currency: "RSD" }])
    ),
    OPTIMISTIC: Object.fromEntries(
      monthKeys.map((key) => [key, { originalAmount: "0", currency: "RSD" }])
    ),
  };
}
