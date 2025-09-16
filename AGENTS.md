# Repository Guidelines

## Project Structure & Module Organization
- API: `server.js` (Express). Route handlers in `routes/`, middleware in `middleware/`, services in `services/`, shared helpers in `utils/`.
- Frontend: React app in `src/` (pages, components, hooks, store). Static assets in `public/`; production build outputs to `build/`.
- Data: SQL Server schema in `database-schema-sqlserver.sql`; migration runner `migrations/run.js`.
- Tests: Unit/integration in `src/__tests__/`; Playwright E2E in `tests/` and `tests/e2e/`.
- Hosting: App is served under `/scheduler` (see `package.json:homepage`).

## Build, Test, and Development Commands
- `npm run dev` — Start API with nodemon (hot reload).
- `npm start` — Start API; serves `build/` if present.
- `npm run build` — Build React UI to `build/`.
- `npm test` — Run Jest with coverage; outputs to `coverage/`.
- `npx playwright test` — Run E2E tests in `tests/`.
- `npm run lint` — Lint with ESLint.
- `npm run db:migrate` — Apply SQL schema (example: `DB_SERVER=.\\SQLEXPRESS npm run db:migrate`).
- `npm run db:check` — Verify DB connectivity.
- `npm run db:seed` — Seed baseline data (departments) if schema exists.

See `DOCS-INDEX.md` for a map of all project docs.

Note: Demo/offline modes are not supported. Do not add any demo toggles or ported URLs. SQL Server Express is the only supported database.

## Coding Style & Naming Conventions
- Language: JavaScript/React (Node 18+). Prefer 2‑space indentation and consistent formatting.
- ESLint: single quotes, required semicolons, warn on unused vars (prefix `_` to ignore), React/Hooks rules on.
- Files: Components/Pages in PascalCase (e.g., `src/pages/Admin.jsx`), hooks `useThing`, utilities camelCase.
- Tests: Name `*.test.js(x)` and co‑locate unit tests under `src/__tests__/`.

## Testing Guidelines
- Unit/integration: `npm test`. Keep tests deterministic; mock externals when possible. Coverage is generated in `coverage/`.
- E2E (Playwright): `BASE_URL=http://localhost/scheduler npx playwright test`.
- Avoid hard‑coded ports; respect base path `/scheduler` in URLs.

## Commit & Pull Request Guidelines
- Use Conventional Commits: `feat(scope): …`, `fix(scope): …`, `chore: …` (see `git log`).
- PRs must include: clear description, linked issues (`Closes #123`), screenshots/CLI output for UI/ops changes, and test plan/results.
- Ensure `npm test` and Playwright E2E pass locally. Do not commit secrets; update `.env.example` when adding config.

## Security & Configuration Tips
- Development: run normally with `node server.js`.
- Production: hosted behind IIS at `/scheduler`; avoid absolute hostnames/port numbers in client or server responses.
- Keep Helmet/CORS/rate‑limit defaults unless explicitly required; review changes in `middleware/` during PRs.
