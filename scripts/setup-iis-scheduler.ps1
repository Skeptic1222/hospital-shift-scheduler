# Setup IIS Application at http://localhost/scheduler for this project
# Run as Administrator

param(
  [string]$AppName = 'scheduler',
  [string]$SiteName = 'Default Web Site',
  [string]$AppPool = 'SchedulerAppPool',
  [string]$PhysicalPath = (Resolve-Path '..' | Select-Object -ExpandProperty Path)
)

function Assert-Admin {
  if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error 'This script must be run as Administrator.'; exit 1
  }
}

function Ensure-IISClient {
  # Enable IIS features on client OS via DISM
  $features = @(
    'IIS-WebServerRole','IIS-WebServer','IIS-CommonHttpFeatures','IIS-StaticContent','IIS-DefaultDocument','IIS-HttpErrors',
    'IIS-ISAPIExtensions','IIS-ISAPIFilter','IIS-RequestFiltering','IIS-WebSockets','IIS-HttpLogging',
    'IIS-HttpCompressionStatic','IIS-HttpCompressionDynamic','IIS-ManagementConsole'
  )
  foreach ($f in $features) { dism /online /enable-feature /featurename:$f /all /norestart | Out-Null }
}

function Ensure-IISServer {
  # Install IIS role on Windows Server
  if (Get-Command Get-WindowsFeature -ErrorAction SilentlyContinue) {
    $feat = Get-WindowsFeature Web-Server
    if ($feat.InstallState -ne 'Installed') { Install-WindowsFeature Web-Server -IncludeManagementTools | Out-Null }
    foreach ($f in 'Web-WebSockets','Web-Static-Content','Web-Default-Doc','Web-Http-Errors','Web-Http-Logging','Web-Stat-Compression','Web-Dyn-Compression') {
      $ff = Get-WindowsFeature $f; if ($ff -and $ff.InstallState -ne 'Installed') { Install-WindowsFeature $f | Out-Null }
    }
  }
}

function Ensure-UrlRewrite {
  try {
    Import-Module WebAdministration -ErrorAction Stop
    $exists = Get-WebGlobalModule | Where-Object { $_.Name -eq 'RewriteModule' }
    if (-not $exists) {
      Write-Host 'Installing URL Rewrite module...'
      $msi = "$env:TEMP/urlrewrite.msi"
      $url = 'https://download.microsoft.com/download/1/2/8/128E2E22-C1B9-44A4-BE2A-5859ED1D4592/rewrite_amd64_en-US.msi'
      Invoke-WebRequest -Uri $url -OutFile $msi
      Start-Process msiexec.exe -ArgumentList "/i `"$msi`" /quiet /norestart" -Wait
      Remove-Item $msi -ErrorAction SilentlyContinue
    }
  } catch { Write-Warning "URL Rewrite ensure failed: $($_.Exception.Message)" }
}

function Ensure-IISNode {
  $dll = Join-Path $env:ProgramFiles 'iisnode/iisnode.dll'
  if (-not (Test-Path $dll)) {
    Write-Host 'Installing iisnode...'
    $msi = "$env:TEMP/iisnode.msi"
    $url = 'https://github.com/azure/iisnode/releases/download/v0.2.26/iisnode-full-v0.2.26-x64.msi'
    Invoke-WebRequest -Uri $url -OutFile $msi
    Start-Process msiexec.exe -ArgumentList "/i `"$msi`" /quiet /norestart" -Wait
    Remove-Item $msi -ErrorAction SilentlyContinue
  }
}

function Ensure-Node {
  $ver = node --version 2>$null
  if (-not $ver) {
    Write-Warning 'Node.js not found. Install Node.js LTS if API endpoints will be used.'
  }
}

function Grant-Permissions {
  param([string]$Path,[string]$AppPool)
  $principal = "IIS AppPool/$AppPool"
  $acl = Get-Acl $Path
  $rule = New-Object System.Security.AccessControl.FileSystemAccessRule($principal,'Modify,ReadAndExecute,Synchronize','ContainerInherit,ObjectInherit','None','Allow')
  $acl.SetAccessRule($rule)
  Set-Acl -Path $Path -AclObject $acl
  $acl2 = Get-Acl $Path
  $rule2 = New-Object System.Security.AccessControl.FileSystemAccessRule('IIS_IUSRS','ReadAndExecute,Synchronize','ContainerInherit,ObjectInherit','None','Allow')
  $acl2.AddAccessRule($rule2)
  Set-Acl -Path $Path -AclObject $acl2
}

Assert-Admin

# Ensure IIS is present
$isServer = ((Get-CimInstance -Class Win32_OperatingSystem).Caption) -like '*Server*'
if ($isServer) { Ensure-IISServer } else { Ensure-IISClient }

Import-Module WebAdministration -ErrorAction Stop
Ensure-UrlRewrite
Ensure-IISNode
Ensure-Node

if (-not (Test-Path $PhysicalPath)) { Write-Error "Path not found: $PhysicalPath"; exit 1 }

# Create App Pool
if (Test-Path "IIS:/AppPools/$AppPool") { Stop-WebAppPool -Name $AppPool -ErrorAction SilentlyContinue; Remove-WebAppPool -Name $AppPool -ErrorAction SilentlyContinue }
New-WebAppPool -Name $AppPool | Out-Null
Set-ItemProperty "IIS:/AppPools/$AppPool" -Name managedRuntimeVersion -Value ''
Set-ItemProperty "IIS:/AppPools/$AppPool" -Name enable32BitAppOnWin64 -Value $false

# Ensure logs dir exists
$logs = Join-Path $PhysicalPath 'logs'
if (-not (Test-Path $logs)) { New-Item -Path $logs -ItemType Directory | Out-Null }

Grant-Permissions -Path $PhysicalPath -AppPool $AppPool

# Create /scheduler application under Default Web Site
if (Test-Path "IIS:/Sites/$SiteName/$AppName") { Remove-WebApplication -Site $SiteName -Name $AppName -ErrorAction SilentlyContinue }
New-WebApplication -Site $SiteName -Name $AppName -PhysicalPath $PhysicalPath -ApplicationPool $AppPool | Out-Null

Restart-WebAppPool -Name $AppPool
Write-Host "IIS application created at http://localhost/$AppName" -ForegroundColor Green
