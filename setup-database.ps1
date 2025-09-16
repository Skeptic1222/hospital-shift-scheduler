# SQL Server Express Database Setup Script for Hospital Scheduler
Write-Host "Setting up SQL Server Express for Hospital Scheduler..." -ForegroundColor Green

# Variables
$ServerInstance = "localhost\SQLEXPRESS"
$DatabaseName = "HospitalScheduler"
$SqlUser = "sa"
$SqlPassword = "YourStrong@Passw0rd"

# Check if database exists
Write-Host "`nChecking if database exists..." -ForegroundColor Yellow
$dbExists = sqlcmd -S $ServerInstance -E -Q "SET NOCOUNT ON; SELECT DB_ID('$DatabaseName')" -h -1 2>$null

if ($dbExists -and $dbExists.Trim() -ne "NULL" -and $dbExists.Trim() -ne "") {
    Write-Host "Database '$DatabaseName' already exists." -ForegroundColor Cyan
} else {
    Write-Host "Creating database '$DatabaseName'..." -ForegroundColor Yellow
    sqlcmd -S $ServerInstance -E -Q "CREATE DATABASE [$DatabaseName]" 2>$null
    Write-Host "Database created successfully." -ForegroundColor Green
}

# Check SQL Server authentication mode
Write-Host "`nChecking SQL Server authentication mode..." -ForegroundColor Yellow
$authMode = sqlcmd -S $ServerInstance -E -Q "SET NOCOUNT ON; SELECT SERVERPROPERTY('IsIntegratedSecurityOnly')" -h -1 2>$null

if ($authMode -eq "1") {
    Write-Host "SQL Server is in Windows Authentication mode only." -ForegroundColor Yellow
    Write-Host "To enable SQL authentication, you need to:" -ForegroundColor Cyan
    Write-Host "1. Open SQL Server Management Studio (SSMS)" -ForegroundColor White
    Write-Host "2. Right-click on server -> Properties -> Security" -ForegroundColor White
    Write-Host "3. Select 'SQL Server and Windows Authentication mode'" -ForegroundColor White
    Write-Host "4. Restart SQL Server service" -ForegroundColor White
} else {
    Write-Host "SQL Server supports mixed mode authentication." -ForegroundColor Green
    
    # Check if sa account is enabled
    Write-Host "`nChecking 'sa' account status..." -ForegroundColor Yellow
    $saStatus = sqlcmd -S $ServerInstance -E -Q "SET NOCOUNT ON; SELECT is_disabled FROM sys.sql_logins WHERE name = 'sa'" -h -1 2>$null
    
    if ($saStatus -eq "1") {
        Write-Host "Enabling 'sa' account..." -ForegroundColor Yellow
        sqlcmd -S $ServerInstance -E -Q "ALTER LOGIN [sa] ENABLE" 2>$null
        Write-Host "Setting password for 'sa' account..." -ForegroundColor Yellow
        sqlcmd -S $ServerInstance -E -Q "ALTER LOGIN [sa] WITH PASSWORD = '$SqlPassword'" 2>$null
        Write-Host "'sa' account enabled with password." -ForegroundColor Green
    } else {
        Write-Host "'sa' account is already enabled." -ForegroundColor Green
    }
}

# Create schema script path
$schemaFile = "C:\inetpub\wwwroot\scheduler\database-schema-sqlserver.sql"

# Check if schema file exists
if (Test-Path $schemaFile) {
    Write-Host "`nSchema file found. Running database schema creation..." -ForegroundColor Yellow
    sqlcmd -S $ServerInstance -d $DatabaseName -E -i $schemaFile 2>&1 | Out-Null
    Write-Host "Database schema created/updated." -ForegroundColor Green
} else {
    Write-Host "`nWarning: Schema file not found at: $schemaFile" -ForegroundColor Red
}

# Test connection with Windows Authentication
Write-Host "`nTesting database connection..." -ForegroundColor Yellow
$testResult = sqlcmd -S $ServerInstance -d $DatabaseName -E -Q "SELECT 'Connected'" -h -1 2>$null

if ($testResult -match "Connected") {
    Write-Host "Successfully connected to database!" -ForegroundColor Green
    
    # Show table count
    $tableCount = sqlcmd -S $ServerInstance -d $DatabaseName -E -Q "SET NOCOUNT ON; SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'scheduler'" -h -1 2>$null
    Write-Host "Found $tableCount tables in 'scheduler' schema." -ForegroundColor Cyan
} else {
    Write-Host "Failed to connect to database." -ForegroundColor Red
}

Write-Host "`n=== Setup Complete ===" -ForegroundColor Green
Write-Host "Database: $DatabaseName" -ForegroundColor White
Write-Host "Server: $ServerInstance" -ForegroundColor White
Write-Host "Authentication: Windows (for now)" -ForegroundColor White
Write-Host "`nTo use SQL authentication, follow the steps above to enable mixed mode." -ForegroundColor Yellow