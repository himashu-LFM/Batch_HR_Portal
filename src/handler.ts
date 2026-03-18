import type { Handler } from "aws-lambda"
import { getPool } from "./db.js"
import { sendEmail } from "./email/ses.js"
import { anniversaryTemplate, birthdayTemplate } from "./email/templates.js"
import { loadEnvIfLocal } from "./env.js"
import { randomUUID } from "node:crypto"

type Event = {
  dryRun?: boolean
  force?: boolean
  todayOverride?: string // YYYY-MM-DD
  credit?: number
}

function parseTodayOverride(override?: string) {
  if (!override) return null
  const d = new Date(`${override}T00:00:00`)
  return isNaN(d.getTime()) ? null : d
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0)
}

function nextMonthStart(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1, 0, 0, 0, 0)
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function isFirstOfMonth(d: Date) {
  return d.getDate() === 1
}

const LEAVE_TYPE_PAID = "PAID"

async function monthlyLeaveCredit(params: {
  now: Date
  dryRun: boolean
  force: boolean
  credit: number
}) {
  if (!params.force && !isFirstOfMonth(params.now)) {
    return { ok: true, skipped: true, reason: "Not 1st day", month: monthKey(params.now) }
  }

  const credit = params.credit
  if (!(credit > 0)) throw new Error("Invalid credit amount")

  const pool = getPool()
  const client = await pool.connect()
  try {
    const year = params.now.getFullYear()
    const mStart = startOfMonth(params.now)
    const mNext = nextMonthStart(params.now)
    const reason = `MONTHLY_CREDIT:${monthKey(params.now)}`

    await client.query("BEGIN")
    await client.query("SELECT pg_advisory_lock(hashtext($1))", ["batch:monthly-leave-credit"])

    // Resolve leave year id. Some DBs don't have a default generator for leave_years.id.
    const existingLeaveYear = await client.query<{ id: string }>(`SELECT id FROM leave_years WHERE year = $1 LIMIT 1`, [year])
    let leaveYearId = existingLeaveYear.rows[0]?.id
    if (!leaveYearId) {
      const newId = randomUUID()
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO leave_years (id, year, "createdAt")
         VALUES ($1, $2, NOW())
         RETURNING id`,
        [newId, year]
      )
      leaveYearId = inserted.rows[0]?.id
    }
    if (!leaveYearId) throw new Error("Failed to resolve leave year")

    // Idempotency check: any adjustment for this month means job already ran
    const already = await client.query<{ id: string }>(
      `SELECT id
         FROM leave_adjustments
        WHERE "leaveYearId" = $1
          AND type = $2
          AND reason = $3
          AND "createdAt" >= $4
          AND "createdAt" < $5
        LIMIT 1`,
      [leaveYearId, LEAVE_TYPE_PAID, reason, mStart, mNext]
    )
    if (already.rows.length > 0) {
      await client.query("ROLLBACK")
      return { ok: true, skipped: true, reason: "Already applied", month: monthKey(params.now), credit }
    }

    const usersRes = await client.query<{ id: string }>(`SELECT id FROM users`)
    const userIds = usersRes.rows.map((r) => r.id)
    if (userIds.length === 0) {
      await client.query("ROLLBACK")
      return { ok: true, skipped: true, reason: "No users", month: monthKey(params.now), credit }
    }

    if (params.dryRun) {
      await client.query("ROLLBACK")
      return { ok: true, dryRun: true, month: monthKey(params.now), credit, usersTotal: userIds.length }
    }

    // Ensure PAID balances exist for leaveYear.
    // Some DBs don't have a default generator for employee_leave_balances.id, so we insert missing rows in code.
    const existingBalances = await client.query<{ userId: string }>(
      `SELECT "userId" as "userId"
         FROM employee_leave_balances
        WHERE "leaveYearId" = $1
          AND type = $2`,
      [leaveYearId, LEAVE_TYPE_PAID]
    )
    const existingUserIds = new Set(existingBalances.rows.map((r) => r.userId))
    for (const uid of userIds) {
      if (existingUserIds.has(uid)) continue
      await client.query(
        `INSERT INTO employee_leave_balances (id,"leaveYearId","userId",type,entitled,used,remaining,"createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,0,0,0,NOW(),NOW())`,
        [randomUUID(), leaveYearId, uid, LEAVE_TYPE_PAID]
      )
    }

    // Credit balances
    await client.query(
      `UPDATE employee_leave_balances
          SET entitled = entitled + $1,
              remaining = remaining + $1,
              "updatedAt" = NOW()
        WHERE "leaveYearId" = $2
          AND type = $3`,
      [credit, leaveYearId, LEAVE_TYPE_PAID]
    )

    // Audit per user (createdById must be a valid user; using same userId).
    // Some DBs may not have a default generator for leave_adjustments.id too, so insert in code.
    for (const uid of userIds) {
      await client.query(
        `INSERT INTO leave_adjustments (id,"leaveYearId","userId",type,delta,reason,"createdById","createdAt")
         VALUES ($1,$2,$3,$4,$5,$6,$3,NOW())`,
        [randomUUID(), leaveYearId, uid, LEAVE_TYPE_PAID, credit, reason]
      )
    }

    await client.query("COMMIT")
    return { ok: true, month: monthKey(params.now), credit, usersCredited: userIds.length }
  } catch (e) {
    try {
      await client.query("ROLLBACK")
    } catch {
      // ignore
    }
    throw e
  } finally {
    try {
      await client.query("SELECT pg_advisory_unlock(hashtext($1))", ["batch:monthly-leave-credit"])
    } catch {
      // ignore
    }
    client.release()
  }
}

async function dailyCelebrations(params: { now: Date; dryRun: boolean; force: boolean }) {
  const fromEmail = process.env.SES_FROM_EMAIL
  if (!fromEmail) throw new Error("Missing SES_FROM_EMAIL")

  const systemUserId = process.env.SYSTEM_USER_ID
  if (!systemUserId) throw new Error("Missing SYSTEM_USER_ID (must be an existing users.id)")

  const testToEmail = process.env.TEST_TO_EMAIL?.trim() || null

  const today = params.now
  const todayKey = dayKey(today)
  const mm = today.getMonth() + 1
  const dd = today.getDate()

  const pool = getPool()
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    await client.query("SELECT pg_advisory_lock(hashtext($1))", ["batch:daily-celebrations"])

    async function resolveColumnName(tableName: string, candidates: string[]) {
      const res = await client.query<{ column_name: string }>(
        `
        SELECT column_name
          FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = $1
           AND column_name = ANY($2::text[])
        `,
        [tableName, candidates]
      )
      return res.rows[0]?.column_name ?? null
    }

    // Idempotency markers (one per day per type). We store markers in automation_emails.subject.
    const birthdayMarker = `[BATCH:BIRTHDAY:${todayKey}]`
    const anniversaryMarker = `[BATCH:ANNIVERSARY:${todayKey}]`

    const alreadyBirthday = await client.query(`SELECT 1 FROM automation_emails WHERE subject = $1 LIMIT 1`, [birthdayMarker])
    const alreadyAnniv = await client.query(`SELECT 1 FROM automation_emails WHERE subject = $1 LIMIT 1`, [anniversaryMarker])

    // Birthdays
    let birthdaySent = 0
    let birthdayFailed = 0
    const birthdayErrors: string[] = []
    let birthdayMatches: Array<{ email: string; name: string | null }> = []
    if (alreadyBirthday.rows.length === 0 || params.force) {
      const bdays = await client.query<{
        userId: string
        email: string
        name: string | null
        birth_date: Date | null
      }>(
        `SELECT u.id as "userId", u.email, u.name, p.birth_date
           FROM users u
           JOIN employee_profiles p ON p."userId" = u.id
          WHERE p.birth_date IS NOT NULL
            AND EXTRACT(MONTH FROM p.birth_date) = $1
            AND EXTRACT(DAY FROM p.birth_date) = $2`,
        [mm, dd]
      )
      birthdayMatches = bdays.rows.map((r) => ({ email: r.email, name: r.name }))

      if (!params.dryRun) {
        for (const row of bdays.rows) {
          const firstName = (row.name || row.email).split(" ")[0] || "there"
          const tpl = birthdayTemplate({ firstName })
          const res = await sendEmail({
            to: testToEmail || row.email,
            from: fromEmail,
            subject: testToEmail ? `[TEST for ${row.email}] ${tpl.subject}` : tpl.subject,
            bodyText: testToEmail ? `ORIGINAL_RECIPIENT=${row.email}\n\n${tpl.bodyText}` : tpl.bodyText,
            bodyHtml: tpl.bodyHtml,
          })
          if (res.ok) birthdaySent++
          else {
            birthdayFailed++
            birthdayErrors.push(res.error)
          }
        }
      }

      // Record marker (even in dryRun, record nothing)
      if (!params.dryRun && !params.force) {
        await client.query(
          `INSERT INTO automation_emails (subject, body, recipients, "sentCount", "failedCount", "sentById", "sentAt")
           VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [birthdayMarker, "Birthday batch marker", bdays.rows.map((r) => r.email), birthdaySent, birthdayFailed, systemUserId]
        )
      }
    }

    // Anniversaries
    let annivSent = 0
    let annivFailed = 0
    const annivErrors: string[] = []
    let anniversaryMatches: Array<{ email: string; name: string | null; years: number }> = []
    if (alreadyAnniv.rows.length === 0 || params.force) {
      const joinDateColumn =
        (await resolveColumnName("employee_profiles", [
          "date_of_joining",
          "joining_date",
          "date_of_join",
          "doj",
          "join_date",
        ])) ?? null
      if (!joinDateColumn) {
        throw new Error(
          `Could not find join date column on employee_profiles. Tried: date_of_joining, joining_date, date_of_join, doj, join_date`
        )
      }

      // Safe: joinDateColumn is chosen from the fixed whitelist above (not user input).
      const joinDateIdent = `"${joinDateColumn}"`

      const annivs = await client.query<{
        userId: string
        email: string
        name: string | null
        join_date: Date | null
      }>(
        `SELECT u.id as "userId", u.email, u.name, p.${joinDateIdent} as join_date
           FROM users u
           JOIN employee_profiles p ON p."userId" = u.id
          WHERE p.${joinDateIdent} IS NOT NULL
            AND EXTRACT(MONTH FROM p.${joinDateIdent}) = $1
            AND EXTRACT(DAY FROM p.${joinDateIdent}) = $2`,
        [mm, dd]
      )

      if (!params.dryRun) {
        for (const row of annivs.rows) {
          const doj = row.join_date
          if (!doj) continue
          const years = today.getFullYear() - doj.getFullYear()
          if (years <= 0) continue // ignore 0-year
          anniversaryMatches.push({ email: row.email, name: row.name, years })

          const firstName = (row.name || row.email).split(" ")[0] || "there"
          const tpl = anniversaryTemplate({ firstName, years })
          const res = await sendEmail({
            to: testToEmail || row.email,
            from: fromEmail,
            subject: testToEmail ? `[TEST for ${row.email}] ${tpl.subject}` : tpl.subject,
            bodyText: testToEmail ? `ORIGINAL_RECIPIENT=${row.email}\n\n${tpl.bodyText}` : tpl.bodyText,
            bodyHtml: tpl.bodyHtml,
          })
          if (res.ok) annivSent++
          else {
            annivFailed++
            annivErrors.push(res.error)
          }
        }
      }

      if (!params.dryRun && !params.force) {
        await client.query(
          `INSERT INTO automation_emails (subject, body, recipients, "sentCount", "failedCount", "sentById", "sentAt")
           VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [anniversaryMarker, "Anniversary batch marker", annivs.rows.map((r) => r.email), annivSent, annivFailed, systemUserId]
        )
      }
    }

    await client.query("COMMIT")
    return {
      ok: true,
      day: todayKey,
      dryRun: params.dryRun,
      birthdays: { sent: birthdaySent, failed: birthdayFailed },
      anniversaries: { sent: annivSent, failed: annivFailed },
      errors: {
        birthdays: birthdayErrors.slice(0, 10),
        anniversaries: annivErrors.slice(0, 10),
      },
      matches: {
        birthdays: birthdayMatches,
        anniversaries: anniversaryMatches,
      },
      testToEmail,
    }
  } catch (e) {
    try {
      await client.query("ROLLBACK")
    } catch {
      // ignore
    }
    throw e
  } finally {
    try {
      await client.query("SELECT pg_advisory_unlock(hashtext($1))", ["batch:daily-celebrations"])
    } catch {
      // ignore
    }
    client.release()
  }
}

export const handler: Handler<Event> = async (event) => {
  loadEnvIfLocal()

  const now = parseTodayOverride(event?.todayOverride) ?? new Date()
  const dryRun = event?.dryRun === true || process.env.DRY_RUN === "1"
  const force = event?.force === true || process.env.FORCE_RUN === "1"
  const credit = typeof event?.credit === "number" && !Number.isNaN(event.credit) ? event.credit : 1.5

  const results: any = { ok: true, now: now.toISOString(), dryRun, force }

  // Daily celebrations always checked
  results.dailyCelebrations = await dailyCelebrations({ now, dryRun, force })

  // Monthly credit only on 1st (unless forced)
  results.monthlyLeaveCredit = await monthlyLeaveCredit({ now, dryRun, force, credit })

  return results
}

// Local runner: `npm run run:local`
if (process.env.RUN_LOCAL === "1") {
  ;(async () => {
    try {
      const todayOverride = process.env.TODAY_OVERRIDE || "2026-03-01"
      const dryRun = process.env.DRY_RUN === "1"
      const force = process.env.FORCE_RUN === "1"
      const res = await handler(
        { dryRun, force, todayOverride, credit: 1.5 } as any,
        {} as any,
        () => {}
      )
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(res, null, 2))
      process.exit(0)
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e)
      process.exit(1)
    }
  })()
}

