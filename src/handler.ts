import type { Handler } from "aws-lambda";
import { loadConfig } from "./config/env.js";
import { runDailyBatch } from "./jobs/runDailyBatch.js";

/**
 * Scheduled (EventBridge) or manual Lambda invocation.
 * Returns a structured JSON payload for logs/monitoring.
 */
export const handler: Handler = async () => {
  const config = loadConfig(process.env);
  try {
    const result = await runDailyBatch(config);
    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: message }),
    };
  }
};
