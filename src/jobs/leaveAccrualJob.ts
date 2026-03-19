import type { DateTime } from "luxon";
import type { AppConfig } from "../config/env.js";
import { withTransaction } from "../db/transactions.js";
import type pg from "pg";
import { getCurrentLeaveYearId } from "../services/leaveYearService.js";
import { applyMonthlyPaidAccrual } from "../services/leaveAccrualService.js";
import { monthlyPaidAccrualReason } from "../utils/dates.js";
import type { Logger } from "../utils/logger.js";

export type LeaveAccrualJobResult = {
  attempted: boolean;
  skippedReason?: string;
  processedCount: number;
};

/**
 * On the 1st of the month (Asia/Kolkata calendar), accrue PAID leave once per employee per month (idempotent).
 */
export async function runLeaveAccrualJob(
  pool: pg.Pool,
  config: AppConfig,
  today: DateTime,
  log: Logger,
): Promise<LeaveAccrualJobResult> {
  if (today.day !== 1) {
    return { attempted: false, skippedReason: "not_first_of_month", processedCount: 0 };
  }

  const leaveYearId = await getCurrentLeaveYearId(pool, config, today, log);
  const reason = monthlyPaidAccrualReason(today);
  const amount = config.LEAVE_ACCRUAL_AMOUNT;

  const processedCount = await withTransaction(pool, (c) =>
    applyMonthlyPaidAccrual(c, config, leaveYearId, reason, amount, log),
  );

  return { attempted: true, processedCount };
}
