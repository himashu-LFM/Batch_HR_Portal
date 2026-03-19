import { randomUUID } from "node:crypto";

/** Text id for DB rows (e.g. leave_adjustments.id). */
export function newTextId(): string {
  return randomUUID();
}
