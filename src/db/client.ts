import pg from "pg";
import type { AppConfig } from "../config/env.js";

const { Pool } = pg;

/**
 * When DATABASE_USE_SSL is unset: use TLS for remote hosts (RDS, etc.); plain for localhost.
 * Lambda → RDS almost always needs TLS or Postgres returns "no encryption" in pg_hba.
 */
export function inferDatabaseUseSsl(databaseUrl: string): boolean {
  try {
    const normalized = databaseUrl.replace(/^postgres(ql)?:\/\//i, "http://");
    const u = new URL(normalized);
    const h = u.hostname.toLowerCase();
    if (h === "localhost" || h === "127.0.0.1" || h === "::1") return false;
    return true;
  } catch {
    return true;
  }
}

export function createPool(
  config: Pick<AppConfig, "DATABASE_URL" | "DATABASE_SSL_REJECT_UNAUTHORIZED" | "DATABASE_USE_SSL">,
): pg.Pool {
  if (!config.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  const useSsl = config.DATABASE_USE_SSL ?? inferDatabaseUseSsl(config.DATABASE_URL);
  const ssl = useSsl
    ? { rejectUnauthorized: config.DATABASE_SSL_REJECT_UNAUTHORIZED }
    : undefined;

  return new Pool({
    connectionString: config.DATABASE_URL,
    ...(ssl ? { ssl } : {}),
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
}
