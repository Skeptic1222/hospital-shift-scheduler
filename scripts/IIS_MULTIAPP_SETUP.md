Multi-App IIS Setup (Windows + WSL Friendly)

Goals
- Host multiple apps on the same IIS server cleanly.
- Keep dev tooling in WSL or Windows as preferred.
- Use ARR + URL Rewrite to proxy API/HMR when needed.

Recommended Patterns
- Per-app folder under `C:\inetpub\wwwroot\<app>` with its own `web.config`.
- Per-app IIS Application and dedicated App Pool (No Managed Code).
- Optional host headers per app (e.g., `scheduler.local`), or paths under a single site (`/scheduler`, `/crm`).
- Keep Node servers on localhost ports and proxy via IIS.

Quick Start: Provision an IIS App
1) Open an elevated PowerShell.
2) From repo root `C:\inetpub\wwwroot\scheduler`, run:

   powershell -ExecutionPolicy Bypass -File .\scripts\provision-iis-multiapp.ps1 -AppPath "/scheduler" -PhysicalPath "C:\inetpub\wwwroot\scheduler" -SiteName "Default Web Site" -HostHeader "scheduler.local" -EnableWebSockets -AddHostsEntry

   Notes:
   - `-HostHeader` is optional; omit to use `http://localhost/scheduler`.
   - `-EnableWebSockets` requires the WebSocket feature and is recommended for Socket.io.

Dev Server Options
- Windows (uses Windows Auth to SQL):
  powershell -ExecutionPolicy Bypass -File .\scripts\start-api-windows.ps1 -Port 3001 -DbServer "localhost\SQLEXPRESS"

- WSL (uses SQL auth):
  chmod +x ./scripts/start-api-wsl.sh && DB_USER=youruser DB_PASSWORD=yourpass ./scripts/start-api-wsl.sh

Access from WSL
- Use your Windows host IP: http://<win_ip>/scheduler. Quick discover:
  awk '/nameserver/ {print $2; exit}' /etc/resolv.conf
- Optional alias: add publicip in /etc/hosts pointing to that IP.

Best Practices for Many Apps
- Use host headers for clarity: app1.local, app2.local -> add bindings per app.
- Separate App Pools per app for isolation and recycling.
- Avoid serving from \\wsl$; keep IIS paths on NTFS and proxy to WSL dev ports.
- For Node stacks, bind to 0.0.0.0 and keep ports unique (e.g., 3001, 3002, ...).
- If using HTTPS, create per-app self-signed certs and bind with SNI.

Troubleshooting
- 500.19 and <webSocket>: enable IIS WebSocket Protocol feature.
- API not reachable: verify app is listening on the expected port and web.config rewrite rules match.
- SQL from WSL: prefer SQL auth; Windows auth from WSL is not supported.

