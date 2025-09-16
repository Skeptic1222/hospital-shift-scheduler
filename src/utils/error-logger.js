/**
 * Centralized error logging utility
 * Provides consistent error handling and logging across the application
 */

class ErrorLogger {
    constructor() {
        this.isDevelopment = process.env.NODE_ENV === 'development';
        this.isDemo = false;
    }

    /**
     * Log error with context
     * @param {Error} error - The error object
     * @param {string} context - Where the error occurred
     * @param {object} metadata - Additional metadata
     */
    log(error, context = 'Unknown', metadata = {}) {
        const timestamp = new Date().toISOString();
        const errorInfo = {
            timestamp,
            context,
            message: error?.message || 'Unknown error',
            stack: this.isDevelopment ? error?.stack : undefined,
            metadata: this.sanitizeMetadata(metadata)
        };

        // In production, log to monitoring service
        if (!this.isDevelopment && !this.isDemo) {
            this.sendToMonitoring(errorInfo);
        }

        // Always log to console with appropriate level
        if (error?.critical || context.includes('SECURITY')) {
            console.error('[CRITICAL ERROR]', JSON.stringify(errorInfo));
        } else {
            console.error(`[ERROR - ${context}]`, errorInfo.message);
            if (this.isDevelopment) {
                console.error('Details:', errorInfo);
            }
        }

        return errorInfo;
    }

    /**
     * Log warning with context
     */
    warn(message, context = 'Unknown', metadata = {}) {
        const timestamp = new Date().toISOString();
        const warnInfo = {
            timestamp,
            context,
            message,
            metadata: this.sanitizeMetadata(metadata)
        };

        console.warn(`[WARN - ${context}]`, message);
        if (this.isDevelopment) {
            console.warn('Details:', warnInfo);
        }

        return warnInfo;
    }

    /**
     * Sanitize metadata to prevent sensitive data leakage
     */
    sanitizeMetadata(metadata) {
        const sensitive = ['password', 'token', 'secret', 'key', 'auth', 'credential'];
        const sanitized = {};

        for (const [key, value] of Object.entries(metadata)) {
            const lowerKey = key.toLowerCase();
            if (sensitive.some(s => lowerKey.includes(s))) {
                sanitized[key] = '[REDACTED]';
            } else if (typeof value === 'object' && value !== null) {
                sanitized[key] = this.sanitizeMetadata(value);
            } else {
                sanitized[key] = value;
            }
        }

        return sanitized;
    }

    /**
     * Send error to monitoring service (placeholder for APM integration)
     */
    sendToMonitoring(errorInfo) {
        // TODO: Integrate with Sentry, DataDog, or other APM service
        // For now, could write to audit log or send to logging endpoint
        try {
            // Placeholder for monitoring integration
            if (process.env.MONITORING_ENDPOINT) {
                // fetch(process.env.MONITORING_ENDPOINT, { ... })
            }
        } catch (monitoringError) {
            // Fail silently to avoid cascading errors
            console.error('Failed to send to monitoring:', monitoringError.message);
        }
    }

    /**
     * Create a context-specific logger
     */
    createContextLogger(context) {
        return {
            log: (error, metadata) => this.log(error, context, metadata),
            warn: (message, metadata) => this.warn(message, context, metadata)
        };
    }
}

// Singleton instance
const errorLogger = new ErrorLogger();

// Convenience functions
const logError = (error, context, metadata) => errorLogger.log(error, context, metadata);
const logWarn = (message, context, metadata) => errorLogger.warn(message, context, metadata);
const createLogger = (context) => errorLogger.createContextLogger(context);

module.exports = {
    errorLogger,
    logError,
    logWarn,
    createLogger
};
