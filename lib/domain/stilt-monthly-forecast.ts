import {
  calculateDailyAmount,
  countWeekdaysInMonth,
} from "@/lib/utils/hourly-billing";

export interface StiltForecastMonth {
  forecastYear: number;
  forecastMonth: number;
  billableDays: number;
  billedForMonth: number;
  billedForYear: number;
}

/** Invoice issued at the start of `forecastMonth` covers the previous month's weekdays (Mon–Fri). */
export function getStiltForecastMonth(
  forecastYear: number,
  forecastMonth: number
): StiltForecastMonth {
  const billedForMonth = forecastMonth === 1 ? 12 : forecastMonth - 1;
  const billedForYear = forecastMonth === 1 ? forecastYear - 1 : forecastYear;
  const billableDays = countWeekdaysInMonth(billedForYear, billedForMonth);

  return {
    forecastYear,
    forecastMonth,
    billableDays,
    billedForMonth,
    billedForYear,
  };
}

export function calculateStiltForecastAmount(
  forecastYear: number,
  forecastMonth: number,
  hourlyRate: string
): { billableDays: number; originalAmount: string } {
  const { billableDays } = getStiltForecastMonth(forecastYear, forecastMonth);
  return {
    billableDays,
    originalAmount: calculateDailyAmount(String(billableDays), hourlyRate),
  };
}

export function isStiltClientName(displayName: string): boolean {
  return displayName.trim().toLowerCase() === "stilt";
}
