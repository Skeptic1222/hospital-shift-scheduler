IIS Reverse Proxy + Node API

What this enables
- Serve the SPA from /scheduler (IIS static) and proxy /api/* and /socket.io/* to your Node backend.

Install prerequisites (run as Administrator)
1) URL Rewrite (required for SPA fallback + proxy):
   https://aka.ms/iis-urlrewrite
2) Application Request Routing (ARR) + Proxy:
   https://www.iis.net/downloads/microsoft/application-request-routing

Apply proxy config
- Replace your current web.config with web.config.reverse-proxy.sample once modules are installed.
  a) Backup: copy web.config web.config.bak
  b) Copy:   copy web.config.reverse-proxy.sample web.config
  c) Recycle the app pool for /scheduler

Start the API (dev mode, skips DB/Redis for now)
- PowerShell in C:\inetpub\wwwroot\scheduler:
  scripts\start-api.ps1 -Port 3001 -SkipExternals
- Health check (proxied via IIS):
  https://localhost/scheduler/api/health

Production wiring
- Set your .env or environment variables for DB, Redis, Auth0, email, Twilio as needed.
- Remove -SkipExternals when ready to connect to real services.
- Ensure CORS env ALLOWED_ORIGINS includes your site origins (e.g., https://localhost, https://ay-i-t.com)
