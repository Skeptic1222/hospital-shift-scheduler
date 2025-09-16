# Hospital Scheduler Installation Guide

## Overview
Complete setup instructions for the Hospital Scheduler system including IIS, SQL Server, and OAuth configuration.

## Prerequisites
- Windows Server with IIS installed
- SQL Server Express
- Node.js 18+
- Redis server

## Quick Start

### Prerequisites Installation
```bash
# Clone repository
git clone https://github.com/hospital/scheduler.git
cd scheduler

# Install dependencies
npm install
```

### Environment Setup
Copy `.env.example` to `.env` and configure all required variables.

### Database Setup
```bash
# Run migrations
npm run db:migrate

# Seed initial data (optional)
npm run db:seed
```

### Start Application
```bash
# Development
npm run dev

# Production
npm run build
npm start
```

### Access Application
- Development: http://localhost/scheduler
- Production: https://scheduler.hospital.com

## Detailed Setup Instructions

### IIS Configuration

#### 1. Install IISNode Module
```powershell
# Download and install IISNode
Invoke-WebRequest -Uri "https://github.com/Azure/iisnode/releases/download/v0.2.26/iisnode-full-v0.2.26-x64.msi" -OutFile "iisnode.msi"
msiexec /i iisnode.msi /quiet

# Install URL Rewrite Module
Invoke-WebRequest -Uri "https://download.microsoft.com/download/1/2/8/128E2E22-C1B9-44A4-BE2A-5859ED1D4592/rewrite_amd64_en-US.msi" -OutFile "urlrewrite.msi"
msiexec /i urlrewrite.msi /quiet
```

#### 2. Configure Application Pool
```powershell
# Create application pool
New-WebAppPool -Name "HospitalScheduler"
Set-ItemProperty -Path "IIS:\AppPools\HospitalScheduler" -Name processIdentity.identityType -Value ApplicationPoolIdentity
Set-ItemProperty -Path "IIS:\AppPools\HospitalScheduler" -Name recycling.periodicRestart.time -Value "00:00:00"
```

#### 3. Set Up URL Rewriting
Add to web.config:
```xml
<rewrite>
  <rules>
    <rule name="NodeJS" patternSyntax="ECMAScript" stopProcessing="true">
      <match url=".*" />
      <conditions>
        <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
      </conditions>
      <action type="Rewrite" url="server.js" />
    </rule>
  </rules>
</rewrite>
```

#### 4. Enable WebSocket Support
```powershell
Enable-WindowsOptionalFeature -Online -FeatureName IIS-WebSockets
```

### SQL Server Setup

#### 1. Create Database
```sql
CREATE DATABASE HospitalScheduler;
GO

USE HospitalScheduler;
GO
```

#### 2. Configure Authentication

**Option A: SQL Authentication**
```sql
-- Create login
CREATE LOGIN scheduler_app WITH PASSWORD = 'StrongPassword123!';

-- Create user
CREATE USER scheduler_app FOR LOGIN scheduler_app;

-- Grant permissions
ALTER ROLE db_owner ADD MEMBER scheduler_app;
```

**Option B: Windows Authentication**
```sql
-- Create login for app pool identity
CREATE LOGIN [IIS APPPOOL\HospitalScheduler] FROM WINDOWS;

-- Create user
CREATE USER [IIS APPPOOL\HospitalScheduler] FOR LOGIN [IIS APPPOOL\HospitalScheduler];

-- Grant permissions
ALTER ROLE db_owner ADD MEMBER [IIS APPPOOL\HospitalScheduler];
```

#### 3. Run Initial Schema
```bash
# Using migration tool
npm run db:migrate

# Or manually
sqlcmd -S .\SQLEXPRESS -d HospitalScheduler -i database-schema-sqlserver.sql
```

#### 4. Set Up Audit Tables
```sql
-- Create audit schema
CREATE SCHEMA Audit;
GO

-- Create audit log table
CREATE TABLE Audit.AuditLog (
    audit_id BIGINT IDENTITY(1,1) PRIMARY KEY,
    event_time DATETIME2 DEFAULT GETDATE(),
    user_id NVARCHAR(100),
    event_type NVARCHAR(50),
    resource_type NVARCHAR(50),
    resource_id NVARCHAR(100),
    details NVARCHAR(MAX),
    ip_address NVARCHAR(45),
    user_agent NVARCHAR(500)
);

-- Enable encryption
ALTER TABLE Audit.AuditLog
ADD phi_data VARBINARY(MAX);
```

### Google OAuth Configuration

#### 1. Create OAuth Credentials
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project or select existing
3. Enable Google+ API
4. Go to Credentials → Create Credentials → OAuth 2.0 Client ID
5. Application type: Web application
6. Name: Hospital Scheduler

#### 2. Configure Redirect URIs
Add these authorized redirect URIs:
- Development: `http://localhost/scheduler/auth/google/callback`
- Production: `https://scheduler.hospital.com/auth/google/callback`

#### 3. Set Environment Variables
```bash
# In .env file
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=http://localhost/scheduler/auth/google/callback
```

#### 4. Configure in Application
```javascript
// google-auth.js
const GoogleStrategy = require('passport-google-oauth20').Strategy;

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL
}, authCallback));
```

### Environment Configuration
```bash
# Auth0
AUTH0_DOMAIN=
AUTH0_CLIENT_ID=
AUTH0_CLIENT_SECRET=

# Database
DB_SERVER=localhost\SQLEXPRESS
DB_NAME=HospitalScheduler

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Security
JWT_SECRET=
ENCRYPTION_KEY=
```

### Running Migrations
```bash
npm run db:migrate
npm run db:seed # Optional
```

### Starting the Application
```bash
npm run build
npm start
```

## Security Configuration

### HIPAA Compliance
- Enable encryption at rest
- Configure audit logging
- Set up session timeout

### IIS Security
- Enable HTTPS
- Configure security headers
- Set up rate limiting

## Troubleshooting

### Common Issues
1. Database connection errors
2. OAuth configuration issues
3. IIS module loading failures

### Verification Steps
1. Check services status
2. Verify database connection
3. Test OAuth flow
4. Validate WebSocket connection