# Hospital Scheduler IIS Auto-Start Configuration Script
# Run as Administrator on Windows Server
# This script configures IIS to automatically start the Node.js application

param(
    [string]$AppPath = "C:\inetpub\wwwroot\scheduler",
    [string]$NodePath = "C:\Program Files\nodejs\node.exe",
    [int]$Port = 3001,
    [string]$ServiceName = "HospitalSchedulerAPI"
)

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Hospital Scheduler IIS Configuration" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

# Check if running as Administrator
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Error "This script must be run as Administrator. Exiting..."
    exit 1
}

# Function to install IIS features
function Install-IISFeatures {
    Write-Host "`n[1/7] Installing IIS features..." -ForegroundColor Green
    
    $features = @(
        "IIS-WebServerRole",
        "IIS-WebServer",
        "IIS-CommonHttpFeatures",
        "IIS-HttpErrors",
        "IIS-HttpRedirect",
        "IIS-ApplicationDevelopment",
        "IIS-NetFxExtensibility45",
        "IIS-HealthAndDiagnostics",
        "IIS-HttpLogging",
        "IIS-Security",
        "IIS-RequestFiltering",
        "IIS-Performance",
        "IIS-WebServerManagementTools",
        "IIS-IIS6ManagementCompatibility",
        "IIS-Metabase",
        "IIS-ApplicationInit"
    )
    
    foreach ($feature in $features) {
        Enable-WindowsOptionalFeature -Online -FeatureName $feature -All -NoRestart | Out-Null
    }
    
    Write-Host "✓ IIS features installed" -ForegroundColor Green
}

# Function to install URL Rewrite and ARR
function Install-IISModules {
    Write-Host "`n[2/7] Installing IIS modules..." -ForegroundColor Green
    
    # Install Chocolatey if not present
    if (!(Get-Command choco -ErrorAction SilentlyContinue)) {
        Set-ExecutionPolicy Bypass -Scope Process -Force
        [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
        iex ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))
    }
    
    # Install URL Rewrite
    choco install urlrewrite -y --no-progress
    
    # Install ARR
    choco install iis-arr -y --no-progress
    
    # Install iisnode
    choco install iisnode -y --no-progress
    
    Write-Host "✓ IIS modules installed" -ForegroundColor Green
}

# Function to configure Application Pool
function Configure-AppPool {
    Write-Host "`n[3/7] Configuring Application Pool..." -ForegroundColor Green
    
    Import-Module WebAdministration
    
    $appPoolName = "HospitalSchedulerPool"
    
    # Remove existing app pool if exists
    if (Test-Path "IIS:\AppPools\$appPoolName") {
        Remove-WebAppPool -Name $appPoolName
    }
    
    # Create new app pool
    New-WebAppPool -Name $appPoolName
    
    # Configure app pool settings
    $appPool = Get-Item "IIS:\AppPools\$appPoolName"
    $appPool.processIdentity.identityType = "ApplicationPoolIdentity"
    $appPool.managedRuntimeVersion = ""  # No managed code
    $appPool.enable32BitAppOnWin64 = $false
    $appPool.autoStart = $true
    $appPool.startMode = "AlwaysRunning"  # Keep warm
    $appPool | Set-Item
    
    # Set recycling conditions
    Set-ItemProperty -Path "IIS:\AppPools\$appPoolName" -Name Recycling.periodicRestart.time -Value "00:00:00"
    Set-ItemProperty -Path "IIS:\AppPools\$appPoolName" -Name Recycling.periodicRestart.requests -Value 0
    
    # Set process idle timeout to 0 (never timeout)
    Set-ItemProperty -Path "IIS:\AppPools\$appPoolName" -Name processModel.idleTimeout -Value "00:00:00"
    
    Write-Host "✓ Application Pool configured" -ForegroundColor Green
}

# Function to configure IIS Site
function Configure-IISSite {
    Write-Host "`n[4/7] Configuring IIS Site..." -ForegroundColor Green
    
    Import-Module WebAdministration
    
    $siteName = "HospitalScheduler"
    
    # Remove existing site if exists
    if (Get-Website -Name $siteName -ErrorAction SilentlyContinue) {
        Remove-Website -Name $siteName
    }
    
    # Create website
    New-Website -Name $siteName `
                -Port 80 `
                -PhysicalPath $AppPath `
                -ApplicationPool "HospitalSchedulerPool"
    
    # Configure site for always running
    Set-ItemProperty -Path "IIS:\Sites\$siteName" -Name applicationDefaults.preloadEnabled -Value $true
    
    Write-Host "✓ IIS Site configured" -ForegroundColor Green
}

# Function to configure web.config for auto-start
function Configure-WebConfig {
    Write-Host "`n[5/7] Configuring web.config..." -ForegroundColor Green
    
    $webConfigPath = Join-Path $AppPath "web.config"
    
    $webConfig = @"
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <!-- Application Initialization -->
    <applicationInitialization doAppInitAfterRestart="true" skipManagedModules="false">
      <add initializationPage="/api/health" />
    </applicationInitialization>
    
    <!-- IISNode Configuration -->
    <handlers>
      <add name="iisnode" path="server.js" verb="*" modules="iisnode" />
    </handlers>
    
    <iisnode 
      node_env="production"
      nodeProcessCountPerApplication="1"
      maxConcurrentRequestsPerProcess="1024"
      maxNamedPipeConnectionRetry="100"
      namedPipeConnectionRetryDelay="250"
      maxNamedPipeConnectionPoolSize="512"
      maxNamedPipePooledConnectionAge="30000"
      asyncCompletionThreadCount="0"
      initialRequestBufferSize="4096"
      maxRequestBufferSize="65536"
      watchedFiles="*.js;web.config"
      uncFileChangesPollingInterval="5000"
      gracefulShutdownTimeout="60000"
      loggingEnabled="true"
      logDirectory="logs"
      debuggingEnabled="false"
      debugHeaderEnabled="false"
      devErrorsEnabled="false"
      flushResponse="false"
      enableXFF="true"
    />
    
    <!-- URL Rewrite Rules -->
    <rewrite>
      <rules>
        <!-- Redirect to HTTPS -->
        <rule name="HTTP to HTTPS" stopProcessing="true">
          <match url="(.*)" />
          <conditions>
            <add input="{HTTPS}" pattern="off" ignoreCase="true" />
          </conditions>
          <action type="Redirect" url="https://{HTTP_HOST}/scheduler/{R:1}" redirectType="Permanent" />
        </rule>
        
        <!-- Reverse proxy to Node.js -->
        <rule name="ReverseProxyInboundRule" stopProcessing="true">
          <match url="^scheduler/api/(.*)" />
          <action type="Rewrite" url="http://localhost:$Port/api/{R:1}" />
        </rule>
        
        <!-- WebSocket support -->
        <rule name="WebSocketProxy" stopProcessing="true">
          <match url="^scheduler/api/socket.io/(.*)" />
          <action type="Rewrite" url="http://localhost:$Port/socket.io/{R:1}" />
        </rule>
        
        <!-- Static files -->
        <rule name="StaticContent">
          <action type="Rewrite" url="build/{REQUEST_URI}" />
        </rule>
        
        <!-- React Router -->
        <rule name="ReactRouter" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
          </conditions>
          <action type="Rewrite" url="/scheduler/" />
        </rule>
      </rules>
    </rewrite>
    
    <!-- Security Headers -->
    <httpProtocol>
      <customHeaders>
        <remove name="X-Powered-By" />
        <add name="X-Frame-Options" value="DENY" />
        <add name="X-Content-Type-Options" value="nosniff" />
        <add name="X-XSS-Protection" value="1; mode=block" />
        <add name="Strict-Transport-Security" value="max-age=31536000; includeSubDomains" />
        <add name="Content-Security-Policy" value="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';" />
      </customHeaders>
    </httpProtocol>
    
    <!-- Static Content -->
    <staticContent>
      <mimeMap fileExtension=".json" mimeType="application/json" />
      <mimeMap fileExtension=".webmanifest" mimeType="application/manifest+json" />
    </staticContent>
    
    <!-- Compression -->
    <urlCompression doStaticCompression="true" doDynamicCompression="true" />
    
    <!-- Default Document -->
    <defaultDocument>
      <files>
        <clear />
        <add value="index.html" />
      </files>
    </defaultDocument>
  </system.webServer>
  
  <!-- App Settings for Node.js -->
  <appSettings>
    <add key="NODE_ENV" value="production" />
    <add key="PORT" value="$Port" />
    <add key="DB_SERVER" value="localhost\SQLEXPRESS" />
    <add key="DB_NAME" value="HospitalScheduler" />
  </appSettings>
</configuration>
"@
    
    Set-Content -Path $webConfigPath -Value $webConfig -Encoding UTF8
    Write-Host "✓ web.config created" -ForegroundColor Green
}

# Function to create Windows Service using NSSM
function Create-WindowsService {
    Write-Host "`n[6/7] Creating Windows Service..." -ForegroundColor Green
    
    # Install NSSM if not present
    if (!(Get-Command nssm -ErrorAction SilentlyContinue)) {
        choco install nssm -y --no-progress
    }
    
    # Remove existing service if exists
    nssm stop $ServiceName 2>$null
    nssm remove $ServiceName confirm 2>$null
    
    # Create new service
    nssm install $ServiceName $NodePath "$AppPath\server.js"
    
    # Configure service
    nssm set $ServiceName AppDirectory $AppPath
    nssm set $ServiceName DisplayName "Hospital Scheduler API Service"
    nssm set $ServiceName Description "Hospital Shift Scheduler Backend API Service"
    nssm set $ServiceName Start SERVICE_AUTO_START
    
    # Set up logging
    $logPath = Join-Path $AppPath "logs"
    if (!(Test-Path $logPath)) {
        New-Item -ItemType Directory -Path $logPath | Out-Null
    }
    
    nssm set $ServiceName AppStdout "$logPath\service.log"
    nssm set $ServiceName AppStderr "$logPath\error.log"
    nssm set $ServiceName AppRotateFiles 1
    nssm set $ServiceName AppRotateOnline 1
    nssm set $ServiceName AppRotateBytes 10485760
    
    # Set environment variables
    nssm set $ServiceName AppEnvironmentExtra NODE_ENV=production
    nssm set $ServiceName AppEnvironmentExtra PORT=$Port
    nssm set $ServiceName AppEnvironmentExtra DB_SERVER=localhost\SQLEXPRESS
    nssm set $ServiceName AppEnvironmentExtra DB_NAME=HospitalScheduler
    
    # Set service dependencies
    nssm set $ServiceName DependOnService MSSQLSERVER
    
    # Start the service
    nssm start $ServiceName
    
    Write-Host "✓ Windows Service created and started" -ForegroundColor Green
}

# Function to configure firewall
function Configure-Firewall {
    Write-Host "`n[7/7] Configuring Windows Firewall..." -ForegroundColor Green
    
    # Remove existing rules
    Remove-NetFirewallRule -DisplayName "Hospital Scheduler*" -ErrorAction SilentlyContinue
    
    # Add firewall rules
    New-NetFirewallRule -DisplayName "Hospital Scheduler HTTP" `
                        -Direction Inbound `
                        -Protocol TCP `
                        -LocalPort 80 `
                        -Action Allow | Out-Null
    
    New-NetFirewallRule -DisplayName "Hospital Scheduler HTTPS" `
                        -Direction Inbound `
                        -Protocol TCP `
                        -LocalPort 443 `
                        -Action Allow | Out-Null
    
    New-NetFirewallRule -DisplayName "Hospital Scheduler API" `
                        -Direction Inbound `
                        -Protocol TCP `
                        -LocalPort $Port `
                        -Action Allow | Out-Null
    
    Write-Host "✓ Firewall configured" -ForegroundColor Green
}

# Function to create scheduled task for cleanup
function Create-CleanupTask {
    Write-Host "`n[Bonus] Creating cleanup scheduled task..." -ForegroundColor Green
    
    $taskName = "HospitalSchedulerCleanup"
    $scriptContent = @"
# Cleanup script
`$logPath = "$AppPath\logs"
`$daysToKeep = 30

# Clean old logs
Get-ChildItem -Path `$logPath -Recurse -File | 
    Where-Object {`$_.LastWriteTime -lt (Get-Date).AddDays(-`$daysToKeep)} | 
    Remove-Item -Force

# Clean Node.js cache
Remove-Item -Path "$AppPath\node_modules\.cache" -Recurse -Force -ErrorAction SilentlyContinue

# Restart service if memory usage is high
`$service = Get-Service -Name "$ServiceName"
`$process = Get-Process -Name node -ErrorAction SilentlyContinue | 
    Where-Object {`$_.Path -like "*$AppPath*"}

if (`$process -and `$process.WorkingSet -gt 1GB) {
    Restart-Service -Name "$ServiceName"
    Add-Content -Path "`$logPath\cleanup.log" -Value "[`$(Get-Date)] Service restarted due to high memory usage"
}
"@
    
    $cleanupScriptPath = Join-Path $AppPath "cleanup.ps1"
    Set-Content -Path $cleanupScriptPath -Value $scriptContent -Encoding UTF8
    
    # Create scheduled task
    $action = New-ScheduledTaskAction -Execute "PowerShell.exe" `
                                      -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$cleanupScriptPath`""
    
    $trigger = New-ScheduledTaskTrigger -Daily -At 3am
    
    $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" `
                                            -LogonType ServiceAccount `
                                            -RunLevel Highest
    
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries `
                                             -DontStopIfGoingOnBatteries `
                                             -StartWhenAvailable
    
    Register-ScheduledTask -TaskName $taskName `
                           -Action $action `
                           -Trigger $trigger `
                           -Principal $principal `
                           -Settings $settings `
                           -Force | Out-Null
    
    Write-Host "✓ Cleanup task created" -ForegroundColor Green
}

# Main execution
try {
    Install-IISFeatures
    Install-IISModules
    Configure-AppPool
    Configure-IISSite
    Configure-WebConfig
    Create-WindowsService
    Configure-Firewall
    Create-CleanupTask
    
    Write-Host "`n======================================" -ForegroundColor Green
    Write-Host "✓ Configuration Complete!" -ForegroundColor Green
    Write-Host "======================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Build the React application: npm run build" -ForegroundColor White
    Write-Host "2. Configure environment variables in .env file" -ForegroundColor White
    Write-Host "3. Test the application at: http://localhost/scheduler" -ForegroundColor White
    Write-Host "4. Check service status: Get-Service $ServiceName" -ForegroundColor White
    Write-Host "5. View logs at: $AppPath\logs\" -ForegroundColor White
    Write-Host ""
    Write-Host "Service Management Commands:" -ForegroundColor Yellow
    Write-Host "Start:   nssm start $ServiceName" -ForegroundColor White
    Write-Host "Stop:    nssm stop $ServiceName" -ForegroundColor White
    Write-Host "Restart: nssm restart $ServiceName" -ForegroundColor White
    Write-Host "Status:  nssm status $ServiceName" -ForegroundColor White
}
catch {
    Write-Error "Configuration failed: $_"
    exit 1
}