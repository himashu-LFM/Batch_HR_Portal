# Batch HR Portal (AWS Lambda)

Lightweight **Node.js 20** Lambda that runs **once per day** to:

1. **Monthly PAID leave accrual** — on the **1st** of each month (calendar in `APP_TIMEZONE`, default **Asia/Kolkata**), add configurable entitlement to `public.employee_leave_balances` (`type = 'PAID'`) and append `public.leave_adjustments`, with **mandatory idempotency** per employee per month.
2. **Birthday & work-anniversary notices** — each run, query `public.employee_profiles`, detect same **month/day** as “today” in `APP_TIMEZONE`, and send **one SES email per person** (each birthday and each work anniversary) to **`SES_NOTIFICATION_TO`** (e.g. a DL), using the party-themed templates.

No REST API or UI — batch only.

## Architecture

- **Entry:** `src/handler.ts` → `runDailyBatch` (`src/jobs/runDailyBatch.ts`).
- **Jobs:** `leaveAccrualJob` (month-start only), `celebrationsJob` (every run).
- **Data:** `pg` + parameterized SQL; accrual wrapped in a **single DB transaction** (CTE: candidates → balance update → adjustments insert).
- **Mail:** `@aws-sdk/client-ses` `SendEmail` with HTML + text bodies from `src/templates/*`.
- **Time:** `luxon` for IANA timezone (`APP_TIMEZONE`).
- **Deploy:** [Serverless Framework](https://www.serverless.com/) v3 + `serverless-esbuild` (see `serverless.yml`).

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes (prod) | PostgreSQL URL for `pg`. |
| `DATABASE_SSL_REJECT_UNAUTHORIZED` | No | Default verify TLS. Set `false` if Postgres uses a self-signed / private CA cert. |
| `DATABASE_USE_SSL` | No | `true` / `false` to force TLS. If unset, TLS is **on** for non-localhost URLs (Lambda→RDS). |
| `AWS_REGION` | Yes | Region for SES (and Lambda). |
| `APP_TIMEZONE` | No | Default `Asia/Kolkata`. Defines “today” and month boundaries. |
| `SYSTEM_USER_ID` | Yes (accrual) | Written to `leave_adjustments."createdById"`. |
| `SES_FROM_EMAIL` | Yes (email) | Verified SES from address. |
| `SES_FROM_NAME` | No | Display name. |
| `SES_NOTIFICATION_TO` | Yes (email) | Single To-address (DL). |
| `SES_REPLY_TO` | No | Optional reply-to. |
| `SES_CONFIGURATION_SET` | No | Optional SES configuration set name. |
| `LEAVE_ACCRUAL_AMOUNT` | No | Default `1.5` (entitled + remaining). |
| `BATCH_HOUR` / `BATCH_MINUTE` | No | **Documentation / local intent**; real schedule is `SCHEDULE_CRON` (UTC). |
| `SCHEDULE_CRON` | No | **Deploy-time** EventBridge expression. Default `cron(31 2 * * ? *)` = **08:01 IST**. |
| `ACTIVE_EMPLOYEE_STATUSES` | No | CSV allowlist; if non-empty, only these statuses are “active”. |
| `INACTIVE_EMPLOYEE_STATUSES` | No | CSV blocklist when allowlist empty; default `INACTIVE`. |
| `LEAVE_YEAR_LOOKUP_MODE` | Yes (accrual) | `env` or `table` (see below). |
| `CURRENT_LEAVE_YEAR_ID` | If `env` mode | Fixed leave year id. |
| `LEAVE_YEAR_TABLE` / `LEAVE_YEAR_ID_COLUMN` / `LEAVE_YEAR_START_COLUMN` / `LEAVE_YEAR_END_COLUMN` | If `table` mode | Dynamic lookup (validated identifiers). |
| `LOG_LEVEL` | No | `debug` \| `info` \| `warn` \| `error` (default `info`). |
| `NODE_ENV` | No | e.g. `development` locally. |

Copy `.env.example` to `.env` for local runs.

## Scheduling (UTC vs Asia/Kolkata)

AWS EventBridge **rate/cron rules are expressed in UTC** when using the standard Serverless `schedule` event.

- **Default:** `cron(31 2 * * ? *)` → **02:31 UTC** → **08:01 Asia/Kolkata** (IST = UTC+5:30).
- If you change `BATCH_HOUR` / `BATCH_MINUTE`, recompute UTC and set `SCHEDULE_CRON` **at deploy time**, e.g.  
  `SCHEDULE_CRON='cron(M H * * ? *)' serverless deploy`

**EventBridge Scheduler** supports IANA timezones on schedules; this repo uses the classic EventBridge rule for minimal setup. To use Scheduler with `Asia/Kolkata`, add a custom resource or separate IaC — behavior of the Lambda itself stays the same.

## Idempotency (monthly accrual)

Accrual runs only when **today’s date** in `APP_TIMEZONE` is the **1st**.

Before updating balances, the SQL `NOT EXISTS` gate checks `public.leave_adjustments` for a row with:

- same `"leaveYearId"`, `"userId"`, `type = 'PAID'`, `delta = LEAVE_ACCRUAL_AMOUNT`
- `reason = 'MONTHLY_PAID_ACCRUAL:YYYY-MM'` (month from `APP_TIMEZONE`)

So **re-invocations on the same month-start do not double-accrue**. Updates and inserts run in **one transaction**.

## Leave year lookup (**must align with your schema**)

Implemented in **`src/services/leaveYearService.ts`** (`getCurrentLeaveYearId`).

| Mode | Config |
|------|--------|
| **`env`** | `LEAVE_YEAR_LOOKUP_MODE=env` and `CURRENT_LEAVE_YEAR_ID=<id>` |
| **`table`** | `LEAVE_YEAR_LOOKUP_MODE=table` plus table + column envs. Selects the row where **today’s date** (`YYYY-MM-DD` in `APP_TIMEZONE`) falls between start and end **inclusive** (`::date` comparison). |

**If these are unset or misconfigured, accrual throws a clear error** — fix the resolver before production.

### Where to plug in the real leave-year table

1. Open **`src/services/leaveYearService.ts`**.
2. Either set **`env`** mode for a quick override, or set **`table`** mode with your real `LEAVE_YEAR_*` env vars.
3. If your table lives outside `public` or uses different comparison rules, adjust the SQL in **`getCurrentLeaveYearId`** only — the rest of the batch uses the returned string id.

## Assumptions (confirm before production)

- **`public.employee_leave_balances`**: columns include `"userId"`, `"leaveYearId"`, `type`, `entitled`, `remaining` (camelCase quoted identifiers as in your ORM).
- **`public.leave_adjustments`**: columns `id`, `"leaveYearId"`, `"userId"`, `type`, `delta`, `reason`, `"createdById"`, `"createdAt"` (adjust names in repositories/services if your DB differs).
- **`public.employee_profiles`**: `id` (user id), `employee_status`, `birth_date`, `date_of_joining`, `preferred_name`, `first_name`, `last_name`, `email`.
- **`birth_date`**: `timestamp without time zone` — month/day compared via SQL `::date` / `to_char(..., 'MM-DD')` aligned with `APP_TIMEZONE` “today”.
- **`date_of_joining`**: `date`. Anniversaries require **≥ 1** completed year (hire day itself is skipped).
- One **PAID** balance row per employee per leave year.

## Postgres TLS (Lambda / RDS)

**“no pg_hba.conf entry … no encryption”** from Lambda means the DB **requires SSL** but the client connected **without** TLS. The pool now **enables TLS automatically** for any host that is not `localhost` / `127.0.0.1` (typical **Lambda → RDS**).

- **`DATABASE_SSL_REJECT_UNAUTHORIZED=false`** — only if the server cert is not verifiable (self-signed / private CA). RDS public endpoints usually work with the default **`true`**.
- **`DATABASE_USE_SSL=false`** — force plaintext (e.g. local Postgres without SSL). **Do not use** for RDS from Lambda.

## Local TLS (Postgres “self-signed certificate in certificate chain”)

If `npm run local:run` logs `self-signed certificate in certificate chain`, add to `.env`:

```env
DATABASE_SSL_REJECT_UNAUTHORIZED=false
```

Use only for **local/dev** when needed. For local Postgres on `localhost` without SSL, you can set `DATABASE_USE_SSL=false` (inference already skips TLS for localhost).

## Local setup

```bash
npm install
cp .env.example .env
# edit .env — DATABASE_URL, SYSTEM_USER_ID, SES_*, LEAVE_YEAR_*, etc.

npm run build
npm test
npm run local:run
```

`local:run` loads `.env` via `dotenv` and prints the structured batch result JSON.

## Deploy (Serverless)

Your AWS identity must be allowed to create/update the stack (not the same as “SES send only”). Typical **minimum areas** for `serverless deploy`:

- **CloudFormation** — create/update/describe stacks (e.g. `cloudformation:*` on `arn:aws:cloudformation:REGION:ACCOUNT:stack/batch-hr-portal-*/*`)
- **S3** — deployment artifact bucket (Serverless creates/uses one for Lambdas in the region)
- **Lambda** — create/update functions, versions, permissions
- **IAM** — create/update **roles** for the Lambda execution role (often `iam:PassRole` + `iam:CreateRole` / `PutRolePolicy` for the generated role)
- **Events** — EventBridge/CloudWatch Events rule for the schedule (`events:PutRule`, `PutTargets`, …)
- **Logs** — CloudWatch log groups for the function

If you see `not authorized to perform: cloudformation:DescribeStacks`, attach a deploy-capable policy to the IAM user/role (or use an admin profile for bootstrap only), then redeploy.

Project root **`useDotenv: true`** in `serverless.yml` loads **`.env`** during deploy so `DATABASE_URL`, `SYSTEM_USER_ID`, SES vars, etc. are applied to Lambda `environment` (ensure `.env` is never committed).

```bash
npm install
npx serverless deploy --stage dev
```

Example with deploy-time cron override:

```bash
SCHEDULE_CRON='cron(31 2 * * ? *)' DATABASE_URL='...' SYSTEM_USER_ID='...' npx serverless deploy --stage prod
```

Invoke manually:

```bash
npx serverless invoke -f dailyBatch --stage dev --log
```

## Testing celebrations logic

- Unit tests: `npm test` (`test/celebrations.test.ts`, `test/dates.test.ts`).
- **Manual:** set `APP_TIMEZONE`, seed `employee_profiles` with `birth_mmdd` / `join_mmdd` alignment by setting `birth_date` / `date_of_joining`, run `npm run local:run` on that calendar day (or temporarily adjust DB dates in a sandbox).

## Validating monthly accrual safely

1. Use a **non-prod** database.
2. Set `LEAVE_YEAR_LOOKUP_MODE=env` with a test `CURRENT_LEAVE_YEAR_ID`.
3. Run on the **1st** (or temporarily set server date / data) and confirm:
   - `leave_adjustments.reason` = `MONTHLY_PAID_ACCRUAL:YYYY-MM`
   - `entitled` / `remaining` increased by `LEAVE_ACCRUAL_AMOUNT` for active employees with a PAID row.
4. **Re-run** the same day: processed count should be **0** (idempotent).

## Handler response shape

Lambda returns JSON (HTTP-style wrapper for convenience):

```json
{
  "statusCode": 200,
  "body": "{\"date\":\"2026-03-01\",\"timezone\":\"Asia/Kolkata\",\"accrualAttempted\":true,\"accrualProcessedCount\":42,...}"
}
```

Parsed `body` includes: `date`, `timezone`, `accrualAttempted`, `accrualSkippedReason`, `accrualProcessedCount`, `birthdayCount`, `anniversaryCount`, `emailSent`, `celebrationEmailsSent` (one SES send per birthday + per anniversary), `warnings`.

## Customize

- **Column naming** (snake_case vs camelCase): edit `src/repositories/*` and `src/services/leaveAccrualService.ts` SQL.
- **Active status rules:** `src/utils/employeeStatus.ts` + env vars.
- **Templates:** `src/templates/*.ts`.
- **Structured logs:** `src/utils/logger.ts` (JSON lines to CloudWatch).

## License

Private / internal — adjust as needed.
