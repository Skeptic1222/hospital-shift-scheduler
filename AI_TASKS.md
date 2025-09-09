Scheduler: Setup Summary and AI TODOs

Overview
- App Type: Node.js + Express API with React build, proxied by IIS/ARR.
- IIS Path: http://localhost/scheduler (optional host header: scheduler.local).
- Backend Port: 3001 (proxied by URL Rewrite to /api and /socket.io).

What Was Done
- Verified site reachable at localhost and LAN IP.
- Confirmed URL Rewrite + ARR reverse proxy to backend on :3001.
- Enabled WebSockets at site level to improve Socket.io performance.
- Added X-Forwarded-* serverVariables for proxied requests.
- Updated Express app to trust proxy headers behind IIS/ARR.
- Added reusable provisioning/dev scripts (see scripts/ and C:\scripts):
  - scripts/provision-iis-multiapp.ps1: create IIS app/pool, host header, WebSockets.
  - scripts/start-api-windows.ps1: start API with Windows Auth (SQL Server on Windows).
  - scripts/start-api-wsl.sh: start API from WSL (expects SQL auth).
  - scripts/wsl-helpers.sh: get Windows host IP / add publicip.

How To Run
- Windows (preferred for Windows Auth to SQL):
  - powershell -ExecutionPolicy Bypass -File C:\scripts\start-api-windows.ps1 -Port 3001 -DbServer "localhost\\SQLEXPRESS"
- WSL (use SQL auth):
  - DB_USER=youruser DB_PASSWORD=yourpass C:\inetpub\wwwroot\scheduler\scripts\start-api-wsl.sh
- From WSL, access via http://<win_ip>/scheduler or http://publicip/scheduler (see wsl-helpers.sh).

AI TODOs
- IIS/WebSockets: Ensure IIS WebSocket Protocol feature is installed.
  - dism /Online /Enable-Feature /FeatureName:IIS-WebSockets /All
- Backend reachability: Confirm Node is listening when launched from WSL (bind to 0.0.0.0) or Windows (localhost is fine).
- Database: Decide per environment:
  - Windows run: USE_WINDOWS_AUTH=true with msnodesqlv8; DB_SERVER=localhost\\SQLEXPRESS.
  - WSL run: Use SQL auth; set DB_SERVER=<win_ip>, DB_USER/DB_PASSWORD.
- Health check: Verify /api/health returns healthy via http://localhost/scheduler/api/health with API running.
- Host header (optional): Provision binding `scheduler.local` using provision-iis-multiapp.ps1; add HTTPS with SNI if needed.
- Hardening (optional): Review web.config for caching/compression and add rate limits at IIS if required.

Troubleshooting
- 500 at /api/*: Start API on port 3001 or update proxy target in web.config.
- Socket.io falls back to polling: Ensure WebSocket Protocol feature is installed.
- WSL cannot reach SQL with Windows auth: switch to SQL auth or run API on Windows.

