#Requires -RunAsAdministrator
<#
.SYNOPSIS
Provision or update an IIS application for a multi-app server.

.DESCRIPTION
Creates an IIS Application under a site, with a dedicated App Pool, and prepares
reverse proxy prerequisites for Node/WSL dev servers. Safe to re-run.

.PARAMETER SiteName
IIS site name to attach the application to (default: "Default Web Site").

.PARAMETER AppPath
Virtual path (e.g., "/scheduler").

.PARAMETER PhysicalPath
Filesystem path (e.g., "C:\\inetpub\\wwwroot\\scheduler").

.PARAMETER AppPoolName
Application pool name (default: derived from AppPath).

.PARAMETER HostHeader
Optional host header for the IIS site binding (e.g., "scheduler.local").

.PARAMETER Port
HTTP port to bind when HostHeader is provided (default: 80).

.PARAMETER EnableWebSockets
Enable IIS WebSocket Protocol feature via DISM (requires restart of W3SVC).

.PARAMETER AddHostsEntry
Add an entry in the Windows hosts file mapping HostHeader to 127.0.0.1.

.EXAMPLE
./provision-iis-multiapp.ps1 -AppPath "/scheduler" -PhysicalPath "C:\\inetpub\\wwwroot\\scheduler" -HostHeader "scheduler.local" -EnableWebSockets -AddHostsEntry
#>

[CmdletBinding(SupportsShouldProcess=$true)]
param(
  [string]$SiteName = 'Default Web Site',
  [Parameter(Mandatory=$true)][string]$AppPath,
  [Parameter(Mandatory=$true)][string]$PhysicalPath,
  [string]$AppPoolName,
  [string]$HostHeader,
  [int]$Port = 80,
  [switch]$EnableWebSockets,
  [switch]$AddHostsEntry
)

function Assert-Admin {
  $currentIdentity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($currentIdentity)
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'This script must be run as Administrator.'
  }
}

function Ensure-Feature {
  param([string]$Name)
  try {
    $state = (dism /Online /Get-FeatureInfo /FeatureName:$Name 2>$null | Select-String -SimpleMatch 'State :').ToString()
    if ($state -and ($state -match 'Enabled')) { return $true }
    Write-Host "Enabling feature $Name..."
    dism /Online /Enable-Feature /FeatureName:$Name /All | Out-Null
    return $true
  } catch {
    Write-Warning "Failed to query/enable feature $Name: $($_.Exception.Message)"
    return $false
  }
}

function Ensure-HostsEntry {
  param([string]$Hostname)
  if (-not $Hostname) { return }
  $hosts = "$env:WINDIR\System32\drivers\etc\hosts"
  $line = "127.0.0.1`t$Hostname"
  $content = Get-Content -LiteralPath $hosts -ErrorAction Stop
  if ($content -notcontains $line) {
    Add-Content -LiteralPath $hosts -Value $line
    Write-Host "Added hosts entry: $line"
  } else {
    Write-Host "Hosts entry already present: $line"
  }
}

function Ensure-PhysicalPath {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) {
    New-Item -ItemType Directory -Path $Path | Out-Null
  }
}

try {
  Assert-Admin
  Import-Module WebAdministration -ErrorAction Stop

  if (-not $AppPoolName) {
    $AppPoolName = ($AppPath.Trim('/').Replace('/', '-') + '-pool')
    if (-not $AppPoolName) { $AppPoolName = 'app-pool' }
  }

  Ensure-PhysicalPath -Path $PhysicalPath

  # Create or update App Pool (No Managed Code, Integrated pipeline)
  if (-not (Test-Path "IIS:\AppPools\$AppPoolName")) {
    New-Item "IIS:\AppPools\$AppPoolName" | Out-Null
  }
  Set-ItemProperty "IIS:\AppPools\$AppPoolName" -Name managedRuntimeVersion -Value ''
  Set-ItemProperty "IIS:\AppPools\$AppPoolName" -Name managedPipelineMode -Value 'Integrated'
  Set-ItemProperty "IIS:\AppPools\$AppPoolName" -Name autoStart -Value $true

  # Ensure site exists
  if (-not (Test-Path "IIS:\Sites\$SiteName")) {
    throw "Site '$SiteName' not found. Create it first or choose an existing site."
  }

  # Create or update application
  $app = Get-WebApplication -Site $SiteName -Name $AppPath.TrimStart('/') -ErrorAction SilentlyContinue
  if (-not $app) {
    New-WebApplication -Site $SiteName -Name $AppPath.TrimStart('/') -PhysicalPath $PhysicalPath -ApplicationPool $AppPoolName | Out-Null
  } else {
    Set-ItemProperty "IIS:\Sites\$SiteName$AppPath" -Name applicationPool -Value $AppPoolName
    Set-ItemProperty "IIS:\Sites\$SiteName$AppPath" -Name physicalPath -Value $PhysicalPath
  }

  # Optional: add site binding with host header
  if ($HostHeader) {
    $existing = Get-WebBinding -Name $SiteName -Protocol http -ErrorAction SilentlyContinue | Where-Object { $_.bindingInformation -match ":$Port:$HostHeader$" }
    if (-not $existing) {
      New-WebBinding -Name $SiteName -Protocol http -Port $Port -HostHeader $HostHeader | Out-Null
      Write-Host "Added binding: http/$HostHeader:$Port on site '$SiteName'"
    } else {
      Write-Host "Binding already exists for $HostHeader:$Port"
    }
  }

  # Optionally enable WebSocket Protocol
  if ($EnableWebSockets) {
    if (Ensure-Feature -Name 'IIS-WebSockets') {
      Write-Host 'IIS WebSocket Protocol ensured.'
    }
  }

  if ($AddHostsEntry -and $HostHeader) {
    Ensure-HostsEntry -Hostname $HostHeader
  }

  Write-Host "Done. Application '$AppPath' under site '$SiteName' -> $PhysicalPath using pool '$AppPoolName'."
} catch {
  Write-Error $_
  exit 1
}

