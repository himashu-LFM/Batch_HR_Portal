import { DateTime } from "luxon";
import type { AppConfig } from "../config/env.js";
import type { EmployeeProfileRow } from "../repositories/employeeProfilesRepository.js";
import { findActiveCelebrationCandidates } from "../repositories/employeeProfilesRepository.js";
import { employeeDisplayName } from "../utils/names.js";
import { completedServiceYears } from "../utils/dates.js";
import { isEmployeeActive } from "../utils/employeeStatus.js";
import { anniversaryEmail } from "../templates/anniversaryTemplate.js";
import { birthdayEmail } from "../templates/birthdayTemplate.js";
import type { OutgoingMail } from "./sesService.js";
import { createSesClient, sendNotificationEmail } from "./sesService.js";
import type { Logger } from "../utils/logger.js";
import type pg from "pg";

export type CelebrationPerson = { userId: string; displayName: string };
export type AnniversaryPerson = CelebrationPerson & { years: number };

/** MM-DD string matching PostgreSQL to_char(..., 'MM-DD'). */
export function todayMonthDayKey(today: DateTime): string {
  return `${String(today.month).padStart(2, "0")}-${String(today.day).padStart(2, "0")}`;
}

export function classifyCelebrations(
  rows: EmployeeProfileRow[],
  today: DateTime,
  config: AppConfig,
): { birthdays: CelebrationPerson[]; anniversaries: AnniversaryPerson[] } {
  const key = todayMonthDayKey(today);
  const birthdays: CelebrationPerson[] = [];
  const anniversaries: AnniversaryPerson[] = [];

  for (const row of rows) {
    if (!isEmployeeActive(row.employee_status, config)) continue;

    if (row.birth_mmdd && row.birth_mmdd === key) {
      birthdays.push({
        userId: row.id,
        displayName: employeeDisplayName(row),
      });
    }

    if (row.join_mmdd && row.join_mmdd === key && row.date_of_joining) {
      const joined = DateTime.fromJSDate(row.date_of_joining, { zone: "utc" }).startOf("day");
      const years = completedServiceYears(joined, today);
      // Skip hire date (0 completed years); only real anniversaries.
      if (years >= 1) {
        anniversaries.push({
          userId: row.id,
          displayName: employeeDisplayName(row),
          years,
        });
      }
    }
  }

  return { birthdays, anniversaries };
}

export async function runCelebrationsNotification(
  pool: pg.Pool,
  config: AppConfig,
  today: DateTime,
  log: Logger,
): Promise<{
  birthdayCount: number;
  anniversaryCount: number;
  emailSent: boolean;
  /** One SES message per birthday + one per anniversary, all to SES_NOTIFICATION_TO */
  celebrationEmailsSent: number;
}> {
  const month = today.month;
  const day = today.day;
  const rows = await findActiveCelebrationCandidates(pool, config, month, day);
  const { birthdays, anniversaries } = classifyCelebrations(rows, today, config);

  if (birthdays.length === 0 && anniversaries.length === 0) {
    log.info("celebrations_none");
    return {
      birthdayCount: 0,
      anniversaryCount: 0,
      emailSent: false,
      celebrationEmailsSent: 0,
    };
  }

  const ses = createSesClient(config);
  const totalPlanned = birthdays.length + anniversaries.length;
  let celebrationEmailsSent = 0;
  const sendErrors: string[] = [];

  const send = async (mail: OutgoingMail, meta: { kind: "birthday" | "anniversary"; userId: string }) => {
    try {
      await sendNotificationEmail(ses, config, mail, log);
      celebrationEmailsSent += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      sendErrors.push(`${meta.kind} ${meta.userId}: ${msg}`);
      log.error("celebration_single_email_failed", { ...meta, err: msg });
    }
  };

  for (const person of birthdays) {
    const b = birthdayEmail([person]);
    await send(
      { subject: b.subject, htmlBody: b.html, textBody: b.text },
      { kind: "birthday", userId: person.userId },
    );
  }

  for (const person of anniversaries) {
    const a = anniversaryEmail([person]);
    await send(
      { subject: a.subject, htmlBody: a.html, textBody: a.text },
      { kind: "anniversary", userId: person.userId },
    );
  }

  if (celebrationEmailsSent === 0 && totalPlanned > 0) {
    throw new Error(
      `All ${totalPlanned} celebration email(s) failed: ${sendErrors.join(" | ")}`,
    );
  }

  if (sendErrors.length > 0) {
    log.warn("celebration_partial_send", {
      sent: celebrationEmailsSent,
      failed: sendErrors.length,
      totalPlanned,
    });
  }

  return {
    birthdayCount: birthdays.length,
    anniversaryCount: anniversaries.length,
    emailSent: celebrationEmailsSent > 0,
    celebrationEmailsSent,
  };
}
