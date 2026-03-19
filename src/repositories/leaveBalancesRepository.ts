import type pg from "pg";

/** Intentionally thin — accrual mutation lives in leaveAccrualService (single transactional CTE). */
export type LeaveBalanceRow = {
  id: string;
  userId: string;
  leaveYearId: string;
  type: string;
  entitled: number;
  remaining: number;
};

export async function countPaidBalancesForYear(
  client: pg.Pool | pg.PoolClient,
  leaveYearId: string,
): Promise<number> {
  const res = await client.query<{ c: string }>(
    `SELECT count(*)::text AS c FROM public.employee_leave_balances WHERE "leaveYearId" = $1 AND type = 'PAID'`,
    [leaveYearId],
  );
  return Number.parseInt(res.rows[0]?.c ?? "0", 10);
}
