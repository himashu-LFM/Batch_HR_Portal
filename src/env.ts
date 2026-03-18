import { config } from "dotenv"
import { existsSync } from "node:fs"

export function loadEnvIfLocal() {
  if (process.env.RUN_LOCAL !== "1") return

  // Prefer .env.local, fallback to .env
  const envLocal = ".env.local"
  const env = ".env"

  if (existsSync(envLocal)) {
    config({ path: envLocal })
    return
  }
  if (existsSync(env)) {
    config({ path: env })
  }
}

