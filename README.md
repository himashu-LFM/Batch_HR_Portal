## People Lens Combined Batch (AWS Lambda)

One Lambda that runs daily at **08:00 AM** and performs:
- **Daily celebrations**: birthday + work anniversary emails (if any match today)
- **Monthly leave credit**: on the **1st day of month**, credits **PAID leave +1.5** for all users

This project is **standalone** (outside `hr-portal/`) so you can push it to a separate GitHub repo and deploy to AWS Lambda.

---

## What it touches in DB

### Monthly leave credit
- `leave_years` (ensures current year exists)
- `employee_leave_balances` (ensures `PAID` row exists, then increments entitled+remaining)
- `leave_adjustments` (writes per-user audit marker `MONTHLY_CREDIT:YYYY-MM`)

Idempotency: if a `leave_adjustments` record exists for the month with reason `MONTHLY_CREDIT:YYYY-MM`, it **skips**.

### Daily emails
- Reads `employee_profiles.birth_date` and `employee_profiles.date_of_joining` joined with `users.email`
- Sends email via **Amazon SES**
- Writes idempotency markers to `automation_emails.subject`:
  - `[BATCH:BIRTHDAY:YYYY-MM-DD]`
  - `[BATCH:ANNIVERSARY:YYYY-MM-DD]`

> Note: `automation_emails.sentById` is required in your schema. Set `SYSTEM_USER_ID` to an existing `users.id`.

### How to choose `SYSTEM_USER_ID`
`SYSTEM_USER_ID` must be a **real** `users.id` in your database (because `automation_emails.sentById` has a foreign-key relation to `users`).

Recommended options:
- Use an existing HR/Admin user’s `users.id`
- Or create a dedicated “system” user in `users` and use that `id`

Quick SQL to pick one:

```sql
SELECT id, email, name
FROM users
ORDER BY createdAt ASC
LIMIT 5;
```

---

## Environment variables

Copy `.env.example` to `.env.local` and fill values.

Required:
- `DATABASE_URL`
- `AWS_REGION`
- `SES_FROM_EMAIL`
- `SYSTEM_USER_ID` (must exist in `users` table)

Recommended for RDS:
- `PGSSLMODE=require`

Optional:
- `DRY_RUN=1` (no DB writes, no emails)
- `FORCE_RUN=1` (ignores “already ran” checks and “1st day” check)

---

## Build

```bash
npm install
npm run build
```

## Run locally (dry run)

```bash
cp .env.example .env.local
# fill env vars in .env.local (or set them in your shell)
npm run build
npm run run:local
```

---

## Deploy to AWS Lambda (zip)

1) Build + install:
```bash
npm install
npm run build
```

2) Create deployment zip:
```bash
npm run zip
```

3) AWS Lambda settings:
- Runtime: **Node.js 20.x**
- Handler: `dist/handler.handler`
- Upload: `dist.zip`
- Set env vars from `.env.example`

---

## Scheduling (EventBridge)

Create a schedule to trigger daily at **08:00** (your timezone decision).
Input can be empty `{}`.

For testing:
```json
{ "force": true, "todayOverride": "2026-03-01", "dryRun": true }
```

