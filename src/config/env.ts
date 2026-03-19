export type LogLevel = "debug" | "info" | "warn" | "error";

export type LeaveYearLookupMode = "env" | "table" | "";

export type AppConfig = {
  NODE_ENV: string;
  DATABASE_URL: string;
  /**
   * When false, `pg` uses `ssl: { rejectUnauthorized: false }` so self-signed / private-CA DB certs work (typical local dev).
   * Do not disable in production unless you understand the risk.
   */
  DATABASE_SSL_REJECT_UNAUTHORIZED: boolean;
  AWS_REGION: string;
  APP_TIMEZONE: string;
  SYSTEM_USER_ID: string;
  SES_FROM_EMAIL: string;
  SES_FROM_NAME: string;
  SES_NOTIFICATION_TO: string;
  SES_REPLY_TO: string;
  SES_CONFIGURATION_SET: string;
  LEAVE_ACCRUAL_AMOUNT: number;
  BATCH_HOUR: number;
  BATCH_MINUTE: number;
  ACTIVE_EMPLOYEE_STATUSES: string[];
  INACTIVE_EMPLOYEE_STATUSES: string[];
  LEAVE_YEAR_LOOKUP_MODE: LeaveYearLookupMode;
  CURRENT_LEAVE_YEAR_ID: string;
  LEAVE_YEAR_TABLE: string;
  LEAVE_YEAR_ID_COLUMN: string;
  LEAVE_YEAR_START_COLUMN: string;
  LEAVE_YEAR_END_COLUMN: string;
  LOG_LEVEL: LogLevel;
};

function splitCsv(raw: string | undefined): string[] {
  if (!raw || !raw.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseIntEnv(name: string, raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === "") return fallback;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) throw new Error(`Invalid integer for ${name}: ${raw}`);
  return n;
}

function parseFloatEnv(name: string, raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === "") return fallback;
  const n = Number.parseFloat(raw);
  if (Number.isNaN(n)) throw new Error(`Invalid number for ${name}: ${raw}`);
  return n;
}

function parseLogLevel(raw: string | undefined): LogLevel {
  const v = (raw ?? "info").toLowerCase();
  if (v === "debug" || v === "info" || v === "warn" || v === "error") return v;
  return "info";
}

/** Default true (verify TLS certs). Set env to false/0/no to allow self-signed DB chains (local dev). */
function parseSslRejectUnauthorized(raw: string | undefined): boolean {
  if (raw === undefined || raw === "") return true;
  const v = raw.toLowerCase();
  if (v === "false" || v === "0" || v === "no") return false;
  return true;
}

/**
 * Loads configuration from process.env. Call after dotenv in local runs.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const mode = (env.LEAVE_YEAR_LOOKUP_MODE ?? "").toLowerCase() as LeaveYearLookupMode;
  const normalizedMode: LeaveYearLookupMode =
    mode === "env" || mode === "table" ? mode : "";

  return {
    NODE_ENV: env.NODE_ENV ?? "development",
    DATABASE_URL: env.DATABASE_URL ?? "",
    DATABASE_SSL_REJECT_UNAUTHORIZED: parseSslRejectUnauthorized(env.DATABASE_SSL_REJECT_UNAUTHORIZED),
    AWS_REGION: env.AWS_REGION ?? env.AWS_DEFAULT_REGION ?? "ap-south-1",
    APP_TIMEZONE: env.APP_TIMEZONE ?? "Asia/Kolkata",
    SYSTEM_USER_ID: env.SYSTEM_USER_ID ?? "",
    SES_FROM_EMAIL: env.SES_FROM_EMAIL ?? "",
    SES_FROM_NAME: env.SES_FROM_NAME ?? "HR Batch",
    SES_NOTIFICATION_TO: env.SES_NOTIFICATION_TO ?? "",
    SES_REPLY_TO: env.SES_REPLY_TO ?? "",
    SES_CONFIGURATION_SET: env.SES_CONFIGURATION_SET ?? "",
    LEAVE_ACCRUAL_AMOUNT: parseFloatEnv("LEAVE_ACCRUAL_AMOUNT", env.LEAVE_ACCRUAL_AMOUNT, 1.5),
    BATCH_HOUR: parseIntEnv("BATCH_HOUR", env.BATCH_HOUR, 8),
    BATCH_MINUTE: parseIntEnv("BATCH_MINUTE", env.BATCH_MINUTE, 1),
    ACTIVE_EMPLOYEE_STATUSES: splitCsv(env.ACTIVE_EMPLOYEE_STATUSES),
    INACTIVE_EMPLOYEE_STATUSES: splitCsv(env.INACTIVE_EMPLOYEE_STATUSES).length
      ? splitCsv(env.INACTIVE_EMPLOYEE_STATUSES)
      : ["INACTIVE"],
    LEAVE_YEAR_LOOKUP_MODE: normalizedMode,
    CURRENT_LEAVE_YEAR_ID: env.CURRENT_LEAVE_YEAR_ID ?? "",
    LEAVE_YEAR_TABLE: env.LEAVE_YEAR_TABLE ?? "",
    LEAVE_YEAR_ID_COLUMN: env.LEAVE_YEAR_ID_COLUMN ?? "",
    LEAVE_YEAR_START_COLUMN: env.LEAVE_YEAR_START_COLUMN ?? "",
    LEAVE_YEAR_END_COLUMN: env.LEAVE_YEAR_END_COLUMN ?? "",
    LOG_LEVEL: parseLogLevel(env.LOG_LEVEL),
  };
}

export function assertRequiredForProduction(config: AppConfig, warnings: string[]): void {
  if (!config.DATABASE_URL) warnings.push("DATABASE_URL is empty");
  if (!config.SYSTEM_USER_ID) warnings.push("SYSTEM_USER_ID is empty");
  if (!config.SES_FROM_EMAIL) warnings.push("SES_FROM_EMAIL is empty");
  if (!config.SES_NOTIFICATION_TO) warnings.push("SES_NOTIFICATION_TO is empty");
  if (config.NODE_ENV === "production" && config.DATABASE_SSL_REJECT_UNAUTHORIZED === false) {
    warnings.push("DATABASE_SSL_REJECT_UNAUTHORIZED=false weakens TLS verification — avoid in production if possible");
  }
}
