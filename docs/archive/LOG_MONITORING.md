# 📊 Hospital Scheduler - Log Monitoring Guide

## 📁 Log File Locations

All logs are stored in the `logs/` directory within the project folder:
```
/mnt/c/inetpub/wwwroot/scheduler/logs/
```

### Log Files Generated

| Log Type | Filename Pattern | Purpose | Retention |
|----------|-----------------|---------|-----------|
| **Application** | `app-YYYY-MM-DD.log` | General application activity | 30 days |
| **Errors** | `error-YYYY-MM-DD.log` | Error tracking and debugging | 90 days |
| **Audit Trail** | `audit-YYYY-MM-DD.log` | HIPAA compliance audit | 7 years |
| **Performance** | `performance-YYYY-MM-DD.log` | Response times and metrics | 7 days |
| **Access** | `access-YYYY-MM-DD.log` | HTTP request logs | 30 days |

## 🔍 How to Check Logs

### Quick Commands

```bash
# View today's application log
tail -f logs/app-$(date +%Y-%m-%d).log

# View today's errors
tail -f logs/error-$(date +%Y-%m-%d).log

# Search for specific user activity
grep "userId: demo-admin" logs/audit-*.log

# View last 50 errors
tail -n 50 logs/error-$(date +%Y-%m-%d).log

# Monitor real-time activity
tail -f logs/app-$(date +%Y-%m-%d).log | grep -E "(ERROR|WARN)"
```

### Windows PowerShell Commands

```powershell
# View today's application log
Get-Content "logs\app-$(Get-Date -Format yyyy-MM-dd).log" -Tail 50

# Monitor errors in real-time
Get-Content "logs\error-$(Get-Date -Format yyyy-MM-dd).log" -Wait

# Search for authentication failures
Select-String -Path "logs\audit-*.log" -Pattern "AUTH_FAILURE"

# Count errors by type
Select-String -Path "logs\error-*.log" -Pattern "\[ERROR\]" | Group-Object Line | Sort-Object Count -Descending
```

## 🚨 Common Error Patterns

### Database Connection Errors
```
[ERROR]: Database query failed | Context: {"query":"SELECT...","error":"Connection timeout"}
```
**Fix**: Check SQL Server is running, verify connection string in `.env`

### Authentication Failures
```
[ERROR]: Authentication failed | Context: {"userId":null,"event":"LOGIN_FAILED"}
```
**Fix**: Verify Google OAuth credentials, check network connectivity

### Redis Connection Issues
```
[ERROR]: Redis connection failed | Context: {"error":"ECONNREFUSED"}
```
**Fix**: Start Redis service, verify REDIS_HOST and REDIS_PORT in `.env`

### Permission Denied
```
[ERROR]: Permission denied | Context: {"userId":"demo-nurse-001","resource":"/api/admin"}
```
**Fix**: Check user roles in database, verify RBAC configuration

### Slow Query Warning
```
[WARN]: Slow database query | Context: {"query":"SELECT...","duration":1523}
```
**Fix**: Add database indexes, optimize query, check SQL Server performance

## 📈 Log Analysis Tools

### Built-in Health Check
```javascript
// Access via API endpoint
GET /api/logs/health

// Returns:
{
  "logsDirectory": "/mnt/c/inetpub/wwwroot/scheduler/logs",
  "writable": true,
  "totalSizeMB": "45.2",
  "errorCount24h": 12,
  "oldestLog": "audit-2024-01-01.log",
  "newestLog": "app-2024-11-10.log"
}
```

### Error Summary Endpoint
```javascript
// Get last 24 hours of errors
GET /api/logs/errors?hours=24

// Returns:
{
  "count": 15,
  "errors": [
    "2024-11-10 14:23:45 [ERROR]: Database connection failed...",
    "2024-11-10 13:15:22 [ERROR]: Authentication timeout..."
  ],
  "since": "2024-11-09T14:00:00Z"
}
```

### Performance Metrics
```javascript
// Get performance statistics
GET /api/logs/performance

// Returns:
{
  "avgResponseTime": 145,
  "p95ResponseTime": 523,
  "slowestEndpoints": [
    { "endpoint": "/api/shifts", "avgTime": 892 },
    { "endpoint": "/api/reports", "avgTime": 654 }
  ]
}
```

## 🛠️ Troubleshooting Workflow

### Step 1: Identify the Problem
```bash
# Check if errors are occurring
tail -n 100 logs/error-$(date +%Y-%m-%d).log | grep -c "ERROR"

# Find error patterns
grep "ERROR" logs/error-$(date +%Y-%m-%d).log | cut -d'|' -f1 | sort | uniq -c
```

### Step 2: Gather Context
```bash
# Get full error details with context
grep -B2 -A2 "ERROR_ID" logs/error-$(date +%Y-%m-%d).log

# Check related access logs
grep "REQUEST_ID" logs/access-$(date +%Y-%m-%d).log
```

### Step 3: Check System Health
```bash
# Database connectivity
grep "Database" logs/app-$(date +%Y-%m-%d).log | tail -20

# Redis status
grep "Redis" logs/app-$(date +%Y-%m-%d).log | tail -20

# Authentication issues
grep "AUTH" logs/audit-$(date +%Y-%m-%d).log | tail -20
```

### Step 4: Verify Fixes
```bash
# After applying fix, monitor for recurrence
tail -f logs/error-$(date +%Y-%m-%d).log | grep "SPECIFIC_ERROR"

# Check if error rate decreased
watch -n 5 'grep -c "ERROR" logs/error-$(date +%Y-%m-%d).log'
```

## 📊 Log Rotation and Maintenance

### Automatic Rotation
- Logs rotate daily at midnight
- Old logs are automatically compressed after 7 days
- Audit logs are NEVER deleted (HIPAA requirement)

### Manual Cleanup
```bash
# Clean logs older than 30 days (except audit)
find logs/ -name "*.log" -not -name "audit-*" -mtime +30 -delete

# Compress old logs
gzip logs/*-2024-10-*.log

# Check disk usage
du -sh logs/
```

### Windows Scheduled Task
The IIS configuration script creates a scheduled task that runs daily at 3 AM:
- Cleans logs older than 30 days
- Compresses logs older than 7 days
- Never touches audit logs

## 🔐 Security Considerations

### Sensitive Data
- PHI is never logged in plain text
- Passwords are always masked
- API keys are redacted in logs
- User sessions show only IDs

### Log Access
- Logs directory should have restricted permissions
- Only administrators should access audit logs
- Use log aggregation tools for team access
- Never share logs via email

## 📱 Real-time Monitoring

### Using Socket.io Console
```javascript
// Connect to WebSocket for real-time logs
const socket = io('/admin');
socket.on('log:error', (data) => {
  console.error('Real-time error:', data);
});
```

### Setting Up Alerts
```bash
# Create alert script
cat > monitor-errors.sh << 'EOF'
#!/bin/bash
ERROR_COUNT=$(grep -c "ERROR" logs/error-$(date +%Y-%m-%d).log)
if [ $ERROR_COUNT -gt 100 ]; then
  echo "High error rate detected: $ERROR_COUNT errors today"
  # Send alert (email, SMS, etc.)
fi
EOF

# Add to crontab (every 15 minutes)
*/15 * * * * /path/to/monitor-errors.sh
```

## 🎯 Key Performance Indicators

Monitor these metrics daily:
1. **Error Rate**: Should be < 1% of requests
2. **Response Time**: P95 should be < 500ms
3. **Database Queries**: Should be < 100ms
4. **Authentication Success**: Should be > 99%
5. **API Availability**: Should be > 99.9%

## 📚 Log Message Format

### Standard Format
```
TIMESTAMP [LEVEL]: Message | Context: {JSON}
```

### Example Messages
```
2024-11-10 14:23:45.123 [INFO]: User login successful | Context: {"userId":"demo-admin","ip":"192.168.1.1"}
2024-11-10 14:24:01.456 [ERROR]: Database connection failed | Context: {"error":"ETIMEDOUT","query":"SELECT * FROM shifts"}
2024-11-10 14:24:15.789 [WARN]: Slow API response | Context: {"endpoint":"/api/shifts","responseTime":1234}
```

## 🆘 Emergency Procedures

### System Down
1. Check error logs: `tail -100 logs/error-$(date +%Y-%m-%d).log`
2. Verify services: `Get-Service HospitalSchedulerAPI`
3. Check IIS: `iisreset /status`
4. Restart if needed: `nssm restart HospitalSchedulerAPI`

### High Error Rate
1. Identify pattern: `grep "ERROR" logs/error-*.log | head -50`
2. Check resources: CPU, Memory, Disk
3. Scale if needed: Increase worker processes
4. Apply hotfix: Deploy emergency patch

### Data Corruption
1. Stop service immediately: `nssm stop HospitalSchedulerAPI`
2. Check audit logs for cause
3. Restore from backup if needed
4. Document incident for compliance

## 📧 Support Contacts

For critical issues with logging:
1. Check this documentation first
2. Review recent changes in git log
3. Contact system administrator
4. Escalate to development team if needed

## 🔄 Regular Maintenance Tasks

### Daily
- [ ] Check error count
- [ ] Verify disk space
- [ ] Review authentication failures

### Weekly
- [ ] Analyze performance trends
- [ ] Review audit logs for anomalies
- [ ] Test log rotation

### Monthly
- [ ] Archive old logs
- [ ] Update monitoring thresholds
- [ ] Review and update this documentation