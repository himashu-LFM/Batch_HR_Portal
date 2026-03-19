import type { AppConfig } from "../config/env.js";
import { createPool } from "../db/client.js";
import { todayInTimezone } from "../utils/dates.js";
import { createLogger } from "../utils/logger.js";
import { assertRequiredForProduction } from "../config/env.js";
import { runLeaveAccrualJob } from "./leaveAccrualJob.js";
import { runCelebrationsJob } from "./celebrationsJob.js";

export type DailyBatchResult = {
  date: string;
  timezone: string;
  accrualAttempted: boolean;
  accrualSkippedReason?: string;
  accrualProcessedCount: number;
  birthdayCount: number;
  anniversaryCount: number;
  emailSent: boolean;
  /** SES messages sent for celebrations (one per person: birthday + anniversary) */
  celebrationEmailsSent: number;
  warnings: string[];
};

export async function runDailyBatch(config: AppConfig): Promise<DailyBatchResult> {
  const log = createLogger(config);
  const warnings: string[] = [];
  assertRequiredForProduction(config, warnings);

  const tz = config.APP_TIMEZONE;
  const today = todayInTimezone(tz);
  const dateStr = today.toISODate() ?? "";

  log.info("batch_start", { date: dateStr, timezone: tz });

  const pool = createPool(config);

  try {
    let accrualAttempted = false;
    let accrualSkippedReason: string | undefined;
    let accrualProcessedCount = 0;

    try {
      const accrual = await runLeaveAccrualJob(pool, config, today, log);
      accrualAttempted = accrual.attempted;
      accrualSkippedReason = accrual.skippedReason;
      accrualProcessedCount = accrual.processedCount;
    } catch (e) {
      log.error("leave_accrual_job_failed", { err: String(e) });
      warnings.push(`Leave accrual failed: ${e instanceof Error ? e.message : String(e)}`);
    }

    let birthdayCount = 0;
    let anniversaryCount = 0;
    let emailSent = false;
    let celebrationEmailsSent = 0;

    try {
      const cel = await runCelebrationsJob(pool, config, today, log);
      birthdayCount = cel.birthdayCount;
      anniversaryCount = cel.anniversaryCount;
      emailSent = cel.emailSent;
      celebrationEmailsSent = cel.celebrationEmailsSent;
    } catch (e) {
      log.error("celebrations_job_failed", { err: String(e) });
      warnings.push(`Celebrations/email failed: ${e instanceof Error ? e.message : String(e)}`);
    }

    const result: DailyBatchResult = {
      date: dateStr,
      timezone: tz,
      accrualAttempted,
      accrualSkippedReason,
      accrualProcessedCount,
      birthdayCount,
      anniversaryCount,
      emailSent,
      celebrationEmailsSent,
      warnings,
    };

    log.info("batch_complete", result);
    return result;
  } catch (e) {
    log.error("batch_failed", { err: String(e) });
    throw e;
  } finally {
    await pool.end().catch(() => undefined);
  }
}
