# Hospital Shift Scheduler

Hospital shift scheduling system with First-Come, First-Served (FCFS) distribution, real-time notifications, and staff management. The app is hosted behind IIS at `/scheduler` (no ports in URLs).

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
- Database: SQL Server (schema + procs provided)
- Cache: Redis
- Authentication: Google ID token verification (server-side tokeninfo); Auth0 scaffolding present but not wired
- Deployment: IIS on Windows Server (reverse proxy to the internal Node API service)

## Installation

### Prerequisites

- Node.js 18+
- SQL Server Express
- Redis
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

4. Set up the database:
```bash
npm run db:migrate
npm run db:seed
```

5. Start the API
- Windows PowerShell (in `C:\inetpub\wwwroot\scheduler`):
  - `node server.js`
- WSL dev (proxying to Windows IIS): use your standard start script.

Then browse to `http://localhost/scheduler` behind IIS (no ports).

## Development

### Available Scripts

- `npm start` — Start API in production mode (serves `build/` if present)
- `npm run dev` — Start API with hot reload
- `npm test` — Run Jest with coverage (see jest.setup for defaults)
- `npm run build` — Build React UI to `build/`
- `npm run lint` — Lint with ESLint
 - `npm run db:check` — Quick DB connectivity check

### No Demo Mode
This repository does not support a demo/offline mode. Do not introduce any demo toggles or bypasses in code or configuration.

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
- `DB_SERVER`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` — SQL Server
- `REDIS_HOST`, `REDIS_PORT` — Redis
- `ALLOWED_ORIGINS` — Allowed CORS origins
- `REACT_APP_PUBLIC_BASE` — Public base URL for client (e.g., `http://localhost/scheduler`)
- `ADMIN_EMAILS`, `SUPERVISOR_EMAILS`, `REACT_APP_ADMIN_EMAILS`, `REACT_APP_SUPERVISOR_EMAILS` — optional role elevation via env

### FCFS Algorithm (overview)

The FCFS queue uses time windows and eligibility weighting:
- Seniority: 30%
- Last Shift Worked: 20%
- Skill Match: 25%
- Availability: 25%

## API Documentation

See `API_DOCUMENTATION.md` for endpoint details.
Additional health: `/api/db/health` returns database connectivity status.

## Reverse Proxy (IIS/ARR)
- The UI is hosted under `/scheduler`. CRA `homepage` is set accordingly so asset paths resolve.
- IIS `web.config` proxies `/scheduler/api/*` (including `/scheduler/api/socket.io`) to your Node backend.
- PWA icon requests can be served from `/api/assets/icon` when placeholders are needed.
- Browser URLs stay portless; IIS proxies to the internal service.

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

## Logging & Monitoring

The application includes comprehensive logging for debugging and compliance:

### Log Files Location
All logs are stored in the `logs/` directory within the project folder:

| Log Type | Filename | Purpose | Retention |
|----------|----------|---------|-----------|
| **Application** | `logs/app-YYYY-MM-DD.log` | General activity and info | 30 days |
| **Errors** | `logs/error-YYYY-MM-DD.log` | Errors and stack traces | 90 days |
| **Audit** | `logs/audit-YYYY-MM-DD.log` | HIPAA compliance trail | 7 years |
| **Performance** | `logs/performance-YYYY-MM-DD.log` | Response times & metrics | 7 days |
| **Access** | `logs/access-YYYY-MM-DD.log` | HTTP request logs | 30 days |

### Checking Logs for Errors
```bash
# View today's errors
tail -f logs/error-$(date +%Y-%m-%d).log

# Search for specific errors
grep "ERROR" logs/error-*.log | tail -50

# Monitor real-time activity
tail -f logs/app-$(date +%Y-%m-%d).log
```

### Windows PowerShell
```powershell
# View recent errors
Get-Content "logs\error-$(Get-Date -Format yyyy-MM-dd).log" -Tail 50

# Monitor in real-time
Get-Content "logs\app-$(Get-Date -Format yyyy-MM-dd).log" -Wait
```

See [LOG_MONITORING.md](./LOG_MONITORING.md) for detailed troubleshooting instructions.

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
