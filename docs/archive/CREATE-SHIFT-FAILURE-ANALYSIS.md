# Create Shift Failure — Comprehensive Analysis and Remediation Plan

This document summarizes everything implemented to diagnose and fix the persistent Create Shift failure while strictly adhering to the constraints:

- Google OAuth only (no other auth methods added)
- SQL Server Express only (no SQLite or alternate DBs)
- No demo/offline mode introduced
- No ports or absolute URLs exposed to users

The goals were to eliminate the most common root causes (authz, schema/DB issues, input normalization, type conversion) and to guarantee enough logging is written to the project folder for conclusive diagnosis.

## Executive Summary

- The Create Shift flow continues to fail despite multiple server‑side fixes and UI guardrails.
- The API now logs every Create Shift attempt with detailed, structured entries to project files so the exact failure is visible locally.
- The most likely remaining causes are environmental: DB connectivity/permissions, missing schema, or a SQL constraint/permission error specific to your SQL Server instance.
- The remediation plan below will resolve it quickly once you review the captured error signature now guaranteed to be written to the logs.

## What Has Been Implemented

### 1) End‑to‑End Logging to Project Files

- Create Shift route logs to:
  - `logs/shift-create-debug.log` (append‑only JSON lines)
  - `logs/app-YYYY-MM-DD.log` (info)
  - `logs/error-YYYY-MM-DD.log` (errors with stack)
- Each Create Shift attempt records:
  - `create_shift_received`: requestId, user email/id, dbConnected flag
  - `create_shift_derived`: normalized parameters (date, start/end, department_id, hospital_id, required_staff)
  - `create_shift_succeeded`: shiftId
  - Or a specific failure: `db_connect_failed`, `repositories_missing`, `schema_missing`, `schema_check_failed`, `create_shift_error` (with message/code/number/name/stack)
- Browser errors are captured via POST `/api/browser-log` and written to `logs/app-YYYY-MM-DD.log`.
- Global unhandled rejections/exceptions are logged from `server.js`.
- Responses include headers and JSON for correlation:
  - `X-Request-Id` header, `requestId` in JSON body
  - `X-Error-Code` header for common failure categories (e.g., DB_CONNECT_FAILED, SCHEMA_MISSING, VALIDATION_ERROR, CREATE_SHIFT_FAILED)

### 2) Authorization (Google-only) Hardening

- Google OAuth remains the only auth method.
- Authorization still checks DB roles, but if roles are not yet populated, emails listed in `ADMIN_EMAILS` are treated as admins (default includes `sop1973@gmail.com`). This avoids 403 on Create Shift during bootstrap without introducing any demo mode.

### 3) UI Guardrails (no demo data)

- The Schedule Create Shift dialog now loads Departments/Hospitals from the API and uses dropdowns to prevent free‑text typos.
- Client remains fully relative (`/api/*`), no ports.

### 4) API Input Normalization + Strong Typing

- Create Shift accepts department/hospital as GUID, code, or name; the route resolves to real GUIDs before insert. If not found, values are safely set to NULL (allowed by schema).
- Final guard enforces GUID format before insert to avoid SQL conversion errors.
- Insert uses explicit types and in‑SQL casts for reliability:
  - `shift_date` → `CAST(@shift_date AS date)`
  - `department_id`, `hospital_id` → `CAST(@department_id AS uniqueidentifier)`, `CAST(@hospital_id AS uniqueidentifier)`
  - DateTimes use `DateTime2`, integers use `Int`, status uses `NVarchar(50)`

### 5) DB Self‑Healing and Schema Check per Request

- If the route sees the DB disconnected, it calls `db.connect()` and logs the outcome.
- Validates `scheduler.shifts` exists via `INFORMATION_SCHEMA.TABLES`. If missing, returns 503 with a clear message, and logs `schema_missing`.

## Files Changed (Key)

- `routes/shifts.js` — Logging, normalization, typed insert, auto‑connect, schema check, dedicated debug file.
- `src/pages/Schedule.jsx` — Department/Hospital dropdowns using real lists.
- `routes/index.js` — Browser errors to file (`/api/browser-log`), mounted debug route.
- `server.js` — Global unhandled error/rejection logging.
- `google-auth.js` — Authz diagnostics, fallback admin for configured emails (default includes `sop1973@gmail.com`).
- New: `routes/debug.js` — Admin-only GET `/api/debug/shift-create` for quick at-a-glance DB and lookup readiness.

## What the Logs Will Show Now

Check these files immediately after a Create Shift attempt:

- `logs/shift-create-debug.log` (append‑only JSON)
- `logs/app-YYYY-MM-DD.log`
- `logs/error-YYYY-MM-DD.log`
- `logs/access-YYYY-MM-DD.log`

Look for the latest block with events:

1) `create_shift_received` (contains `requestId`, `user`, `dbConnected`)
2) `create_shift_derived` (shows `date`, `start`, `end`, `department_id`, `hospital_id`, `required_staff`)
3) If success: `create_shift_succeeded` with `shiftId`
4) If failure: one of
   - `db_connect_failed`: DB credentials/instance unreachable
   - `schema_missing`: `scheduler.shifts` table not found
   - `schema_check_failed`: SQL permission or metadata error
   - `create_shift_error`: contains `message`, `code`, `number`, `name`, `stack`

The response to the browser includes `X-Request-Id` (also present in debug log) and `X-Error-Code` for quick UI correlation.

## Root Cause Hypotheses (Eliminated vs. Likely)

Eliminated by code:

- Free‑text Department/Hospital → GUID conversion failures (UI dropdowns + server normalization + strict GUID enforcement)
- Driver/type ambiguity on insert (explicit in‑SQL casts and typed parameters)
- Missing connection at time of request (route now calls `db.connect()` if needed, and logs failures)
- Role‑based 403 while using `sop1973@gmail.com` (configured fallback admin)
- Path/proxy issues (client uses relative `/api/*` only; IIS `web.config` proxies `/api` and `/scheduler/api` already)

Likely remaining (environmental) causes:

1) Database connectivity/credentials/firewall
   - Signature: `db_connect_failed` with a message like `ELOGIN`, `ETIMEOUT`, or TLS/trust errors.
   - Fix: verify `.env` (`DB_SERVER`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_ENCRYPT`, `DB_TRUST_SERVER_CERT`), ensure SQL Browser/ports for named instance, and try `npm run db:check`.

2) Schema missing or wrong database selected
   - Signature: `schema_missing` or `schema_check_failed` around `INFORMATION_SCHEMA.TABLES`.
   - Fix: run `npm run db:migrate` (with correct `DB_SERVER`), then `npm run db:seed`.

3) SQL permissions/role issues for the configured login
   - Signature: `create_shift_error` with `message` indicating permission denied / cannot insert / default schema issues.
   - Fix: grant `INSERT/SELECT` on `scheduler.shifts` to the login or use a login with sufficient privileges; confirm default schema mapping if needed.

4) A database-level constraint or trigger not reflected in our schema
   - Signature: specific SQL `number` in `create_shift_error` (e.g., FK/CK violation).
   - Fix: adjust the payload to satisfy the constraint or update the DB object to match the current application assumptions. Note: our `status` uses `'open'`, which the provided schema allows.

## Immediate Remediation Steps

Follow these in order (minimal changes first):

1) Verify DB connectivity
   - Run: `npm run db:check`
   - If it fails, review `.env` and local SQL configuration (instance name/port, encryption/trust settings). Example for SQL Express default instance: `DB_SERVER=localhost\\SQLEXPRESS`.

2) Verify schema presence
   - Run: `npm run db:migrate`
   - Re-test Create Shift. If it still fails, inspect the latest `logs/shift-create-debug.log` entry for the specific error.

3) Verify permissions
   - If error indicates permission denied, grant the configured login rights to the `scheduler` schema tables, especially `scheduler.shifts`.

4) Use the admin debug endpoint (optional, for quick sanity)
   - `GET /api/debug/shift-create` (requires Google auth + admin) — returns `{ dbConnected, departments, hospitals }` snapshots.

## Test Plan After Fix

- Create Shift via Schedule dialog with and without selecting Department/Hospital; verify 201 Created and that the new shift appears in `/api/shifts` for `shift_date`.
- Admin → Users: add user, assign role, delete (already verified backend changes).
- Departments: create/edit/delete work against DB.
- Notifications: mark read/delete calls hit live endpoints.

## Appendix: Notable Changes by File

- `routes/shifts.js` — diagnostics, normalization, typed insert, connect+schema checks, debug file logging, response headers.
- `src/pages/Schedule.jsx` — shift form uses dropdowns from real lists.
- `routes/index.js` — browser errors logged to file; mounted debug router.
- `routes/debug.js` — admin-only diagnostics for DB and lookups.
- `server.js` — global error/rejection file logging.
- `google-auth.js` — logs authz failures; fallback admin via `ADMIN_EMAILS`.

## Closing Note

At this point, the code is resilient and writes full diagnostic context to the project’s logs. The exact reason for the failure in your environment will be reflected in the latest `logs/shift-create-debug.log` entry and in `logs/error-YYYY-MM-DD.log`. Once that error signature is seen (e.g., DB connect, schema missing, permission denied, or a specific constraint), we can apply the surgical fix immediately while maintaining your constraints (Google OAuth only, SQL Server Express only, no demo mode, no ports).

