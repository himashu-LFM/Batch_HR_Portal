import { describe, expect, it } from "vitest";
import { activeEmployeeSql, isEmployeeActive } from "../src/utils/employeeStatus";
import type { AppConfig } from "../src/config/env";

function cfg(partial: Partial<AppConfig>): Pick<AppConfig, "ACTIVE_EMPLOYEE_STATUSES" | "INACTIVE_EMPLOYEE_STATUSES"> {
  return {
    ACTIVE_EMPLOYEE_STATUSES: partial.ACTIVE_EMPLOYEE_STATUSES ?? [],
    INACTIVE_EMPLOYEE_STATUSES: partial.INACTIVE_EMPLOYEE_STATUSES ?? ["INACTIVE"],
  };
}

describe("employeeStatus", () => {
  it("defaults to allowlist wins: active list restricts", () => {
    const c = cfg({ ACTIVE_EMPLOYEE_STATUSES: ["ACTIVE", "PROBATION"] });
    expect(isEmployeeActive("ACTIVE", c)).toBe(true);
    expect(isEmployeeActive("INACTIVE", c)).toBe(false);
  });

  it("blocklist excludes configured inactive statuses", () => {
    const c = cfg({ ACTIVE_EMPLOYEE_STATUSES: [], INACTIVE_EMPLOYEE_STATUSES: ["INACTIVE", "TERMINATED"] });
    expect(isEmployeeActive("ACTIVE", c)).toBe(true);
    expect(isEmployeeActive("INACTIVE", c)).toBe(false);
    expect(isEmployeeActive("TERMINATED", c)).toBe(false);
  });

  it("activeEmployeeSql uses correct placeholder start index", () => {
    const c = cfg({ INACTIVE_EMPLOYEE_STATUSES: ["INACTIVE"] });
    const q = activeEmployeeSql(c, "ep", 2);
    expect(q.clause).toContain("$2");
    expect(q.params).toEqual(["INACTIVE"]);
    expect(q.nextParam).toBe(3);
  });
});
