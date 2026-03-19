import type { DateTime } from "luxon";
import type { AppConfig } from "../config/env.js";
import type pg from "pg";
import { runCelebrationsNotification } from "../services/celebrationService.js";
import type { Logger } from "../utils/logger.js";

export async function runCelebrationsJob(
  pool: pg.Pool,
  config: AppConfig,
  today: DateTime,
  log: Logger,
): Promise<{
  birthdayCount: number;
  anniversaryCount: number;
  emailSent: boolean;
  celebrationEmailsSent: number;
}> {
  return runCelebrationsNotification(pool, config, today, log);
}
