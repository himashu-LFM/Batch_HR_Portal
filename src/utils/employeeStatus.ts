import type { AppConfig } from "../config/env.js";

/**
 * Centralized active-employee SQL predicate for `employee_profiles`.
 * - If ACTIVE_EMPLOYEE_STATUSES is non-empty: status must be in that allowlist.
 * - Else: status must not be in INACTIVE_EMPLOYEE_STATUSES (default excludes INACTIVE).
 * - If both lists were empty, defaults to INACTIVE-only blocklist via env loader.
 */
export function activeEmployeeSql(
  config: Pick<AppConfig, "ACTIVE_EMPLOYEE_STATUSES" | "INACTIVE_EMPLOYEE_STATUSES">,
  alias: string,
  startParam: number,
): { clause: string; params: string[]; nextParam: number } {
  const col = `${alias}.employee_status`;
  let idx = startParam;
  if (config.ACTIVE_EMPLOYEE_STATUSES.length > 0) {
    const ph = config.ACTIVE_EMPLOYEE_STATUSES.map(() => {
      const p = `$${idx}`;
      idx += 1;
      return p;
    }).join(", ");
    return {
      clause: `${col} IN (${ph})`,
      params: [...config.ACTIVE_EMPLOYEE_STATUSES],
      nextParam: idx,
    };
  }
  if (config.INACTIVE_EMPLOYEE_STATUSES.length > 0) {
    const ph = config.INACTIVE_EMPLOYEE_STATUSES.map(() => {
      const p = `$${idx}`;
      idx += 1;
      return p;
    }).join(", ");
    return {
      clause: `(${col} IS NULL OR ${col} NOT IN (${ph}))`,
      params: [...config.INACTIVE_EMPLOYEE_STATUSES],
      nextParam: idx,
    };
  }
  return { clause: "TRUE", params: [], nextParam: startParam };
}

export function isEmployeeActive(
  status: string | null | undefined,
  config: Pick<AppConfig, "ACTIVE_EMPLOYEE_STATUSES" | "INACTIVE_EMPLOYEE_STATUSES">,
): boolean {
  const s = status ?? "";
  if (config.ACTIVE_EMPLOYEE_STATUSES.length > 0) {
    return config.ACTIVE_EMPLOYEE_STATUSES.includes(s);
  }
  if (config.INACTIVE_EMPLOYEE_STATUSES.length > 0) {
    return !config.INACTIVE_EMPLOYEE_STATUSES.includes(s);
  }
  return true;
}
