<#
.SYNOPSIS
Registers a Windows Task Scheduler job to auto-start the Node API on login.

.DESCRIPTION
Creates a scheduled task named 'Shiftwise-API-Autostart' that launches:
  node server.js
in the repo directory, with environment variables set for demo/offline mode.

.PARAMETER RepoPath
Path to the repository root (default: C:\inetpub\wwwroot\scheduler)

.PARAMETER NodePath
Path to node.exe (default: from PATH)

.EXAMPLE
PS> .\scripts\register-api-autostart.ps1 -RepoPath 'C:\inetpub\wwwroot\scheduler'

#>
param(
  [string]$RepoPath = 'C:\inetpub\wwwroot\scheduler',
  [string]$NodePath = 'node.exe',
  [switch]$DemoMode
)

if (-not (Test-Path $RepoPath)) { throw "RepoPath not found: $RepoPath" }

$taskName = 'Shiftwise-API-Autostart'
$action = New-ScheduledTaskAction -Execute $NodePath -Argument 'server.js' -WorkingDirectory $RepoPath

# Start at logon for any user
$trigger = New-ScheduledTaskTrigger -AtLogOn

$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

# Register with environment variables through the registry (Task Scheduler doesn't support inline env reliably)
# We set variables at the user level for this process to inherit.
if ($DemoMode) {
  [Environment]::SetEnvironmentVariable('SKIP_EXTERNALS', 'true', 'User')
}
[Environment]::SetEnvironmentVariable('PORT', '3001', 'User')
[Environment]::SetEnvironmentVariable('NODE_ENV', 'Production', 'User')
[Environment]::SetEnvironmentVariable('TRUST_PROXY', '1', 'User')

try {
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue | Out-Null
} catch {}

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings | Out-Null
Write-Host "Registered scheduled task '$taskName'. It will start the API on login." -ForegroundColor Green
