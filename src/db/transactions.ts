import type pg from "pg";

export async function withTransaction<T>(client: pg.Pool, fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await client.connect();
  try {
    await c.query("BEGIN");
    const out = await fn(c);
    await c.query("COMMIT");
    return out;
  } catch (e) {
    try {
      await c.query("ROLLBACK");
    } catch {
      /* ignore rollback errors */
    }
    throw e;
  } finally {
    c.release();
  }
}
