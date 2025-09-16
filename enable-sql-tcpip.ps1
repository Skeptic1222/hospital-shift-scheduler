# Enable SQL Server TCP/IP for remote connections from WSL
Write-Host "Configuring SQL Server Express for TCP/IP connections..." -ForegroundColor Green

# Import SQL Server module
Import-Module SQLPS -DisableNameChecking -ErrorAction SilentlyContinue

# Enable TCP/IP Protocol
Write-Host "Enabling TCP/IP protocol..." -ForegroundColor Yellow
$wmi = New-Object Microsoft.SqlServer.Management.Smo.Wmi.ManagedComputer
$tcp = $wmi.ServerInstances['SQLEXPRESS'].ServerProtocols['Tcp']
$tcp.IsEnabled = $true
$tcp.Alter()
Write-Host "TCP/IP protocol enabled" -ForegroundColor Green

# Set TCP Port to 1433 for all IP addresses
Write-Host "Configuring TCP port..." -ForegroundColor Yellow
foreach($ipAddress in $tcp.IPAddresses) {
    $ipAddress.IPAddressProperties["TcpDynamicPorts"].Value = ""
    $ipAddress.IPAddressProperties["TcpPort"].Value = "1433"
}
$tcp.Alter()
Write-Host "TCP port configured to 1433" -ForegroundColor Green

# Enable SQL Server Browser
Write-Host "Starting SQL Server Browser service..." -ForegroundColor Yellow
Set-Service -Name SQLBrowser -StartupType Automatic
Start-Service -Name SQLBrowser
Write-Host "SQL Server Browser started" -ForegroundColor Green

# Restart SQL Server to apply changes
Write-Host "Restarting SQL Server Express..." -ForegroundColor Yellow
Restart-Service -Name "MSSQL`$SQLEXPRESS" -Force
Write-Host "SQL Server Express restarted" -ForegroundColor Green

# Configure Windows Firewall
Write-Host "Configuring Windows Firewall..." -ForegroundColor Yellow
New-NetFirewallRule -DisplayName "SQL Server Express" -Direction Inbound -Protocol TCP -LocalPort 1433 -Action Allow -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName "SQL Server Browser" -Direction Inbound -Protocol UDP -LocalPort 1434 -Action Allow -ErrorAction SilentlyContinue
Write-Host "Firewall rules configured" -ForegroundColor Green

Write-Host "`n=== Configuration Complete ===" -ForegroundColor Green
Write-Host "SQL Server Express is now accessible from WSL" -ForegroundColor White
Write-Host "Connection string: 172.17.48.1\SQLEXPRESS or 172.17.48.1,1433" -ForegroundColor Cyan