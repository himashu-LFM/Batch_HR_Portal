import type pg from "pg";
import type { AppConfig } from "../config/env.js";
import type { Logger } from "../utils/logger.js";
import { DateTime } from "luxon";

const IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function assertIdent(label: string, value: string): void {
  if (!value || !IDENT.test(value)) {
    throw new Error(
      `Invalid SQL identifier for ${label}: "${value}". Use only letters, numbers, underscore; must start with letter or underscore.`,
    );
  }
}

/**
 * Resolves the current leave year id for business operations.
 *
 * **You must align `LEAVE_YEAR_*` / `CURRENT_LEAVE_YEAR_ID` with your real schema.**
 * See README: "Leave year lookup".
 */
export async function getCurrentLeaveYearId(
  client: pg.Pool | pg.PoolClient,
  config: AppConfig,
  todayInAppTz: DateTime,
  log: Logger,
): Promise<string> {
  const mode = config.LEAVE_YEAR_LOOKUP_MODE;

  if (mode === "env") {
    const id = config.CURRENT_LEAVE_YEAR_ID?.trim();
    if (!id) {
      throw new Error(
        'LEAVE_YEAR_LOOKUP_MODE=env requires CURRENT_LEAVE_YEAR_ID. Set it in the environment or switch to "table" mode.',
      );
    }
    log.info("leave_year_resolved", { mode: "env", leaveYearId: id });
    return id;
  }

  if (mode === "table") {
    const table = config.LEAVE_YEAR_TABLE.trim();
    const idCol = config.LEAVE_YEAR_ID_COLUMN.trim();
    const startCol = config.LEAVE_YEAR_START_COLUMN.trim();
    const endCol = config.LEAVE_YEAR_END_COLUMN.trim();
    assertIdent("LEAVE_YEAR_TABLE", table);
    assertIdent("LEAVE_YEAR_ID_COLUMN", idCol);
    assertIdent("LEAVE_YEAR_START_COLUMN", startCol);
    assertIdent("LEAVE_YEAR_END_COLUMN", endCol);

    const day = todayInAppTz.toISODate();
    if (!day) throw new Error("Could not format today's date for leave year lookup");

    const sql = `
      SELECT "${idCol}"::text AS id
      FROM public."${table}"
      WHERE $1::date BETWEEN "${startCol}"::date AND "${endCol}"::date
      LIMIT 1
    `;
    const res = await client.query<{ id: string }>(sql, [day]);
    const row = res.rows[0];
    if (!row?.id) {
      throw new Error(
        `No leave year row in public."${table}" contains ${day} (between "${startCol}" and "${endCol}").`,
      );
    }
    log.info("leave_year_resolved", { mode: "table", leaveYearId: row.id, table });
    return row.id;
  }

  throw new Error(
    'Leave year lookup is not configured. Set LEAVE_YEAR_LOOKUP_MODE to "env" (and CURRENT_LEAVE_YEAR_ID) or "table" (and LEAVE_YEAR_* columns). See README.',
  );
}
