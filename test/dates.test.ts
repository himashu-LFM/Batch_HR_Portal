import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import {
  completedServiceYears,
  isSameMonthDay,
  monthlyPaidAccrualReason,
  todayInTimezone,
  yearMonthKey,
} from "../src/utils/dates";

describe("dates", () => {
  it("todayInTimezone returns start of day in zone", () => {
    const t = todayInTimezone("Asia/Kolkata");
    expect(t.zoneName).toBe("Asia/Kolkata");
    expect(t.hour).toBe(0);
    expect(t.minute).toBe(0);
  });

  it("isSameMonthDay matches month/day only", () => {
    expect(isSameMonthDay(3, 19, 3, 19)).toBe(true);
    expect(isSameMonthDay(3, 19, 3, 20)).toBe(false);
  });

  it("monthlyPaidAccrualReason is deterministic per month", () => {
    const dt = DateTime.fromObject({ year: 2026, month: 3, day: 1 }, { zone: "Asia/Kolkata" });
    expect(monthlyPaidAccrualReason(dt)).toBe("MONTHLY_PAID_ACCRUAL:2026-03");
    expect(yearMonthKey(dt)).toBe("2026-03");
  });

  it("completedServiceYears on anniversary date", () => {
    const joined = DateTime.fromObject({ year: 2020, month: 3, day: 19 }, { zone: "utc" });
    const asOf = DateTime.fromObject({ year: 2025, month: 3, day: 19 }, { zone: "utc" });
    expect(completedServiceYears(joined, asOf)).toBe(5);
  });

  it("completedServiceYears day before anniversary", () => {
    const joined = DateTime.fromObject({ year: 2020, month: 3, day: 19 }, { zone: "utc" });
    const asOf = DateTime.fromObject({ year: 2025, month: 3, day: 18 }, { zone: "utc" });
    expect(completedServiceYears(joined, asOf)).toBe(4);
  });
});
