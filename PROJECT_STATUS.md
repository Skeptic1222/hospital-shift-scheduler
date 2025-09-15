# Project Status and Roadmap

Last updated: 2025-09-10

## Current State (Summary)
- Server: Express API runs in two modes
  - Live mode (DB/Redis/SMTP/SMS/push) — partial
  - Demo mode (`SKIP_EXTERNALS=true`) — full UI demo with realistic endpoints
- Auth: Google ID token verification in use; Auth0 scaffolding present but not wired to server
- Data: SQL Server repositories and schema scripts exist; many routes return demo data when external services are skipped
- Real-time: Socket.io configured (polling transport for IIS); channels stubbed; presence and metrics events included
- Caching: Redis layer with AES‑256‑GCM encryption for sensitive values; disabled in demo mode
- UI: MUI-based responsive UI with dashboard, schedule, staff, notifications, on-call, admin
- Tests: Jest + @testing-library + supertest; core API/UI smoke coverage present

## Gaps and Known Issues
- Auth: `/api/auth/login` not implemented; docs previously referenced Auth0; needs consolidation (Google vs Auth0)
- API docs: previously referenced `/api/docs` and Docker Compose; corrected
- License: README referenced MIT; no license file included
- Notifications: push subscription endpoint not implemented; SMS/email paths rely on env/integrations
- DB: migrations present; many live endpoints rely on demo stubs when `SKIP_EXTERNALS=true`
- Tests: coverage is low for business logic (FCFS, notifications, caching)

## Next Steps (Execution)
1. Authentication
   - Pick a primary IdP (Google or Auth0). If Auth0 (recommended for BAA/MFA), wire `auth-config.js` into `server.js` behind a feature flag
   - Implement `/api/auth/login` (OIDC code flow) or continue token-only if using federated sign-in
   - Normalize roles/permissions across server and client (env overrides ok in demo only)
2. Data & Integrations
   - Finish SQL Server schema, stored procs, and repository methods used by the FCFS queue
   - Gate demo data behind a separate adapter to reduce branching in handlers
3. Notifications
   - Implement push subscription storage (`POST /api/notifications/subscribe`) and wire push delivery
   - Add background processors for email/SMS/push retries and dead-letter queueing
4. Observability & Security
   - Centralize audit logging; redact PHI; ship logs to SIEM
   - Add request validation (`express-validator`) on write endpoints
   - Harden CORS/CSRF and CSP per environment
5. Testing & CI
   - Expand API tests around FCFS queue and scheduling edge cases
   - Add component tests for ShiftCalendar interactions and error states
   - Configure CI to run lint + tests (Node 18)

## Feature Opportunities
- Self-scheduling preferences (availability, fatigue constraints, certification match)
- Shift swap marketplace with supervisor approval and safety guardrails
- Predictive staffing (historical patterns, seasonality, bed census integrations)
- Compliance rulesets (labor laws, union rules, internal policies) with explainability
- On-call paging and escalation (SLA windows, auto-escalate, audit)
- Mobile offline mode for viewing schedules and acknowledging shifts

## Market Positioning (Niche)
- Fair, auditable FCFS with time-boxed windows and fatigue-aware eligibility
- “Instant coverage” workflows optimized for mobile + SMS (claim within 15 minutes)
- Healthcare-first compliance posture (audit, BAA-friendly integrations, no PHI over push/SMS)

