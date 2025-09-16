# Hospital Scheduler Operations Guide

## Overview
Complete guide for deployment, monitoring, and maintenance of the Hospital Scheduler system in production.

## Deployment Process

### Pre-Deployment Checklist
- [ ] All tests passing
- [ ] Security scan completed
- [ ] Database migrations reviewed
- [ ] Environment variables configured
- [ ] SSL certificates valid
- [ ] Backup procedures verified

### Build Process
```bash
# Install dependencies
npm ci --production

# Build React frontend
npm run build

# Verify build
npm run build:verify
```

### IIS Deployment
```powershell
# Run deployment script (requires Administrator)
.\deploy.ps1 -Environment production `
  -SqlServer ".\SQLEXPRESS" `
  -IISAppName "HospitalScheduler" `
  -Port 3001
```

### Database Deployment
```bash
# Run migrations
npm run db:migrate:production

# Verify migration
npm run db:verify

# Create initial admin user
npm run db:create-admin
```

## Monitoring

### Application Health
```bash
# Check application status
curl https://scheduler.hospital.com/api/health

# Expected response
{
  "status": "healthy",
  "database": "connected",
  "cache": "connected",
  "uptime": 86400
}
```

### Performance Metrics
Monitor these key metrics:
- Response time < 200ms (p95)
- Error rate < 0.1%
- Database connection pool usage < 80%
- Memory usage < 2GB
- CPU usage < 70%

### Log Monitoring
```powershell
# View application logs
Get-Content C:\inetpub\logs\LogFiles\W3SVC1\u_ex*.log -Tail 100

# View error logs
Get-EventLog -LogName Application -Source "Hospital Scheduler" -Newest 20

# View HIPAA audit logs
SELECT * FROM AuditLog WHERE event_time > DATEADD(hour, -1, GETDATE())
```

### Real-time Monitoring Dashboard
Access monitoring at: https://scheduler.hospital.com/admin/monitoring

Key metrics displayed:
- Active users
- Shift fill rate
- Queue length
- Response times
- Error counts

## Maintenance Tasks

### Daily Tasks
```bash
# Verify backups completed
npm run maintenance:verify-backups

# Check error logs
npm run maintenance:check-errors

# Review security events
npm run maintenance:security-review
```

### Weekly Tasks
```bash
# Database optimization
npm run maintenance:optimize-db

# Clear old logs
npm run maintenance:clean-logs

# Review performance metrics
npm run maintenance:performance-report
```

### Monthly Tasks
```bash
# Security patches
npm audit fix

# Certificate renewal check
npm run maintenance:check-certs

# Capacity planning review
npm run maintenance:capacity-report
```

## Backup and Recovery

### Automated Backups
```sql
-- Daily database backup
BACKUP DATABASE HospitalScheduler
TO DISK = 'C:\Backups\HospitalScheduler_' +
  CONVERT(VARCHAR(10), GETDATE(), 112) + '.bak'
WITH COMPRESSION, CHECKSUM;
```

### Manual Backup
```powershell
# Full application backup
.\backup.ps1 -Type Full -Destination "\\backup-server\hospital"

# Database only
.\backup.ps1 -Type Database -Destination "\\backup-server\hospital"

# Configuration only
.\backup.ps1 -Type Config -Destination "\\backup-server\hospital"
```

### Recovery Procedures
```powershell
# Restore from backup
.\restore.ps1 -BackupFile "\\backup-server\hospital\backup-20240115.zip"

# Database recovery
RESTORE DATABASE HospitalScheduler
FROM DISK = 'C:\Backups\HospitalScheduler_20240115.bak'
WITH REPLACE;
```

## Performance Tuning

### Database Optimization
```sql
-- Update statistics
UPDATE STATISTICS Shifts WITH FULLSCAN;
UPDATE STATISTICS Staff WITH FULLSCAN;

-- Rebuild indexes
ALTER INDEX ALL ON Shifts REBUILD;
ALTER INDEX ALL ON ShiftAssignments REBUILD;

-- Clear old audit logs (keep 7 years per HIPAA)
DELETE FROM AuditLog
WHERE event_time < DATEADD(year, -7, GETDATE());
```

### Application Optimization
```javascript
// Increase connection pool
{
  "database": {
    "pool": {
      "min": 5,
      "max": 20
    }
  }
}

// Optimize Redis cache
{
  "redis": {
    "maxmemory": "2gb",
    "maxmemory-policy": "allkeys-lru"
  }
}
```

### IIS Optimization
```xml
<!-- web.config optimizations -->
<system.webServer>
  <urlCompression doStaticCompression="true" doDynamicCompression="true" />
  <caching>
    <profiles>
      <add extension=".js" policy="CacheUntilChange" kernelCachePolicy="CacheUntilChange" />
      <add extension=".css" policy="CacheUntilChange" kernelCachePolicy="CacheUntilChange" />
    </profiles>
  </caching>
</system.webServer>
```

## Security Operations

### SSL Certificate Management
```powershell
# Check certificate expiration
Get-ChildItem -Path Cert:\LocalMachine\My |
  Where-Object {$_.Subject -like "*scheduler.hospital.com*"} |
  Select-Object Subject, NotAfter

# Renew certificate
.\renew-certificate.ps1 -Domain "scheduler.hospital.com"
```

### Security Scanning
```bash
# Run security audit
npm run security:audit

# OWASP dependency check
npm run security:owasp

# Penetration testing
npm run security:pentest
```

### Access Control Review
```sql
-- Review admin users
SELECT username, last_login, failed_attempts
FROM Users
WHERE role = 'ADMIN'
ORDER BY last_login DESC;

-- Check for inactive accounts
SELECT username, last_login
FROM Users
WHERE last_login < DATEADD(day, -90, GETDATE());
```

## Disaster Recovery

### RTO and RPO Targets
- Recovery Time Objective (RTO): 4 hours
- Recovery Point Objective (RPO): 1 hour

### Failover Procedures
```powershell
# Initiate failover to DR site
.\failover.ps1 -Target "dr-scheduler.hospital.com" -Confirm

# Verify failover
Test-Connection -ComputerName "dr-scheduler.hospital.com" -Port 443

# Update DNS
.\update-dns.ps1 -Primary "dr-scheduler.hospital.com"
```

### Business Continuity
1. Notify stakeholders
2. Activate DR site
3. Restore from latest backup
4. Verify data integrity
5. Resume operations
6. Document incident

## Troubleshooting

### Common Issues

#### High Memory Usage
```powershell
# Recycle application pool
Restart-WebAppPool -Name "HospitalScheduler"

# Clear Redis cache
redis-cli FLUSHDB
```

#### Database Connection Errors
```sql
-- Check connection count
SELECT COUNT(*) FROM sys.dm_exec_connections;

-- Kill idle connections
DECLARE @sql NVARCHAR(MAX) = '';
SELECT @sql = @sql + 'KILL ' + CAST(session_id AS VARCHAR) + ';'
FROM sys.dm_exec_sessions
WHERE database_id = DB_ID('HospitalScheduler')
  AND status = 'sleeping'
  AND last_request_end_time < DATEADD(hour, -1, GETDATE());
EXEC(@sql);
```

#### Performance Degradation
```bash
# Check slow queries
npm run db:slow-queries

# Analyze execution plans
npm run db:analyze-plans

# Review cache hit rate
npm run cache:stats
```

## Compliance Monitoring

### HIPAA Audit Requirements
```sql
-- Daily audit report
SELECT
  event_type,
  COUNT(*) as event_count,
  MIN(event_time) as first_occurrence,
  MAX(event_time) as last_occurrence
FROM AuditLog
WHERE event_time > DATEADD(day, -1, GETDATE())
GROUP BY event_type
ORDER BY event_count DESC;
```

### Access Review
```bash
# Generate access report
npm run compliance:access-report

# PHI access audit
npm run compliance:phi-audit

# Failed login attempts
npm run compliance:failed-logins
```

## Capacity Planning

### Metrics to Track
- User growth rate
- Shift volume trends
- Storage consumption
- Bandwidth usage
- Peak concurrent users

### Scaling Triggers
- CPU > 80% sustained
- Memory > 90% utilized
- Response time > 500ms p95
- Queue depth > 100
- Error rate > 1%

### Scaling Actions
```powershell
# Vertical scaling
.\scale-vertical.ps1 -CPU 8 -Memory 16GB

# Horizontal scaling
.\add-web-server.ps1 -Server "WEB02" -LoadBalancer "LB01"

# Database scaling
.\scale-database.ps1 -Type "ReadReplica" -Server "SQL02"
```

## Communication Procedures

### Incident Response
1. Detect issue (monitoring alert)
2. Assess severity (P1-P4)
3. Notify on-call team
4. Begin mitigation
5. Update status page
6. Resolve issue
7. Post-mortem review

### Maintenance Windows
- Scheduled: Sunday 2-6 AM EST
- Emergency: As needed with 1-hour notice
- Notification: Email, SMS, Status page

### Contact Information
- On-call: (555) 123-4567
- Escalation: (555) 123-4568
- Email: scheduler-ops@hospital.com
- Status: https://status.hospital.com