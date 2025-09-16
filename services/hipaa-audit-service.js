/**
 * Enhanced HIPAA Audit Service
 * Comprehensive audit logging with encryption and 7-year retention
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

class HIPAAAuditService {
  constructor(db, encryptionKey) {
    this.db = db;
    this.encryptionKey = encryptionKey || process.env.ENCRYPTION_KEY || 'CHANGE_THIS_IN_PRODUCTION';
    this.auditQueue = [];
    this.flushInterval = 5000; // Flush every 5 seconds
    this.retentionDays = 7 * 365; // 7 years for HIPAA
    
    // Start flush timer
    this.startFlushTimer();
    
    // Audit event types
    this.eventTypes = {
      // Authentication events
      LOGIN: 'AUTH_LOGIN',
      LOGOUT: 'AUTH_LOGOUT',
      LOGIN_FAILED: 'AUTH_LOGIN_FAILED',
      TOKEN_REFRESH: 'AUTH_TOKEN_REFRESH',
      PASSWORD_CHANGE: 'AUTH_PASSWORD_CHANGE',
      
      // PHI access events
      PHI_VIEW: 'PHI_VIEW',
      PHI_CREATE: 'PHI_CREATE',
      PHI_UPDATE: 'PHI_UPDATE',
      PHI_DELETE: 'PHI_DELETE',
      PHI_EXPORT: 'PHI_EXPORT',
      PHI_PRINT: 'PHI_PRINT',
      
      // Administrative events
      USER_CREATE: 'ADMIN_USER_CREATE',
      USER_UPDATE: 'ADMIN_USER_UPDATE',
      USER_DELETE: 'ADMIN_USER_DELETE',
      ROLE_CHANGE: 'ADMIN_ROLE_CHANGE',
      PERMISSION_CHANGE: 'ADMIN_PERMISSION_CHANGE',
      SETTING_CHANGE: 'ADMIN_SETTING_CHANGE',
      
      // System events
      SYSTEM_START: 'SYSTEM_START',
      SYSTEM_STOP: 'SYSTEM_STOP',
      BACKUP_CREATE: 'SYSTEM_BACKUP',
      BACKUP_RESTORE: 'SYSTEM_RESTORE',
      ERROR: 'SYSTEM_ERROR',
      
      // Break-glass events
      EMERGENCY_ACCESS: 'BREAK_GLASS_ACCESS',
      EMERGENCY_OVERRIDE: 'BREAK_GLASS_OVERRIDE'
    };
  }

  /**
   * Encrypt audit data
   */
  encrypt(text) {
    const algorithm = 'aes-256-gcm';
    const iv = crypto.randomBytes(16);
    const salt = crypto.randomBytes(64);
    const key = crypto.pbkdf2Sync(this.encryptionKey, salt, 10000, 32, 'sha256');
    
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  /**
   * Decrypt audit data
   */
  decrypt(encryptedData) {
    const algorithm = 'aes-256-gcm';
    const salt = Buffer.from(encryptedData.salt, 'hex');
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const authTag = Buffer.from(encryptedData.authTag, 'hex');
    const key = crypto.pbkdf2Sync(this.encryptionKey, salt, 10000, 32, 'sha256');
    
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Log audit event
   */
  async logEvent(eventType, userId, details = {}, req = null) {
    try {
      const auditEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        event_type: eventType,
        user_id: userId,
        user_email: details.user_email || (req?.user?.email),
        ip_address: req?.ip || req?.connection?.remoteAddress || 'unknown',
        user_agent: req?.headers?.['user-agent'] || 'unknown',
        session_id: req?.sessionID || details.session_id || null,
        
        // Event details
        entity_type: details.entity_type || null,
        entity_id: details.entity_id || null,
        action: details.action || null,
        result: details.result || 'success',
        
        // PHI tracking
        phi_accessed: details.phi_accessed || false,
        patient_id: details.patient_id || null,
        
        // Additional context
        department_id: details.department_id || null,
        shift_id: details.shift_id || null,
        
        // Change tracking
        old_value: details.old_value ? JSON.stringify(details.old_value) : null,
        new_value: details.new_value ? JSON.stringify(details.new_value) : null,
        
        // Security
        risk_score: this.calculateRiskScore(eventType, details),
        flagged: false
      };

      // Check for suspicious activity
      if (auditEntry.risk_score > 7) {
        auditEntry.flagged = true;
        await this.alertSecurity(auditEntry);
      }

      // Encrypt sensitive data
      if (auditEntry.old_value || auditEntry.new_value || details.phi_accessed) {
        const sensitiveData = JSON.stringify({
          old_value: auditEntry.old_value,
          new_value: auditEntry.new_value,
          patient_data: details.patient_data
        });
        
        const encrypted = this.encrypt(sensitiveData);
        auditEntry.encrypted_data = JSON.stringify(encrypted);
        
        // Remove unencrypted sensitive data
        delete auditEntry.old_value;
        delete auditEntry.new_value;
      }

      // Add to queue for batch processing
      this.auditQueue.push(auditEntry);

      // Immediate flush for critical events
      if (this.isCriticalEvent(eventType)) {
        await this.flushQueue();
      }

      return auditEntry.id;
    } catch (error) {
      console.error('Audit logging error:', error);
      // Never fail the main operation due to audit failure
      return null;
    }
  }

  /**
   * Calculate risk score for event
   */
  calculateRiskScore(eventType, details) {
    let score = 0;

    // High-risk events
    const highRiskEvents = [
      this.eventTypes.PHI_DELETE,
      this.eventTypes.PHI_EXPORT,
      this.eventTypes.USER_DELETE,
      this.eventTypes.EMERGENCY_ACCESS,
      this.eventTypes.EMERGENCY_OVERRIDE
    ];

    if (highRiskEvents.includes(eventType)) {
      score += 5;
    }

    // After hours access
    const hour = new Date().getHours();
    if (hour < 6 || hour > 22) {
      score += 2;
    }

    // Weekend access
    const day = new Date().getDay();
    if (day === 0 || day === 6) {
      score += 1;
    }

    // Multiple failed attempts
    if (eventType === this.eventTypes.LOGIN_FAILED && details.attempt_count > 3) {
      score += 3;
    }

    // Bulk operations
    if (details.bulk_operation) {
      score += 2;
    }

    // Cross-department access
    if (details.cross_department) {
      score += 1;
    }

    return Math.min(score, 10); // Cap at 10
  }

  /**
   * Check if event is critical
   */
  isCriticalEvent(eventType) {
    const criticalEvents = [
      this.eventTypes.PHI_DELETE,
      this.eventTypes.USER_DELETE,
      this.eventTypes.EMERGENCY_ACCESS,
      this.eventTypes.SYSTEM_ERROR,
      this.eventTypes.LOGIN_FAILED
    ];
    
    return criticalEvents.includes(eventType);
  }

  /**
   * Alert security team
   */
  async alertSecurity(auditEntry) {
    // In production, send email/SMS/Slack alert
    console.warn('🚨 SECURITY ALERT:', {
      event: auditEntry.event_type,
      user: auditEntry.user_email,
      risk_score: auditEntry.risk_score,
      timestamp: auditEntry.timestamp
    });
  }

  /**
   * Flush audit queue to database
   */
  async flushQueue() {
    if (this.auditQueue.length === 0) return;

    const entries = [...this.auditQueue];
    this.auditQueue = [];

    try {
      // Always write to DB in this build

      // Batch insert to database
      for (const entry of entries) {
        await this.db.query(`
          INSERT INTO scheduler.audit_logs (
            id, timestamp, event_type, user_id, user_email,
            ip_address, user_agent, session_id,
            entity_type, entity_id, action, result,
            phi_accessed, patient_id,
            department_id, shift_id,
            encrypted_data, risk_score, flagged
          ) VALUES (
            @id, @timestamp, @event_type, @user_id, @user_email,
            @ip_address, @user_agent, @session_id,
            @entity_type, @entity_id, @action, @result,
            @phi_accessed, @patient_id,
            @department_id, @shift_id,
            @encrypted_data, @risk_score, @flagged
          )
        `, entry);
      }
    } catch (error) {
      console.error('Failed to flush audit queue:', error);
      // Re-add to queue for retry
      this.auditQueue.unshift(...entries);
    }
  }

  /**
   * Start flush timer
   */
  startFlushTimer() {
    setInterval(() => {
      this.flushQueue();
    }, this.flushInterval);
  }

  /**
   * Query audit logs
   */
  async queryLogs(filters = {}) {
    try {
      let query = 'SELECT * FROM scheduler.audit_logs WHERE 1=1';
      const params = {};

      if (filters.start_date) {
        query += ' AND timestamp >= @start_date';
        params.start_date = filters.start_date;
      }

      if (filters.end_date) {
        query += ' AND timestamp <= @end_date';
        params.end_date = filters.end_date;
      }

      if (filters.user_id) {
        query += ' AND user_id = @user_id';
        params.user_id = filters.user_id;
      }

      if (filters.event_type) {
        query += ' AND event_type = @event_type';
        params.event_type = filters.event_type;
      }

      if (filters.entity_type) {
        query += ' AND entity_type = @entity_type';
        params.entity_type = filters.entity_type;
      }

      if (filters.entity_id) {
        query += ' AND entity_id = @entity_id';
        params.entity_id = filters.entity_id;
      }

      if (filters.phi_accessed !== undefined) {
        query += ' AND phi_accessed = @phi_accessed';
        params.phi_accessed = filters.phi_accessed;
      }

      if (filters.flagged !== undefined) {
        query += ' AND flagged = @flagged';
        params.flagged = filters.flagged;
      }

      query += ' ORDER BY timestamp DESC';

      if (filters.limit) {
        query += ' LIMIT @limit';
        params.limit = filters.limit;
      }

      const result = await this.db.query(query, params);
      
      // Decrypt sensitive data if needed
      const logs = result.recordset.map(log => {
        if (log.encrypted_data) {
          try {
            const decrypted = this.decrypt(JSON.parse(log.encrypted_data));
            log.decrypted_data = JSON.parse(decrypted);
          } catch (error) {
            log.decryption_error = true;
          }
        }
        return log;
      });

      return logs;
    } catch (error) {
      console.error('Failed to query audit logs:', error);
      return [];
    }
  }

  /**
   * Generate audit report
   */
  async generateReport(startDate, endDate, reportType = 'summary') {
    const logs = await this.queryLogs({
      start_date: startDate,
      end_date: endDate
    });

    const report = {
      period: { start: startDate, end: endDate },
      total_events: logs.length,
      unique_users: new Set(logs.map(l => l.user_id)).size,
      phi_access_count: logs.filter(l => l.phi_accessed).length,
      flagged_events: logs.filter(l => l.flagged).length,
      events_by_type: {},
      events_by_user: {},
      high_risk_events: logs.filter(l => l.risk_score > 7),
      failed_logins: logs.filter(l => l.event_type === this.eventTypes.LOGIN_FAILED)
    };

    // Count by event type
    logs.forEach(log => {
      report.events_by_type[log.event_type] = (report.events_by_type[log.event_type] || 0) + 1;
      report.events_by_user[log.user_email] = (report.events_by_user[log.user_email] || 0) + 1;
    });

    return report;
  }

  /**
   * Cleanup old audit logs (archive, don't delete)
   */
  async archiveOldLogs() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);

    try {
      // Move to archive table
      await this.db.query(`
        INSERT INTO scheduler.audit_logs_archive
        SELECT * FROM scheduler.audit_logs
        WHERE timestamp < @cutoff
      `, { cutoff: cutoffDate });

      // Remove from main table
      await this.db.query(`
        DELETE FROM scheduler.audit_logs
        WHERE timestamp < @cutoff
      `, { cutoff: cutoffDate });

      console.log(`Archived audit logs older than ${cutoffDate}`);
    } catch (error) {
      console.error('Failed to archive old logs:', error);
    }
  }

  /**
   * Express middleware for automatic audit logging
   */
  middleware() {
    return async (req, res, next) => {
      // Skip static assets and health checks
      if (req.path.includes('/static') || req.path === '/health') {
        return next();
      }

      // Log request start
      const startTime = Date.now();
      const requestId = crypto.randomUUID();
      req.auditRequestId = requestId;

      // Override res.json to capture responses
      const originalJson = res.json.bind(res);
      res.json = function(data) {
        // Log API response
        const duration = Date.now() - startTime;
        const eventType = res.statusCode >= 400 ? 'API_ERROR' : 'API_ACCESS';
        
        this.logEvent(eventType, req.user?.id || 'anonymous', {
          method: req.method,
          path: req.path,
          status_code: res.statusCode,
          duration_ms: duration,
          request_id: requestId
        }, req);

        return originalJson(data);
      }.bind(this);

      next();
    };
  }
}

// Export singleton
module.exports = HIPAAAuditService;
