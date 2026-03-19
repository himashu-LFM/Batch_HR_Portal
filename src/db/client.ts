import pg from "pg";
import type { AppConfig } from "../config/env.js";

const { Pool } = pg;

export function createPool(config: Pick<AppConfig, "DATABASE_URL" | "DATABASE_SSL_REJECT_UNAUTHORIZED">): pg.Pool {
  if (!config.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }
  const ssl =
    config.DATABASE_SSL_REJECT_UNAUTHORIZED === false ? { rejectUnauthorized: false as const } : undefined;

  return new Pool({
    connectionString: config.DATABASE_URL,
    ...(ssl ? { ssl } : {}),
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
}
