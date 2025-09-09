<#
Starts the Node API on Windows with Windows Authentication against SQL Server.
Run from the repository root (C:\inetpub\wwwroot\scheduler).
#>

param(
  [int]$Port = 3001,
  [string]$DbServer = 'localhost\SQLEXPRESS',
  [string]$NodeEnv = 'development'
)

$env:PORT = "$Port"
$env:NODE_ENV = $NodeEnv

# Use Windows auth via msnodesqlv8 in db-config.js
$env:USE_WINDOWS_AUTH = 'true'
$env:DB_SERVER = $DbServer
$env:DB_ENCRYPT = 'true'
$env:DB_TRUST_SERVER_CERT = 'true'

Write-Host "Starting Node API with Windows Auth on port $Port..."
node server.js

