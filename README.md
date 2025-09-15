# Hospital Shift Scheduler

Hospital shift scheduling system with First-Come, First-Served (FCFS) distribution, real-time notifications, and staff management. The app runs cleanly in an offline/demo mode (no external services) and can be hosted behind IIS at `/scheduler`.

## Features

- FCFS shift distribution with 15-minute response windows
- Real-time updates (Socket.io via long-polling for IIS compatibility)
- Multi-channel notifications (email/SMS/push/in-app; mockable in demo mode)
- Security-first defaults: Helmet, CORS, rate limits, request logging, audit trail hooks
- Role-aware UI (admin/supervisor/staff) via env-configurable emails in demo/dev
- Mobile-responsive UI (Material UI)
- Fatigue and workload awareness (early version)

## Tech Stack

- Frontend: React 18, Material UI 5, Redux Toolkit
- Backend: Node.js (Express), Socket.io (polling transport in prod/IIS)
- Database: SQL Server (schema + procs provided; demo mode skips DB)
- Cache: Redis (skipped in demo mode)
- Authentication: Google ID token verification (server-side tokeninfo); Auth0 scaffolding present but not wired
- Deployment: IIS on Windows Server (reverse proxy to Node API at port 3001)

## Installation

### Prerequisites

- Node.js 18+
- SQL Server Express (optional in demo mode)
- Redis (optional in demo mode)
- IIS with URL Rewrite/ARR (for production behind `/scheduler`)

### Setup

1. Clone the repository:
```bash
git clone https://github.com/Skeptic1222/hospital-shift-scheduler.git
cd hospital-shift-scheduler
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Set up the database (skip in demo mode):
```bash
npm run db:migrate
npm run db:seed
```

5. Start the API
- Demo/offline mode (no external dependencies):
  - Windows PowerShell (in `C:\inetpub\wwwroot\scheduler`):
    - `$env:SKIP_EXTERNALS='true'`
    - `node server.js`
  - Or run the standalone demo server: `node server-demo.js`
- WSL dev (proxying to Windows IIS):
  - `DEMO_MODE=true SKIP_EXTERNALS=true ./scripts/start-api-wsl.sh`

Then browse to `http://localhost/scheduler` when behind IIS, or `http://localhost:3001` when serving the built UI from the Node server.

## Development

### Available Scripts

- `npm start` — Start API in production mode (serves `build/` if present)
- `npm run dev` — Start API with hot reload
- `npm test` — Run Jest with coverage (see jest.setup for defaults)
- `npm run build` — Build React UI to `build/`
- `npm run lint` — Lint with ESLint

### Demo Mode

Run with demo data (no external services required):
```bash
export DEMO_MODE=true
export SKIP_EXTERNALS=true
node server.js    # or: node server-demo.js
```

### Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@demo.hospital.com | Admin123! |
| Supervisor | supervisor@demo.hospital.com | Super123! |
| Nurse | nurse1@demo.hospital.com | Nurse123! |

## Deployment

### IIS Deployment

Deploy using PowerShell (requires Administrator):
```powershell
.\deploy.ps1 -Environment production -SqlServer ".\SQLEXPRESS" -IISAppName "HospitalScheduler" -Port 3001
```

Docker Compose is not currently included; use IIS + Node per the included scripts and `web.config`.

## Configuration

### Environment Variables

Key variables (see `.env.example` for the full list):

- `GOOGLE_CLIENT_ID` / `REACT_APP_GOOGLE_CLIENT_ID` — Google ID token audience (used in dev/prod respectively)
- `DB_SERVER`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` — SQL Server (skip in demo mode)
- `REDIS_HOST`, `REDIS_PORT` — Redis (skip in demo mode)
- `ALLOWED_ORIGINS` — Allowed CORS origins
- `REACT_APP_PUBLIC_BASE` — Public base URL for client (e.g., `http://localhost/scheduler`)
- `ADMIN_EMAILS`, `SUPERVISOR_EMAILS`, `REACT_APP_ADMIN_EMAILS`, `REACT_APP_SUPERVISOR_EMAILS` — role elevation in demo/dev

### FCFS Algorithm (overview)

The FCFS queue uses time windows and eligibility weighting:
- Seniority: 30%
- Last Shift Worked: 20%
- Skill Match: 25%
- Availability: 25%

## API Documentation

See `API_DOCUMENTATION.md`. Many endpoints provide demo responses when `SKIP_EXTERNALS=true`.

## Reverse Proxy (IIS/ARR)
- The UI is hosted under `/scheduler`. CRA `homepage` is set accordingly so asset paths resolve.
- IIS `web.config` proxies `/scheduler/api/*` and `/scheduler/socket.io/*` → `http://localhost:3001`.
- PWA icon requests can be served from `/api/assets/icon` when placeholders are needed.
- Browser URLs stay portless; IIS proxies to port 3001.

## PWA Icons
- Add branded icons to `public/`:
  - `android-chrome-192x192.png`
  - `android-chrome-512x512.png`
- Rebuild with `npm run build` to serve these from `/scheduler/…`. The server will otherwise provide placeholder icons via `/api/assets/icon`.

## Security

- Helmet, CORS, rate limiting, request IDs + structured logging
- Redis cache encryption for sensitive values (AES-256-GCM)
- Audit logging endpoints/hooks
- TLS is terminated at IIS/ARR (configure 1.2+ in IIS)
- AuthN: Google ID tokens (tokeninfo) in current build; Auth0 scaffolding included for future MFA/BAA requirements

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

No license file is included. Treat as private/internal unless a license is added.

## Support

File issues in your internal tracker or raise them with the project maintainers.

## Acknowledgments

- React + Material UI
- Real-time updates via Socket.io
