<#
Start the Node API on port 3001 with minimal env for UI integration
Run from the project root (C:\inetpub\wwwroot\scheduler)
#>

param(
  [int]$Port = 3001,
  [string]$NodeEnv = 'production',
  [switch]$SkipExternals = $true,
  [string]$AllowedOrigins = 'https://localhost,https://ay-i-t.com,http://localhost',
  [string]$AdminEmails = '',
  [string]$SupervisorEmails = ''
)

$env:PORT = $Port
$env:NODE_ENV = $NodeEnv
if ($SkipExternals) { $env:SKIP_EXTERNALS = 'true' } else { Remove-Item Env:SKIP_EXTERNALS -ErrorAction SilentlyContinue }
$env:ALLOWED_ORIGINS = $AllowedOrigins
if (-not $AdminEmails -or $AdminEmails.Trim().Length -eq 0) { $AdminEmails = 'sop1973@gmail.com' }
$env:ADMIN_EMAILS = $AdminEmails
if ($SupervisorEmails) { $env:SUPERVISOR_EMAILS = $SupervisorEmails }

# Optional: configure DB/Redis here or via a .env file
# $env:DB_SERVER = 'localhost\SQLEXPRESS'
# $env:USE_WINDOWS_AUTH = 'true'

Write-Host "Starting API on port $Port (NODE_ENV=$NodeEnv, SKIP_EXTERNALS=$SkipExternals)" -ForegroundColor Cyan
node server.js
