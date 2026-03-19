import type { AppConfig } from "../config/env.js";

export type LogLevel = "debug" | "info" | "warn" | "error";

const ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export function createLogger(config: Pick<AppConfig, "LOG_LEVEL">) {
  const min = ORDER[config.LOG_LEVEL] ?? ORDER.info;

  function log(level: LogLevel, msg: string, meta?: Record<string, unknown>) {
    if (ORDER[level] < min) return;
    const line = {
      ts: new Date().toISOString(),
      level,
      msg,
      ...meta,
    };
    console.log(JSON.stringify(line));
  }

  return {
    debug: (msg: string, meta?: Record<string, unknown>) => log("debug", msg, meta),
    info: (msg: string, meta?: Record<string, unknown>) => log("info", msg, meta),
    warn: (msg: string, meta?: Record<string, unknown>) => log("warn", msg, meta),
    error: (msg: string, meta?: Record<string, unknown>) => log("error", msg, meta),
  };
}

export type Logger = ReturnType<typeof createLogger>;
