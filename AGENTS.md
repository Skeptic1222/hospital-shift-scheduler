# Repository Guidelines

## Project Structure & Module Organization
- `server.js`: Express API, security middleware, and static serving (production).
- `src/`: React app — `pages/`, `components/`, `hooks/`, `utils/`, `theme/`, `store/`.
- `public/`: HTML template and static assets; `build/`: production bundle.
- Core services in root: `fcfs-algorithm.js`, `realtime-notifications.js`, `redis-cache.js`, `db-config.js`.
- Config: `.env` (copy from `.env.example`); deployment: `web.config`, `deploy.ps1`.

## Build, Test, and Development Commands
- `npm run dev` — Start API with hot reload (nodemon). Example: `DEMO_MODE=true SKIP_EXTERNALS=true npm run dev`.
- `npm start` — Start API in production mode (serves `build/` if present).
- `npm run build` — Build React UI to `build/` (via `react-scripts`).
- `npm test` — Run Jest with coverage. Run one file: `npm test -- src/pages/Notifications.test.jsx`.
- `npm run lint` — Lint with ESLint.
- `npm run db:migrate` / `npm run db:seed` — Database tasks (when migrations/seeds are present).

Node 18+ is required. Create `.env` from `.env.example` before running.

## Coding Style & Naming Conventions
- Use the repo ESLint config: single quotes, semicolons, trailing comma only on multiline, warn on unused vars (prefix `_` to ignore).
- React components/pages: `PascalCase.jsx` with default export. Hooks: `use*.js`.
- Keep modules focused; colocate small helpers near usage under `src/utils`.

## Testing Guidelines
- Frameworks: Jest, `@testing-library/react` (UI), `supertest` (API).
- Place tests next to code (`*.test.js|jsx`) or under `__tests__/`.
- Prefer behavioral tests: user interactions for UI; request/response for API.
- Aim for meaningful coverage on changed code; include edge cases and error paths.

## Commit & Pull Request Guidelines
- Use imperative, descriptive commits (Conventional Commits encouraged: `feat:`, `fix:`, `chore:`).
- Branch names: `feature/...`, `fix/...`, or `chore/...`.
- PRs must include: clear description, linked issues, test plan (commands/cURLs), screenshots for UI changes, and updated docs when applicable.
- CI checks must pass (`lint`, `test`). No secrets in diffs; update `.env.example` when adding env vars.

## Security & Configuration Tips
- Never commit real credentials; rely on `.env` and `ALLOWED_ORIGINS`.
- For local/offline work set `SKIP_EXTERNALS=true` and optionally `DEMO_MODE=true`.
- If adding endpoints, update input validation and rate limits; document routes in `API_DOCUMENTATION.md`.

