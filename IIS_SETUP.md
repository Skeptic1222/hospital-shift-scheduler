IIS Setup for http://localhost/scheduler

Overview
- Two deployment modes are supported:
  1) Basic (no IIS URL Rewrite): simplest to run, hash-based routes (no deep-link refresh). API is called directly at http://localhost:3001.
  2) Enhanced (URL Rewrite + ARR optional): pretty URLs (deep-link refresh works) and optional reverse-proxy for /api and /socket.io to Node.

Prerequisites
- Windows with IIS enabled (client or server)
- Administrator privileges (to install modules)
- Node.js LTS installed if you plan to run the API locally (scripts\start-api.ps1)

Basic Mode (no URL Rewrite)
1) Build the SPA: `npm run build`
2) Ensure `web.config` (in this repo) is the minimal version (no <rewrite> sections). This serves `build/index.html` as the default document.
3) Browse to http://localhost/scheduler
   - App uses hash-based routing (/#/dashboard, etc.), so refresh and deep links work without URL Rewrite.
   - API calls go directly to http://localhost:3001 (set by a small script in public/index.html).
4) Start the API (optional): `scripts\start-api.ps1 -Port 3001 -SkipExternals`

Enhanced Mode (URL Rewrite + optional ARR)
1) Install IIS URL Rewrite (required for SPA fallback) and optionally Application Request Routing (for proxy):
   - URL Rewrite: https://aka.ms/iis-urlrewrite
   - ARR: https://www.iis.net/downloads/microsoft/application-request-routing
   Or run the helper script as Administrator: `PowerShell -ExecutionPolicy Bypass -File scripts\setup-iis-scheduler.ps1`
2) Replace `web.config` with `web.config.reverse-proxy.sample` if you want IIS to proxy `/api/*` and `/socket.io/*` to Node (requires ARR).
   - Backup: `copy web.config web.config.bak`
   - Copy:   `copy web.config.reverse-proxy.sample web.config`
   - Recycle the app pool
3) Switch the frontend router to BrowserRouter for pretty URLs (optional; already configured for HashRouter by default).
4) Verify:
   - http://localhost/scheduler routes work with refresh
   - http://localhost/scheduler/api/health (proxied) works when the API is running

Troubleshooting
- 404 on deep-link refresh (e.g., /scheduler/dashboard): Install URL Rewrite and use the SPA fallback config (or use HashRouter).
- 500.19 with <rewrite> sections: URL Rewrite module not installed. Use Basic Mode or install URL Rewrite.
- JS 404s (white screen): Ensure `package.json` has `"homepage": "/scheduler/build"` and rebuild so script tags point to `/scheduler/build/static/...`.
- Caching: If you deployed a new build but still see old chunk names, recycle the app pool or run `iisreset`. `web.config` sends no-cache headers for HTML.
