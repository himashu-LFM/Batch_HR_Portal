import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { classifyCelebrations, todayMonthDayKey } from "../src/services/celebrationService";
import type { EmployeeProfileRow } from "../src/repositories/employeeProfilesRepository";
import type { AppConfig } from "../src/config/env";

const baseConfig: Pick<AppConfig, "ACTIVE_EMPLOYEE_STATUSES" | "INACTIVE_EMPLOYEE_STATUSES"> = {
  ACTIVE_EMPLOYEE_STATUSES: [],
  INACTIVE_EMPLOYEE_STATUSES: ["INACTIVE"],
};

describe("celebrations classification", () => {
  it("todayMonthDayKey aligns with SQL MM-DD", () => {
    const t = DateTime.fromObject({ year: 2026, month: 3, day: 9 }, { zone: "Asia/Kolkata" });
    expect(todayMonthDayKey(t)).toBe("03-09");
  });

  it("classifies birthday and anniversary from mmdd fields", () => {
    const today = DateTime.fromObject({ year: 2026, month: 3, day: 19 }, { zone: "Asia/Kolkata" });
    const join = new Date("2020-03-19T00:00:00.000Z");
    const row: EmployeeProfileRow = {
      id: "u1",
      email: "a@b.com",
      preferred_name: null,
      first_name: "A",
      last_name: "B",
      birth_date: null,
      date_of_joining: join,
      employee_status: "ACTIVE",
      birth_mmdd: "03-19",
      join_mmdd: "03-19",
    };
    const out = classifyCelebrations([row], today, baseConfig);
    expect(out.birthdays).toHaveLength(1);
    expect(out.anniversaries).toHaveLength(1);
    expect(out.anniversaries[0].years).toBe(6);
  });

  it("skips work anniversary on hire date (0 completed years)", () => {
    const today = DateTime.fromObject({ year: 2026, month: 3, day: 19 }, { zone: "Asia/Kolkata" });
    const join = new Date("2026-03-19T00:00:00.000Z");
    const row: EmployeeProfileRow = {
      id: "u2",
      email: "c@d.com",
      preferred_name: null,
      first_name: "C",
      last_name: "D",
      birth_date: null,
      date_of_joining: join,
      employee_status: "ACTIVE",
      birth_mmdd: null,
      join_mmdd: "03-19",
    };
    const out = classifyCelebrations([row], today, baseConfig);
    expect(out.anniversaries).toHaveLength(0);
  });
});
