import type pg from "pg";
import type { AppConfig } from "../config/env.js";
import { activeEmployeeSql } from "../utils/employeeStatus.js";

export type EmployeeProfileRow = {
  id: string;
  email: string | null;
  preferred_name: string | null;
  first_name: string | null;
  last_name: string | null;
  birth_date: Date | null;
  date_of_joining: Date | null;
  employee_status: string | null;
  /** MM-DD from DB (birth_date::date), for reliable matching vs Asia/Kolkata "today". */
  birth_mmdd: string | null;
  /** MM-DD from DB (date_of_joining::date). */
  join_mmdd: string | null;
};

/**
 * Employees matching birthday OR work-anniversary on the given calendar month/day (active filter only).
 * Uses EXTRACT on ::date to avoid Node timezone misreads on `timestamp without time zone`.
 */
export async function findActiveCelebrationCandidates(
  client: pg.Pool | pg.PoolClient,
  config: AppConfig,
  month: number,
  day: number,
): Promise<EmployeeProfileRow[]> {
  const act = activeEmployeeSql(config, "ep", 1);
  const sql = `
    SELECT
      ep.id,
      ep.email,
      ep.preferred_name,
      ep.first_name,
      ep.last_name,
      ep.birth_date,
      ep.date_of_joining,
      ep.employee_status,
      to_char(ep.birth_date::date, 'MM-DD') AS birth_mmdd,
      to_char(ep.date_of_joining::date, 'MM-DD') AS join_mmdd
    FROM public.employee_profiles ep
    WHERE ${act.clause}
      AND (
        (
          ep.birth_date IS NOT NULL
          AND EXTRACT(MONTH FROM ep.birth_date::date) = $${act.nextParam}
          AND EXTRACT(DAY FROM ep.birth_date::date) = $${act.nextParam + 1}
        )
        OR (
          ep.date_of_joining IS NOT NULL
          AND EXTRACT(MONTH FROM ep.date_of_joining::date) = $${act.nextParam}
          AND EXTRACT(DAY FROM ep.date_of_joining::date) = $${act.nextParam + 1}
        )
      )
  `;
  const params = [...act.params, String(month), String(day)];
  const res = await client.query<EmployeeProfileRow>(sql, params);
  return res.rows;
}
