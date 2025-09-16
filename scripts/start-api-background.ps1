param(
  [int]$Port = 3001,
  [string]$NodeEnv = 'production'
)

$ErrorActionPreference = 'Stop'

Write-Host "Starting API in background (NodeEnv=$NodeEnv, Port=$Port)" -ForegroundColor Cyan
$env:NODE_ENV = $NodeEnv
$env:PORT = "$Port"

$wd = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Resolve-Path (Join-Path $wd '..')

Push-Location $root
try {
  Start-Process -WindowStyle Hidden -FilePath 'node' -ArgumentList 'server.js' -WorkingDirectory $root
  Start-Sleep -Seconds 2
  Write-Host "API background process started." -ForegroundColor Green
} finally {
  Pop-Location
}
