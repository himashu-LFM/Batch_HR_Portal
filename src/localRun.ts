/**
 * Local execution: `npm run local:run` (loads .env via dotenv).
 */
import "dotenv/config";
import { loadConfig } from "./config/env.js";
import { runDailyBatch } from "./jobs/runDailyBatch.js";

async function main() {
  const config = loadConfig(process.env);
  const out = await runDailyBatch(config);
  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
