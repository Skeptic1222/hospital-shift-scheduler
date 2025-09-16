# Hospital Shift Scheduler - Site Architecture & Setup

## Current Working Configuration

### Access URLs
- **From Windows**: `http://localhost/scheduler`
- **From WSL/Playwright**: `http://192.168.1.2/scheduler` (use Windows IP, not WSL IP)
- **Important**: NO PORT NUMBERS in URLs - IIS runs on port 80

### Architecture Overview

```
Windows Host (192.168.1.2)
├── IIS (Port 80)
│   ├── /scheduler → C:\inetpub\wwwroot\scheduler
│   │   ├── build/ (React static files)
│   │   └── web.config (URL rewriting rules)
│   └── Reverse Proxy → Node backend for /api routes
│
├── Node.js Backend (Port 3001)
│   ├── Express server (server.js)
│   ├── API endpoints (/api/*)
│   └── WebSocket support (Socket.io)
│
└── SQL Server Express
    ├── Instance: localhost\SQLEXPRESS
    └── Database: HospitalScheduler

WSL2 Environment (172.17.51.100)
├── Development tools
├── Playwright for testing
└── nginx (Port 80) - NOT USED for this app
```

### Key Configuration Files

#### 1. `.env` - Environment Variables
```env
# Database
DB_SERVER=localhost\SQLEXPRESS
DB_NAME=HospitalScheduler
DB_USER=sa
DB_PASSWORD=YourStrong@Passw0rd

# React App - NO PORTS!
REACT_APP_PUBLIC_BASE=http://localhost/scheduler

# Server
PORT=3001
NODE_ENV=production

# No Demo Mode
This system does not support a demo/offline mode. Do not add SKIP_EXTERNALS or similar toggles.
```

#### 2. `web.config` - IIS Configuration
- Proxies `/api/*` requests to Node.js on port 3001
- Serves React build files for all other routes
- Handles WebSocket connections

#### 3. `src/utils/api.js` - Frontend API Configuration
```javascript
// Correctly configured to use /scheduler base path
let API_BASE = process.env.REACT_APP_PUBLIC_BASE || '/scheduler';
```

## Building & Deployment

### Build React App (Windows)
```powershell
cd C:\inetpub\wwwroot\scheduler
npm install react-scripts
$env:CI='false'
npm run build
```

### Start Node.js Backend
```powershell
# Windows
cd C:\inetpub\wwwroot\scheduler
node server.js

# Demo mode is not supported
node server.js
```

## Fixed Issues

### 1. Button Text Overflow
- **File**: `src/components/QuickActions.jsx`
- **Fix**: Changed "Request Time Off" to "Time Off"
- **Applied**: Responsive font sizing

### 2. User Creation Not Saving
- **File**: `src/pages/Admin.jsx`
- **Issue**: Frontend sent `name`, backend expected `first_name` and `last_name`
- **Fix**: Updated form fields to match API requirements

### 3. Demo/Live Mode Toggle
- **File**: `src/pages/Admin.jsx`
- **Added**: Visible mode indicator chip
- **Added**: Toggle switch in settings

### 4. Save Settings Button
- **File**: `src/pages/Admin.jsx`
- **Added**: Save button with change detection
- **Shows**: Success message on save

### 5. Delete User Functionality
- **File**: `src/pages/Admin.jsx`
- **Added**: Delete buttons for each user
- **Added**: Confirmation dialog

## Current Issues to Fix

### 1. SQL Server Connection
- **Error**: `Failed to connect to localhost\SQLEXPRESS`
- **Need**: Start SQL Server Express service
- **Check**: Windows Services → SQL Server (SQLEXPRESS)

### 2. User Creation API
- **Error**: 404 on `/api/admin/users`
- **Issue**: Route might not be implemented in server.js
- **Check**: `routes/admin.js` or implement in server.js

### 3. CORS Issues
- **Error**: API calls failing from frontend
- **Issue**: Frontend uses `localhost`, API expects same origin
- **Fix**: Update CORS settings in server.js

## Testing with Playwright

### From WSL
```javascript
// Use Windows IP, not localhost
await page.goto('http://192.168.1.2/scheduler');

// Login as admin
await page.click('text=Login as Admin');

// Navigate to admin
await page.click('button[aria-label="User menu"]');
await page.click('text=Admin');
```

## Database Setup Commands

### SQL Server Express (Windows)
```sql
-- Create database
CREATE DATABASE HospitalScheduler;
GO

-- Create login
CREATE LOGIN [scheduler_user] WITH PASSWORD = 'YourStrong@Passw0rd';
GO

-- Use database
USE HospitalScheduler;
GO

-- Create user
CREATE USER [scheduler_user] FOR LOGIN [scheduler_user];
GO

-- Grant permissions
ALTER ROLE db_owner ADD MEMBER [scheduler_user];
GO

-- Run schema script
sqlcmd -S localhost\SQLEXPRESS -d HospitalScheduler -i database-schema-sqlserver.sql
```

## Quick Troubleshooting

### Site not loading?
1. Check IIS is running: `iisreset` in PowerShell as Admin
2. Check Node.js backend: use your process manager or reverse proxy logs
3. Check Windows IP: `ipconfig | findstr IPv4`

### API calls failing?
1. Check Node.js server logs
2. Verify CORS settings allow origin
3. Demo mode disabled

### Database connection failing?
1. Start SQL Server service
2. Check SQL Server Configuration Manager
3. Enable TCP/IP protocol
4. Verify connection string in .env

## Important Notes

- **Never** add port numbers to production URLs
- **Always** build React app in Windows, not WSL
- **Use** Windows IP when testing from WSL/Playwright
- **Check** both IIS and Node.js logs for errors
- **Remember** IIS proxies /api/* to Node.js on port 3001
