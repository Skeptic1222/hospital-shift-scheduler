/**
 * HIPAA-compliant audit logging module
 * Tracks all PHI access and modifications per HIPAA requirements
 */

const winston = require('winston');
const crypto = require('crypto');
const path = require('path');

class HIPAAAuditLogger {
    constructor(options = {}) {
        this.db = options.db;
        this.repositories = options.repositories;
        
        // Configure Winston for file-based audit logs (7-year retention)
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            transports: [
                new winston.transports.File({
                    filename: path.join(options.logDir || './logs', 'hipaa-audit.log'),
                    maxsize: 10485760, // 10MB
                    maxFiles: 100,
                    tailable: true
                }),
                new winston.transports.File({
                    filename: path.join(options.logDir || './logs', 'hipaa-error.log'),
                    level: 'error'
                })
            ]
        });

        // Add console transport in development
        if (process.env.NODE_ENV !== 'production') {
            this.logger.add(new winston.transports.Console({
                format: winston.format.simple()
            }));
        }
    }

    /**
     * Generate unique audit ID
     */
    generateAuditId() {
        return crypto.randomBytes(16).toString('hex');
    }

    /**
     * Hash sensitive data for logging
     */
    hashPHI(data) {
        if (!data) return null;
        return crypto.createHash('sha256').update(String(data)).digest('hex').substring(0, 8);
    }

    /**
     * Log PHI access event
     */
    async logAccess(req, resource, action, details = {}) {
        const auditEntry = {
            audit_id: this.generateAuditId(),
            timestamp: new Date().toISOString(),
            user_id: req.user?.id || null,
            user_email: req.user?.email,
            user_role: req.user?.roles?.[0] || 'unknown',
            ip_address: req.ip,
            user_agent: req.headers['user-agent'],
            method: req.method,
            endpoint: req.path,
            action,
            resource_type: resource.type,
            resource_id: resource.id,
            patient_id_hash: this.hashPHI(details.patient_id),
            success: details.success !== false,
            error_message: details.error || null,
            additional_data: this.sanitizeDetails(details)
        };

        // Log to file
        this.logger.info('PHI_ACCESS', auditEntry);

        // Log to database if available
        if (this.db?.connected && this.repositories?.auditLog) {
            try {
                await this.repositories.auditLog.create({
                    action: `PHI_${action}`,
                    user_id: auditEntry.user_id,
                    resource_type: auditEntry.resource_type,
                    resource_id: auditEntry.resource_id,
                    ip_address: auditEntry.ip_address,
                    user_agent: auditEntry.user_agent,
                    additional_data: JSON.stringify(auditEntry)
                });
            } catch (dbError) {
                this.logger.error('DB_AUDIT_FAILED', { error: dbError.message, auditEntry });
            }
        }

        return auditEntry.audit_id;
    }

    /**
     * Log authentication events
     */
    async logAuth(req, action, success, details = {}) {
        const auditEntry = {
            audit_id: this.generateAuditId(),
            timestamp: new Date().toISOString(),
            action: `AUTH_${action}`,
            user_email: details.email || req.body?.email,
            ip_address: req.ip,
            user_agent: req.headers['user-agent'],
            success,
            failure_reason: details.reason || null,
            mfa_used: details.mfa || false
        };

        this.logger.info('AUTHENTICATION', auditEntry);

        if (this.db?.connected && this.repositories?.auditLog) {
            try {
                await this.repositories.auditLog.create({
                    action: auditEntry.action,
                    user_id: details.user_id || null,
                    ip_address: auditEntry.ip_address,
                    user_agent: auditEntry.user_agent,
                    additional_data: JSON.stringify(auditEntry)
                });
            } catch (dbError) {
                this.logger.error('DB_AUTH_AUDIT_FAILED', { error: dbError.message });
            }
        }
    }

    /**
     * Log data modifications
     */
    async logModification(req, resource, action, oldData, newData) {
        const changes = this.detectChanges(oldData, newData);
        
        const auditEntry = {
            audit_id: this.generateAuditId(),
            timestamp: new Date().toISOString(),
            user_id: req.user?.id || null,
            user_email: req.user?.email,
            action: `MODIFY_${action}`,
            resource_type: resource.type,
            resource_id: resource.id,
            changes: changes.map(c => ({
                field: c.field,
                old_value_hash: this.hashPHI(c.oldValue),
                new_value_hash: this.hashPHI(c.newValue)
            })),
            ip_address: req.ip
        };

        this.logger.info('DATA_MODIFICATION', auditEntry);

        if (this.db?.connected && this.repositories?.auditLog) {
            try {
                await this.repositories.auditLog.create({
                    action: auditEntry.action,
                    user_id: auditEntry.user_id,
                    resource_type: auditEntry.resource_type,
                    resource_id: auditEntry.resource_id,
                    changes: JSON.stringify(auditEntry.changes),
                    ip_address: auditEntry.ip_address,
                    additional_data: JSON.stringify(auditEntry)
                });
            } catch (dbError) {
                this.logger.error('DB_MODIFICATION_AUDIT_FAILED', { error: dbError.message });
            }
        }
    }

    /**
     * Log security events
     */
    async logSecurityEvent(req, eventType, details) {
        const auditEntry = {
            audit_id: this.generateAuditId(),
            timestamp: new Date().toISOString(),
            event_type: `SECURITY_${eventType}`,
            user_id: req.user?.id || null,
            ip_address: req.ip,
            user_agent: req.headers['user-agent'],
            details: this.sanitizeDetails(details),
            severity: details.severity || 'medium'
        };

        this.logger.warn('SECURITY_EVENT', auditEntry);

        // Security events always go to DB if available
        if (this.db?.connected && this.repositories?.auditLog) {
            try {
                await this.repositories.auditLog.create({
                    action: auditEntry.event_type,
                    user_id: auditEntry.user_id,
                    ip_address: auditEntry.ip_address,
                    severity: auditEntry.severity,
                    additional_data: JSON.stringify(auditEntry)
                });
            } catch (dbError) {
                this.logger.error('DB_SECURITY_AUDIT_FAILED', { error: dbError.message });
            }
        }
    }

    /**
     * Detect changes between old and new data
     */
    detectChanges(oldData, newData) {
        const changes = [];
        const allKeys = new Set([
            ...Object.keys(oldData || {}),
            ...Object.keys(newData || {})
        ]);

        for (const key of allKeys) {
            if (oldData?.[key] !== newData?.[key]) {
                changes.push({
                    field: key,
                    oldValue: oldData?.[key],
                    newValue: newData?.[key]
                });
            }
        }

        return changes;
    }

    /**
     * Sanitize details to remove actual PHI
     */
    sanitizeDetails(details) {
        const sanitized = {};
        const phiFields = ['ssn', 'dob', 'patient_name', 'medical_record', 'diagnosis'];
        
        for (const [key, value] of Object.entries(details)) {
            if (phiFields.some(field => key.toLowerCase().includes(field))) {
                sanitized[key] = this.hashPHI(value);
            } else {
                sanitized[key] = value;
            }
        }
        
        return sanitized;
    }

    /**
     * Express middleware for automatic audit logging
     */
    middleware() {
        return async (req, res, next) => {
            // Store original send function
            const originalSend = res.send;
            const startTime = Date.now();

            // Override send to capture response
            res.send = function(data) {
                res.locals.responseData = data;
                res.locals.responseTime = Date.now() - startTime;
                originalSend.call(this, data);
            };

            // Log request on completion
            res.on('finish', async () => {
                // Skip non-PHI endpoints
                const phiEndpoints = ['/api/shifts', '/api/staff', '/api/users', '/api/queue'];
                const isPHIEndpoint = phiEndpoints.some(endpoint => req.path.startsWith(endpoint));

                if (isPHIEndpoint && req.method !== 'OPTIONS') {
                    const resource = {
                        type: req.path.split('/')[2] || 'unknown',
                        id: req.params.id || req.body?.id || null
                    };

                    await this.logAccess(req, resource, req.method, {
                        success: res.statusCode < 400,
                        status_code: res.statusCode,
                        response_time: res.locals.responseTime
                    });
                }
            });

            next();
        };
    }

    /**
     * Generate compliance report
     */
    async generateComplianceReport(startDate, endDate) {
        const report = {
            period: { start: startDate, end: endDate },
            generated_at: new Date().toISOString(),
            summary: {
                total_accesses: 0,
                unique_users: new Set(),
                failed_attempts: 0,
                modifications: 0,
                security_events: 0
            },
            details: []
        };

        // Query audit logs from database
        if (this.db?.connected) {
            const logs = await this.db.query(`
                SELECT * FROM scheduler.audit_logs 
                WHERE created_at BETWEEN @start AND @end
                ORDER BY created_at DESC
            `, { start: startDate, end: endDate });

            for (const log of logs.recordset || []) {
                report.summary.total_accesses++;
                report.summary.unique_users.add(log.user_id);
                
                if (log.action.startsWith('MODIFY_')) {
                    report.summary.modifications++;
                }
                if (log.action.startsWith('SECURITY_')) {
                    report.summary.security_events++;
                }
                
                report.details.push({
                    timestamp: log.created_at,
                    user: log.user_id,
                    action: log.action,
                    resource: `${log.resource_type}:${log.resource_id}`
                });
            }
        }

        report.summary.unique_users = report.summary.unique_users.size;
        return report;
    }
}

module.exports = HIPAAAuditLogger;
