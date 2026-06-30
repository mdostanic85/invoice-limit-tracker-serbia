import Decimal from "decimal.js";

/** Standard work-day length used when converting hourly rates to daily billing. */
export const HOURS_PER_WORK_DAY = 8;

/** Count Mon–Fri days in a calendar month (1-based month). */
export function countWeekdaysInMonth(year: number, month: number): number {
  const daysInMonth = new Date(year, month, 0).getDate();
  let count = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    const dayOfWeek = new Date(year, month - 1, day).getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) count++;
  }
  return count;
}

export function hasHourlyRateChanged(
  previous: { rate: string | null; currency: string | null },
  next: { rate: string | null; currency: string | null }
): boolean {
  if (!next.rate || !next.currency) return false;
  if (!previous.rate || !previous.currency) return true;
  const prev = new Decimal(previous.rate);
  const nxt = new Decimal(next.rate);
  return !prev.equals(nxt) || previous.currency !== next.currency;
}

export function calculateHourlyAmount(hours: string, ratePerHour: string): string {
  return new Decimal(hours).times(ratePerHour).toFixed(4);
}

export function calculateBillableHours(amount: string, ratePerHour: string): string {
  return new Decimal(amount).div(ratePerHour).toFixed(4);
}

export function calculateDailyRate(ratePerHour: string): string {
  return new Decimal(ratePerHour).times(HOURS_PER_WORK_DAY).toFixed(4);
}

export function calculateDailyAmount(days: string, ratePerHour: string): string {
  return new Decimal(days).times(ratePerHour).times(HOURS_PER_WORK_DAY).toFixed(4);
}

export function calculateBillableDays(amount: string, ratePerHour: string): string {
  return new Decimal(amount).div(ratePerHour).div(HOURS_PER_WORK_DAY).toFixed(4);
}
