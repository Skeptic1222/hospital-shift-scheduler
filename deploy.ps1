# Hospital Shift Scheduler Deployment Script for Windows/IIS
# Requires Administrator privileges

param(
    [Parameter(Mandatory=$false)]
    [string]$Environment = "production",
    
    [Parameter(Mandatory=$false)]
    [string]$SqlServer = ".\SQLEXPRESS",
    
    [Parameter(Mandatory=$false)]
    [string]$IISAppName = "HospitalScheduler",
    
    [Parameter(Mandatory=$false)]
    [int]$Port = 3001
)

# Check if running as Administrator
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Error "This script must be run as Administrator. Exiting..."
    exit 1
}

Write-Host "Hospital Shift Scheduler Deployment Script" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""

# Step 1: Check Prerequisites
Write-Host "Step 1: Checking Prerequisites..." -ForegroundColor Yellow

# Check Node.js
$nodeVersion = node --version 2>$null
if ($null -eq $nodeVersion) {
    Write-Error "Node.js is not installed. Please install Node.js 18+ first."
    exit 1
}
Write-Host "✓ Node.js installed: $nodeVersion" -ForegroundColor Green

# Check IIS
$iisFeature = Get-WindowsFeature -Name Web-Server -ErrorAction SilentlyContinue
if ($iisFeature.InstallState -ne "Installed") {
    Write-Host "Installing IIS..." -ForegroundColor Yellow
    Enable-WindowsFeature -Name Web-Server -IncludeManagementTools
}
Write-Host "✓ IIS is installed" -ForegroundColor Green

# Check IISNode
$iisnodePath = "${env:ProgramFiles}\iisnode\iisnode.dll"
if (-not (Test-Path $iisnodePath)) {
    Write-Host "Installing IISNode..." -ForegroundColor Yellow
    # Download and install IISNode
    $iisnodeUrl = "https://github.com/azure/iisnode/releases/download/v0.2.26/iisnode-full-v0.2.26-x64.msi"
    $installerPath = "$env:TEMP\iisnode.msi"
    Invoke-WebRequest -Uri $iisnodeUrl -OutFile $installerPath
    Start-Process msiexec.exe -Wait -ArgumentList "/i $installerPath /quiet"
    Remove-Item $installerPath
}
Write-Host "✓ IISNode is installed" -ForegroundColor Green

# Check URL Rewrite Module
$urlRewrite = Get-WebConfigurationProperty -PSPath "MACHINE/WEBROOT/APPHOST" -Filter "system.webServer/rewrite/rules" -Name "." -ErrorAction SilentlyContinue
if ($null -eq $urlRewrite) {
    Write-Host "Installing URL Rewrite Module..." -ForegroundColor Yellow
    $urlRewriteUrl = "https://download.microsoft.com/download/1/2/8/128E2E22-C1B9-44A4-BE2A-5859ED1D4592/rewrite_amd64_en-US.msi"
    $installerPath = "$env:TEMP\urlrewrite.msi"
    Invoke-WebRequest -Uri $urlRewriteUrl -OutFile $installerPath
    Start-Process msiexec.exe -Wait -ArgumentList "/i $installerPath /quiet"
    Remove-Item $installerPath
}
Write-Host "✓ URL Rewrite Module is installed" -ForegroundColor Green

# Check SQL Server
try {
    $sqlConnection = New-Object System.Data.SqlClient.SqlConnection
    $sqlConnection.ConnectionString = "Server=$SqlServer;Database=master;Integrated Security=true;TrustServerCertificate=true"
    $sqlConnection.Open()
    $sqlConnection.Close()
    Write-Host "✓ SQL Server is accessible" -ForegroundColor Green
} catch {
    Write-Error "Cannot connect to SQL Server at $SqlServer. Please check SQL Server is running."
    exit 1
}

Write-Host ""

# Step 2: Setup Database
Write-Host "Step 2: Setting up Database..." -ForegroundColor Yellow

$sqlCmd = "IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'HospitalScheduler') BEGIN CREATE DATABASE HospitalScheduler; PRINT 'Database created successfully'; END ELSE BEGIN PRINT 'Database already exists'; END"

Invoke-Sqlcmd -ServerInstance $SqlServer -Query $sqlCmd -TrustServerCertificate

# Run schema creation script
if (Test-Path ".\database-schema-sqlserver.sql") {
    Write-Host "Creating database schema..." -ForegroundColor Yellow
    Invoke-Sqlcmd -ServerInstance $SqlServer -InputFile ".\database-schema-sqlserver.sql" -TrustServerCertificate
    Write-Host "✓ Database schema created" -ForegroundColor Green
}

# Run stored procedures
if (Test-Path ".\fcfs-stored-procedures.sql") {
    Write-Host "Creating stored procedures..." -ForegroundColor Yellow
    Invoke-Sqlcmd -ServerInstance $SqlServer -Database "HospitalScheduler" -InputFile ".\fcfs-stored-procedures.sql" -TrustServerCertificate
    Write-Host "✓ Stored procedures created" -ForegroundColor Green
}

Write-Host ""

# Step 3: Install Node Dependencies
Write-Host "Step 3: Installing Node.js Dependencies..." -ForegroundColor Yellow

if (Test-Path ".\package.json") {
    npm install --production
    Write-Host "✓ Dependencies installed" -ForegroundColor Green
} else {
    Write-Warning "package.json not found, skipping npm install"
}

Write-Host ""

# Step 4: Build React App
Write-Host "Step 4: Building React Application..." -ForegroundColor Yellow

if (Test-Path ".\src\App.jsx") {
    npm run build
    Write-Host "✓ React app built" -ForegroundColor Green
} else {
    Write-Warning "React source not found, skipping build"
}

Write-Host ""

# Step 5: Setup IIS Application
Write-Host "Step 5: Configuring IIS..." -ForegroundColor Yellow

Import-Module WebAdministration

# Create Application Pool
$appPoolName = "$IISAppName-AppPool"
if (Test-Path "IIS:\AppPools\$appPoolName") {
    Remove-WebAppPool -Name $appPoolName
}
New-WebAppPool -Name $appPoolName
Set-ItemProperty -Path "IIS:\AppPools\$appPoolName" -Name processIdentity.identityType -Value ApplicationPoolIdentity
Set-ItemProperty -Path "IIS:\AppPools\$appPoolName" -Name enable32BitAppOnWin64 -Value $false
Set-ItemProperty -Path "IIS:\AppPools\$appPoolName" -Name managedRuntimeVersion -Value ""
Write-Host "✓ Application pool created: $appPoolName" -ForegroundColor Green

# Create Website
$siteName = $IISAppName
$physicalPath = (Get-Location).Path

if (Get-Website -Name $siteName -ErrorAction SilentlyContinue) {
    Remove-Website -Name $siteName
}

New-Website -Name $siteName -Port $Port -PhysicalPath $physicalPath -ApplicationPool $appPoolName
Write-Host "✓ Website created: $siteName on port $Port" -ForegroundColor Green

# Set permissions
$acl = Get-Acl $physicalPath
$permission = "IIS_IUSRS", "ReadAndExecute,Write", "ContainerInherit,ObjectInherit", "None", "Allow"
$accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule $permission
$acl.SetAccessRule($accessRule)
Set-Acl $physicalPath $acl
Write-Host "✓ Permissions configured" -ForegroundColor Green

Write-Host ""

# Step 6: Configure Environment Variables
Write-Host "Step 6: Setting Environment Variables..." -ForegroundColor Yellow

# Create .env file if it doesn't exist
if (-not (Test-Path ".\.env")) {
    $envLines = @(
        "NODE_ENV=$Environment",
        "PORT=$Port",
        "DB_SERVER=$SqlServer",
        "DB_NAME=HospitalScheduler",
        "USE_WINDOWS_AUTH=true",
        "JWT_SECRET=$(New-Guid)",
        "ENCRYPTION_KEY=$([System.Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32)))",
        "REDIS_HOST=localhost",
        "REDIS_PORT=6379",
        "AUTH0_DOMAIN=your-domain.auth0.com",
        "AUTH0_CLIENT_ID=your-client-id",
        "AUTH0_CLIENT_SECRET=your-client-secret",
        "AUTH0_AUDIENCE=https://api.hospital-scheduler.com",
        "EMAIL_HOST=smtp.sendgrid.net",
        "EMAIL_PORT=587",
        "EMAIL_USER=apikey",
        "EMAIL_PASSWORD=your-sendgrid-api-key",
        "EMAIL_FROM=noreply@hospital-scheduler.com",
        "TWILIO_ACCOUNT_SID=your-twilio-sid",
        "TWILIO_AUTH_TOKEN=your-twilio-token",
        "TWILIO_PHONE_NUMBER=+1234567890",
        "VAPID_PUBLIC_KEY=generate-vapid-keys",
        "VAPID_PRIVATE_KEY=generate-vapid-keys",
        "ALLOWED_ORIGINS=http://localhost:$Port,https://localhost:$Port"
    )
    Set-Content -Path ".\.env" -Value $envLines -Encoding UTF8
    Write-Host "✓ Created .env file (please update with your actual values)" -ForegroundColor Yellow
} else {
    Write-Host "✓ .env file already exists" -ForegroundColor Green
}

Write-Host ""

# Step 7: Setup Windows Service for Redis (Optional)
Write-Host "Step 7: Redis Setup (Optional)..." -ForegroundColor Yellow

$redisInstalled = Get-Service -Name "Redis" -ErrorAction SilentlyContinue
if ($null -eq $redisInstalled) {
    Write-Host "Redis is not installed. For production, install Redis or use Azure Cache for Redis." -ForegroundColor Yellow
} else {
    Start-Service -Name "Redis"
    Write-Host "✓ Redis service started" -ForegroundColor Green
}

Write-Host ""

# Step 8: Create Scheduled Task for Maintenance
Write-Host "Step 8: Creating Maintenance Schedule..." -ForegroundColor Yellow

$taskName = "$IISAppName-Maintenance"
$taskExists = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

if ($taskExists) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

$action = New-ScheduledTaskAction -Execute "sqlcmd" -Argument "-S $SqlServer -d HospitalScheduler -Q `"EXEC scheduler.MaintenanceCleanup`""
$trigger = New-ScheduledTaskTrigger -Daily -At "02:00"
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -RunLevel Highest
Write-Host "✓ Maintenance task scheduled" -ForegroundColor Green

Write-Host ""

# Step 9: Start Website
Write-Host "Step 9: Starting Application..." -ForegroundColor Yellow

Start-Website -Name $siteName
Start-WebAppPool -Name $appPoolName
Write-Host "✓ Application started" -ForegroundColor Green

Write-Host ""

# Step 10: Health Check
Write-Host "Step 10: Performing Health Check..." -ForegroundColor Yellow

Start-Sleep -Seconds 5

try {
    $response = Invoke-WebRequest -Uri "http://localhost:$Port/api/health" -UseBasicParsing
    if ($response.StatusCode -eq 200) {
        Write-Host "✓ Health check passed" -ForegroundColor Green
        $health = $response.Content | ConvertFrom-Json
        Write-Host "  Status: $($health.status)" -ForegroundColor Green
    }
} catch {
    Write-Warning "Health check failed. Please check logs at: $physicalPath\logs"
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Deployment Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Application URL: http://localhost:$Port" -ForegroundColor Cyan
Write-Host "API URL: http://localhost:$Port/api" -ForegroundColor Cyan
Write-Host "Logs: $physicalPath\logs" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Update the .env file with your actual API keys" -ForegroundColor White
Write-Host "2. Configure Auth0 application settings" -ForegroundColor White
Write-Host "3. Set up SSL certificate for HTTPS" -ForegroundColor White
Write-Host "4. Configure firewall rules if needed" -ForegroundColor White
Write-Host "5. Set up monitoring and alerting" -ForegroundColor White
Write-Host ""

# Create README for deployment
$deployInfo = @(
    "# Hospital Shift Scheduler - Deployment Information",
    "",
    "## Deployment Date: $(Get-Date -Format \"yyyy-MM-dd HH:mm:ss\")",
    "",
    "## Configuration",
    "- Environment: $Environment",
    "- SQL Server: $SqlServer",
    "- IIS Application: $IISAppName",
    "- Port: $Port",
    "- Physical Path: $physicalPath",
    "",
    "## Services",
    "- Application Pool: $appPoolName",
    "- Website: $siteName",
    "- Database: HospitalScheduler",
    "- Maintenance Task: $taskName",
    "",
    "## URLs",
    "- Application: http://localhost:$Port",
    "- API: http://localhost:$Port/api",
    "- Health Check: http://localhost:$Port/api/health",
    "",
    "## Management Commands",
    "",
    "### Restart Application",
    "``````powershell",
    "Restart-WebAppPool -Name \"$appPoolName\"",
    "``````",
    "",
    "### View Logs",
    "``````powershell",
    "Get-Content \"$physicalPath\\logs\\*.log\" -Tail 50",
    "``````",
    "",
    "### Run Database Maintenance",
    "``````powershell",
    "Invoke-Sqlcmd -ServerInstance \"$SqlServer\" -Database \"HospitalScheduler\" -Query \"EXEC scheduler.MaintenanceCleanup\"",
    "``````",
    "",
    "### Backup Database",
    "``````powershell",
    "Backup-SqlDatabase -ServerInstance \"$SqlServer\" -Database \"HospitalScheduler\" -BackupFile \"C:\\Backups\\HospitalScheduler_$(Get-Date -Format 'yyyyMMdd_HHmmss').bak\"",
    "``````",
    "",
    "## Troubleshooting",
    "",
    "### Check Application Pool Status",
    "``````powershell",
    "Get-WebAppPoolState -Name \"$appPoolName\"",
    "``````",
    "",
    "### Check Website Status",
    "``````powershell",
    "Get-Website -Name \"$siteName\"",
    "``````",
    "",
    "### View IIS Logs",
    "``````powershell",
    "Get-Content \"C:\\inetpub\\logs\\LogFiles\\W3SVC*\\*.log\" -Tail 50",
    "``````",
    "",
    "### Test Database Connection",
    "``````powershell",
    "Test-NetConnection -ComputerName localhost -Port 1433",
    "``````"
)
Set-Content -Path ".\DEPLOYMENT_INFO.md" -Value $deployInfo -Encoding UTF8

Write-Host "Deployment information saved to DEPLOYMENT_INFO.md" -ForegroundColor Green
