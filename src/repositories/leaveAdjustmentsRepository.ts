import type pg from "pg";

/**
 * Check idempotency marker for monthly accrual (same keys as business rule).
 */
export async function hasMonthlyAccrualAdjustment(
  client: pg.Pool | pg.PoolClient,
  leaveYearId: string,
  userId: string,
  amount: number,
  reason: string,
): Promise<boolean> {
  const res = await client.query<{ ok: boolean }>(
    `
    SELECT EXISTS (
      SELECT 1 FROM public.leave_adjustments
      WHERE "leaveYearId" = $1
        AND "userId" = $2
        AND type = 'PAID'
        AND delta = $3::double precision
        AND reason = $4
    ) AS ok
    `,
    [leaveYearId, userId, amount, reason],
  );
  return Boolean(res.rows[0]?.ok);
}
