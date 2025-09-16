# Enable TCP/IP for SQL Server Express
Write-Host "Enabling TCP/IP for SQL Server Express..." -ForegroundColor Green

# Import SQL Server module
Import-Module "SQLPS" -DisableNameChecking -ErrorAction SilentlyContinue

# Get SQL Server WMI object
$wmi = New-Object Microsoft.SqlServer.Management.Smo.Wmi.ManagedComputer

# Enable TCP/IP protocol
$tcp = $wmi.GetSmoObject("ManagedComputer[@Name='$env:COMPUTERNAME']/ServerInstance[@Name='SQLEXPRESS']/ServerProtocol[@Name='Tcp']")
$tcp.IsEnabled = $true
$tcp.Alter()

Write-Host "TCP/IP enabled successfully" -ForegroundColor Green

# Set TCP/IP properties
$tcpProperties = $tcp.IPAddresses
foreach ($ip in $tcpProperties) {
    if ($ip.Name -eq "IPAll") {
        $ip.IPAddressProperties["TcpPort"].Value = ""
        $ip.IPAddressProperties["TcpDynamicPorts"].Value = "1433"
    }
}
$tcp.Alter()

Write-Host "TCP/IP port configured" -ForegroundColor Green

# Restart SQL Server to apply changes
Write-Host "Restarting SQL Server Express..." -ForegroundColor Yellow
Restart-Service "MSSQL`$SQLEXPRESS" -Force
Start-Sleep -Seconds 5

Write-Host "SQL Server Express restarted" -ForegroundColor Green
Write-Host "TCP/IP configuration complete!" -ForegroundColor Green