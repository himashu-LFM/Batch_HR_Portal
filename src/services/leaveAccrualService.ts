import type pg from "pg";
import type { AppConfig } from "../config/env.js";
import { activeEmployeeSql } from "../utils/employeeStatus.js";
import type { Logger } from "../utils/logger.js";

/**
 * Single transaction: idempotent monthly PAID accrual via NOT EXISTS on leave_adjustments.reason
 * and matching delta/type/user/year. Updates balances only for the same candidate set as inserts.
 */
export async function applyMonthlyPaidAccrual(
  client: pg.PoolClient,
  config: AppConfig,
  leaveYearId: string,
  reason: string,
  amount: number,
  log: Logger,
): Promise<number> {
  if (!config.SYSTEM_USER_ID) {
    throw new Error("SYSTEM_USER_ID is required for leave_adjustments.createdById");
  }

  const act = activeEmployeeSql(config, "ep", 2);
  const reasonIdx = act.nextParam;
  const amountIdx = act.nextParam + 1;
  const createdIdx = act.nextParam + 2;

  const sql = `
    WITH candidates AS (
      SELECT elb.id AS balance_id, elb."userId" AS user_id
      FROM public.employee_leave_balances elb
      INNER JOIN public.employee_profiles ep ON ep.id = elb."userId"
      WHERE elb."leaveYearId" = $1
        AND elb.type = 'PAID'
        AND ${act.clause}
        AND NOT EXISTS (
          SELECT 1
          FROM public.leave_adjustments la
          WHERE la."leaveYearId" = $1
            AND la."userId" = elb."userId"
            AND la.type = 'PAID'
            AND la.delta = $${amountIdx}::double precision
            AND la.reason = $${reasonIdx}
        )
    ),
    balance_updates AS (
      UPDATE public.employee_leave_balances elb
      SET
        entitled = elb.entitled + $${amountIdx}::double precision,
        remaining = elb.remaining + $${amountIdx}::double precision
      FROM candidates c
      WHERE elb.id = c.balance_id
      RETURNING elb."userId" AS user_id
    )
    INSERT INTO public.leave_adjustments (
      id,
      "leaveYearId",
      "userId",
      type,
      delta,
      reason,
      "createdById",
      "createdAt"
    )
    SELECT
      gen_random_uuid()::text,
      $1,
      bu.user_id,
      'PAID',
      $${amountIdx}::double precision,
      $${reasonIdx},
      $${createdIdx},
      NOW()
    FROM balance_updates bu
    RETURNING id
  `;

  const params: unknown[] = [leaveYearId, ...act.params, reason, amount, config.SYSTEM_USER_ID];

  const res = await client.query<{ id: string }>(sql, params);
  const n = res.rowCount ?? res.rows.length;
  log.info("monthly_accrual_applied", { processed: n, leaveYearId, reason });
  return n;
}
