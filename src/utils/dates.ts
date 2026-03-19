import { DateTime } from "luxon";

/**
 * Today in the configured IANA timezone (business calendar date for batch logic).
 */
export function todayInTimezone(timezone: string): DateTime {
  return DateTime.now().setZone(timezone).startOf("day");
}

/** YYYY-MM for monthly accrual idempotency marker. */
export function yearMonthKey(dt: DateTime): string {
  return dt.toFormat("yyyy-MM");
}

/** Deterministic reason stored on leave_adjustments for monthly PAID accrual. */
export function monthlyPaidAccrualReason(dt: DateTime): string {
  return `MONTHLY_PAID_ACCRUAL:${yearMonthKey(dt)}`;
}

/**
 * Compare calendar month/day only (birthdays). Uses integer month 1-12 and day 1-31.
 */
export function isSameMonthDay(
  month: number,
  day: number,
  todayMonth: number,
  todayDay: number,
): boolean {
  return month === todayMonth && day === todayDay;
}

/**
 * Completed full years of service as of `asOf` (on the anniversary date, counts the year just completed).
 * Example: joined 2020-03-19, asOf 2025-03-19 → 5.
 */
export function completedServiceYears(joining: DateTime, asOf: DateTime): number {
  const j = joining.startOf("day");
  const a = asOf.startOf("day");
  if (a < j) return 0;
  let years = a.year - j.year;
  if (a.month < j.month || (a.month === j.month && a.day < j.day)) {
    years -= 1;
  }
  return Math.max(0, years);
}
