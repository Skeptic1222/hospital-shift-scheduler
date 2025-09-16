# Simple SQL Server Express TCP/IP Enabler
# Run as Administrator

Write-Host "Enabling SQL Server TCP/IP..." -ForegroundColor Green

# Enable TCP/IP using sqlcmd
$enableTcp = @"
EXEC xp_instance_regwrite 
    N'HKEY_LOCAL_MACHINE', 
    N'SOFTWARE\Microsoft\Microsoft SQL Server\MSSQLServer\SuperSocketNetLib\Tcp',
    N'Enabled', 
    REG_DWORD, 
    1
GO
"@

# Create database
$createDb = @"
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'HospitalScheduler')
    CREATE DATABASE HospitalScheduler;
GO

ALTER LOGIN sa ENABLE;
GO

ALTER LOGIN sa WITH PASSWORD = 'qwerty';
GO
"@

# Execute commands
Write-Host "Creating database..." -ForegroundColor Yellow
$createDb | sqlcmd -S ".\SQLEXPRESS" -E

Write-Host "Configuring firewall..." -ForegroundColor Yellow
netsh advfirewall firewall add rule name="SQL Server" dir=in action=allow protocol=TCP localport=1433
netsh advfirewall firewall add rule name="SQL Browser" dir=in action=allow protocol=UDP localport=1434

Write-Host "Starting SQL Browser..." -ForegroundColor Yellow
net start SQLBrowser

Write-Host "Restarting SQL Server..." -ForegroundColor Yellow
net stop "MSSQL`$SQLEXPRESS"
net start "MSSQL`$SQLEXPRESS"

Write-Host "Done! Connection string: 172.17.48.1,1433" -ForegroundColor Green