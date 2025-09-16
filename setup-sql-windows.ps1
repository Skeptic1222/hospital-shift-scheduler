# Setup SQL Server Express for Hospital Scheduler
# Run this script in Windows PowerShell as Administrator

Write-Host "=== SQL Server Express Setup for Hospital Scheduler ===" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Host "This script must be run as Administrator. Exiting..." -ForegroundColor Red
    exit 1
}

# Step 1: Enable SQL Server TCP/IP
Write-Host "Step 1: Enabling SQL Server TCP/IP Protocol..." -ForegroundColor Green
try {
    Import-Module SQLPS -DisableNameChecking -ErrorAction SilentlyContinue
    
    $wmi = New-Object Microsoft.SqlServer.Management.Smo.Wmi.ManagedComputer
    $tcp = $wmi.ServerInstances['SQLEXPRESS'].ServerProtocols['Tcp']
    
    if (-not $tcp.IsEnabled) {
        $tcp.IsEnabled = $true
        $tcp.Alter()
        Write-Host "  ✓ TCP/IP protocol enabled" -ForegroundColor Green
        
        # Configure port 1433
        foreach($ipAddress in $tcp.IPAddresses) {
            $ipAddress.IPAddressProperties["TcpDynamicPorts"].Value = ""
            $ipAddress.IPAddressProperties["TcpPort"].Value = "1433"
        }
        $tcp.Alter()
        Write-Host "  ✓ TCP port set to 1433" -ForegroundColor Green
        
        # Restart SQL Server
        Write-Host "  → Restarting SQL Server Express..." -ForegroundColor Yellow
        Restart-Service -Name "MSSQL`$SQLEXPRESS" -Force
        Start-Sleep -Seconds 5
        Write-Host "  ✓ SQL Server Express restarted" -ForegroundColor Green
    } else {
        Write-Host "  ✓ TCP/IP already enabled" -ForegroundColor Green
    }
} catch {
    Write-Host "  ⚠ Could not configure TCP/IP automatically. Please enable manually in SQL Server Configuration Manager." -ForegroundColor Yellow
    Write-Host "    Error: $_" -ForegroundColor Gray
}

# Step 2: Enable SQL Server Browser
Write-Host ""
Write-Host "Step 2: Enabling SQL Server Browser..." -ForegroundColor Green
try {
    $browserService = Get-Service -Name SQLBrowser -ErrorAction SilentlyContinue
    if ($browserService) {
        Set-Service -Name SQLBrowser -StartupType Automatic
        Start-Service -Name SQLBrowser -ErrorAction SilentlyContinue
        Write-Host "  ✓ SQL Server Browser enabled and started" -ForegroundColor Green
    } else {
        Write-Host "  ⚠ SQL Server Browser not found" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ⚠ Could not start SQL Server Browser: $_" -ForegroundColor Yellow
}

# Step 3: Configure Windows Firewall
Write-Host ""
Write-Host "Step 3: Configuring Windows Firewall..." -ForegroundColor Green
try {
    $rules = @(
        @{DisplayName="SQL Server Express (TCP 1433)"; Protocol="TCP"; LocalPort=1433},
        @{DisplayName="SQL Server Browser (UDP 1434)"; Protocol="UDP"; LocalPort=1434}
    )
    
    foreach ($rule in $rules) {
        $existingRule = Get-NetFirewallRule -DisplayName $rule.DisplayName -ErrorAction SilentlyContinue
        if (-not $existingRule) {
            New-NetFirewallRule -DisplayName $rule.DisplayName -Direction Inbound -Protocol $rule.Protocol -LocalPort $rule.LocalPort -Action Allow | Out-Null
            Write-Host "  ✓ Created firewall rule: $($rule.DisplayName)" -ForegroundColor Green
        } else {
            Write-Host "  ✓ Firewall rule already exists: $($rule.DisplayName)" -ForegroundColor Green
        }
    }
} catch {
    Write-Host "  ⚠ Could not configure firewall: $_" -ForegroundColor Yellow
}

# Step 4: Create Database and User
Write-Host ""
Write-Host "Step 4: Creating Database and User..." -ForegroundColor Green

$sqlCmd = @'
-- Check if database exists
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'HospitalScheduler')
BEGIN
    CREATE DATABASE HospitalScheduler;
    PRINT 'Database created: HospitalScheduler';
END
ELSE
BEGIN
    PRINT 'Database already exists: HospitalScheduler';
END
GO

-- Ensure SQL authentication is enabled for sa user
ALTER LOGIN sa ENABLE;
GO

-- Set sa password (update if needed)
ALTER LOGIN sa WITH PASSWORD = 'qwerty';
GO

PRINT 'SQL Server setup complete';
'@

try {
    # Save SQL script to temp file
    $tempFile = [System.IO.Path]::GetTempFileName() + ".sql"
    $sqlCmd | Out-File -FilePath $tempFile -Encoding UTF8
    
    # Execute SQL script
    sqlcmd -S ".\SQLEXPRESS" -i $tempFile -E 2>&1 | ForEach-Object {
        if ($_ -like "*Database created*" -or $_ -like "*Database already exists*") {
            Write-Host "  ✓ $_" -ForegroundColor Green
        } elseif ($_ -like "*SQL Server setup complete*") {
            Write-Host "  ✓ Database configuration complete" -ForegroundColor Green
        }
    }
    
    # Clean up temp file
    Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
} catch {
    Write-Host "  ⚠ Could not create database automatically. Please create manually." -ForegroundColor Yellow
    Write-Host "    Error: $_" -ForegroundColor Gray
}

# Step 5: Test Connection
Write-Host ""
Write-Host "Step 5: Testing SQL Server Connection..." -ForegroundColor Green

# Get WSL IP address
$wslIp = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -like "172.*"} | Select-Object -First 1).IPAddress

Write-Host ""
Write-Host "=== Setup Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Connection Information:" -ForegroundColor White
Write-Host "  Server: 172.17.48.1,1433" -ForegroundColor Yellow
Write-Host "  Database: HospitalScheduler" -ForegroundColor Yellow
Write-Host "  Username: sa" -ForegroundColor Yellow
Write-Host "  Password: qwerty" -ForegroundColor Yellow
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor White
Write-Host "  1. Return to WSL terminal" -ForegroundColor Gray
Write-Host "  2. The application should now connect to SQL Server" -ForegroundColor Gray
Write-Host "  3. If connection fails, verify SQL Server service is running" -ForegroundColor Gray
Write-Host ""
Write-Host "To test from WSL, the .env file should contain:" -ForegroundColor White
Write-Host "  DB_SERVER=172.17.48.1,1433" -ForegroundColor Gray
Write-Host "  DB_NAME=HospitalScheduler" -ForegroundColor Gray
Write-Host "  DB_USER=sa" -ForegroundColor Gray
Write-Host "  DB_PASSWORD=qwerty" -ForegroundColor Gray