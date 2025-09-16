# SQL Server Express Setup Instructions

## Current Status
The Node.js application has been configured to connect to SQL Server Express on the Windows host. However, SQL Server needs to be configured to accept TCP/IP connections from WSL.

## Configuration Complete ✅
1. **Environment variables fixed**: The `.env` file now correctly points to Windows host IP
2. **Database connection code updated**: The `db-config.js` now handles port-based connections
3. **Connection string configured**: `DB_SERVER=172.17.48.1,1433`

## Action Required on Windows 🔧

You need to run the PowerShell script **as Administrator** on Windows to enable SQL Server TCP/IP connections:

### Option 1: Run the Complete Setup Script
Open PowerShell as Administrator and run:
```powershell
cd C:\inetpub\wwwroot\scheduler
.\setup-sql-windows.ps1
```

This script will:
- Enable TCP/IP protocol on port 1433
- Start SQL Server Browser service
- Configure Windows Firewall rules
- Create the HospitalScheduler database
- Enable the 'sa' user with password

### Option 2: Manual Configuration
If the script fails, manually configure SQL Server:

1. **Open SQL Server Configuration Manager**
2. **Enable TCP/IP**:
   - SQL Server Network Configuration → Protocols for SQLEXPRESS
   - Right-click TCP/IP → Enable
   - Double-click TCP/IP → IP Addresses tab
   - For all IP addresses, clear "TCP Dynamic Ports" and set "TCP Port" to 1433
3. **Restart SQL Server**:
   - SQL Server Services → SQL Server (SQLEXPRESS) → Restart
4. **Start SQL Server Browser**:
   - SQL Server Services → SQL Server Browser → Start
5. **Configure Firewall**:
   ```powershell
   New-NetFirewallRule -DisplayName "SQL Server" -Direction Inbound -Protocol TCP -LocalPort 1433 -Action Allow
   New-NetFirewallRule -DisplayName "SQL Server Browser" -Direction Inbound -Protocol UDP -LocalPort 1434 -Action Allow
   ```

## Testing the Connection

After running the Windows setup, test the connection from WSL:

```bash
# Clear any cached environment variables
unset DB_SERVER

# Start the server
node server.js
```

The server should now connect to SQL Server Express and create the necessary tables.

## Current .env Configuration
```
DB_SERVER=172.17.48.1,1433
DB_NAME=HospitalScheduler
DB_USER=sa
DB_PASSWORD=YourStrong@Passw0rd
DB_ENCRYPT=false
DB_TRUST_SERVER_CERTIFICATE=true
# Demo/offline mode is not supported.
```

## Troubleshooting

If connection still fails:

1. **Verify SQL Server is running**:
   ```powershell
   Get-Service MSSQL*
   ```

2. **Test connection from Windows**:
   ```powershell
   sqlcmd -S localhost,1433 -U sa -P YourStrong@Passw0rd -Q "SELECT @@VERSION"
   ```

3. **Check firewall**:
   ```powershell
   Get-NetFirewallRule | Where DisplayName -like "*SQL*"
   ```

4. **Verify TCP/IP is enabled**:
   - Check SQL Server Configuration Manager
   - Ensure TCP/IP shows as "Enabled"

## Next Steps
Once SQL Server is configured and accepting connections:
1. The application will automatically create the database schema
2. Demo data will be loaded
3. The site will be accessible via IIS without port numbers in the URL
