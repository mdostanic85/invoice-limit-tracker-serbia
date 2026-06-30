import { describe, expect, it } from "vitest";
import {
  calculateStiltForecastAmount,
  getStiltForecastMonth,
} from "@/lib/domain/stilt-monthly-forecast";

describe("getStiltForecastMonth", () => {
  it("uses June days for a July invoice", () => {
    expect(getStiltForecastMonth(2026, 7)).toEqual({
      forecastYear: 2026,
      forecastMonth: 7,
      billableDays: 22,
      billedForMonth: 6,
      billedForYear: 2026,
    });
  });

  it("uses December days for a January invoice", () => {
    expect(getStiltForecastMonth(2027, 1)).toEqual({
      forecastYear: 2027,
      forecastMonth: 1,
      billableDays: 23,
      billedForMonth: 12,
      billedForYear: 2026,
    });
  });
});

describe("calculateStiltForecastAmount", () => {
  it("calculates days × hourly rate × 8 hours", () => {
    const result = calculateStiltForecastAmount(2026, 7, "50");
    expect(result.billableDays).toBe(22);
    expect(result.originalAmount).toBe("8800.0000");
  });
});
