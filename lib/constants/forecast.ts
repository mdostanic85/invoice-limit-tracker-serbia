/** Internal marker for month-level forecast rows created from the planning grid. */
export const MONTHLY_PLAN_NOTE = "__monthly_plan__";

/** Auto-generated monthly forecast for Stilt (daily billing, previous month). */
export const STILT_MONTHLY_PLAN_NOTE = "__monthly_plan_stilt__";

export const STILT_CLIENT_NAME = "Stilt";

export const FORECAST_SCENARIOS = ["CONSERVATIVE", "EXPECTED", "OPTIMISTIC"] as const;

export type ForecastScenario = (typeof FORECAST_SCENARIOS)[number];
