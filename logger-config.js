/**
 * Centralized Logging Configuration
 * Logs all activity and errors to files in the logs/ directory
 * 
 * Log Files:
 * - logs/app-YYYY-MM-DD.log - General application logs
 * - logs/error-YYYY-MM-DD.log - Error logs only
 * - logs/audit-YYYY-MM-DD.log - HIPAA audit trail
 * - logs/performance-YYYY-MM-DD.log - Performance metrics
 * - logs/access-YYYY-MM-DD.log - HTTP access logs
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');
require('winston-daily-rotate-file');

// Ensure logs directory exists
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom log format with detailed context
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.metadata({ fillExcept: ['message', 'level', 'timestamp'] }),
  winston.format.printf(({ timestamp, level, message, metadata, stack }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    // Add metadata if present
    if (metadata && Object.keys(metadata).length > 0) {
      // Include useful context
      const context = {
        userId: metadata.userId,
        requestId: metadata.requestId,
        method: metadata.method,
        url: metadata.url,
        ip: metadata.ip,
        userAgent: metadata.userAgent,
        responseTime: metadata.responseTime,
        statusCode: metadata.statusCode,
        errorCode: metadata.errorCode,
        module: metadata.module,
        function: metadata.function,
        ...metadata
      };
      
      // Remove undefined values
      Object.keys(context).forEach(key => 
        context[key] === undefined && delete context[key]
      );
      
      if (Object.keys(context).length > 0) {
        log += ` | Context: ${JSON.stringify(context)}`;
      }
    }
    
    // Add stack trace for errors
    if (stack) {
      log += `\nStack Trace:\n${stack}`;
    }
    
    return log;
  })
);

// Create transport for general application logs
const appLogTransport = new winston.transports.DailyRotateFile({
  filename: path.join(logsDir, 'app-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '30d',
  format: logFormat
});

// Create transport for error logs
const errorLogTransport = new winston.transports.DailyRotateFile({
  filename: path.join(logsDir, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '90d', // Keep error logs longer
  level: 'error',
  format: logFormat
});

// Create transport for audit logs (HIPAA compliance)
const auditLogTransport = new winston.transports.DailyRotateFile({
  filename: path.join(logsDir, 'audit-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '50m',
  maxFiles: '2555d', // 7 years for HIPAA
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.json() // JSON format for audit logs
  )
});

// Create transport for performance logs
const performanceLogTransport = new winston.transports.DailyRotateFile({
  filename: path.join(logsDir, 'performance-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '10m',
  maxFiles: '7d',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.json()
  )
});

// Create transport for access logs
const accessLogTransport = new winston.transports.DailyRotateFile({
  filename: path.join(logsDir, 'access-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '50m',
  maxFiles: '30d',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.printf(({ timestamp, message }) => `${timestamp} ${message}`)
  )
});

// Main application logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  transports: [
    appLogTransport,
    errorLogTransport
  ]
});

// Audit logger for HIPAA compliance
const auditLogger = winston.createLogger({
  transports: [auditLogTransport]
});

// Performance logger
const performanceLogger = winston.createLogger({
  transports: [performanceLogTransport]
});

// Access logger
const accessLogger = winston.createLogger({
  transports: [accessLogTransport]
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Helper functions for structured logging
const loggers = {
  // General application logging
  info: (message, metadata = {}) => {
    logger.info(message, metadata);
  },
  
  warn: (message, metadata = {}) => {
    logger.warn(message, metadata);
  },
  
  error: (message, error = null, metadata = {}) => {
    const errorMeta = {
      ...metadata,
      errorMessage: error?.message,
      errorCode: error?.code,
      errorStack: error?.stack
    };
    logger.error(message, errorMeta);
  },
  
  debug: (message, metadata = {}) => {
    logger.debug(message, metadata);
  },
  
  // Audit logging for HIPAA
  audit: (action, details) => {
    auditLogger.info({
      timestamp: new Date().toISOString(),
      action,
      ...details
    });
  },
  
  // Performance metrics logging
  performance: (metric, value, metadata = {}) => {
    performanceLogger.info({
      timestamp: new Date().toISOString(),
      metric,
      value,
      ...metadata
    });
  },
  
  // HTTP access logging
  access: (req, res, responseTime) => {
    const message = `${req.method} ${req.originalUrl} ${res.statusCode} ${responseTime}ms - ${req.ip} - "${req.get('user-agent')}"`;
    accessLogger.info(message);
  },
  
  // Database query logging
  database: (query, duration, error = null) => {
    const metadata = {
      query: query.substring(0, 500), // Truncate long queries
      duration,
      success: !error,
      error: error?.message
    };
    
    if (error) {
      logger.error('Database query failed', metadata);
    } else if (duration > 1000) {
      logger.warn('Slow database query', metadata);
    } else {
      logger.debug('Database query executed', metadata);
    }
  },
  
  // API request logging
  apiRequest: (method, endpoint, statusCode, duration, error = null) => {
    const metadata = {
      method,
      endpoint,
      statusCode,
      duration,
      error: error?.message
    };
    
    if (error || statusCode >= 500) {
      logger.error('API request failed', metadata);
    } else if (statusCode >= 400) {
      logger.warn('API request client error', metadata);
    } else {
      logger.info('API request completed', metadata);
    }
  },
  
  // Authentication events
  auth: (event, userId, success, metadata = {}) => {
    const logData = {
      event,
      userId,
      success,
      ...metadata
    };
    
    logger.info(`Authentication event: ${event}`, logData);
    auditLogger.info(logData); // Also log to audit trail
  },
  
  // System events
  system: (event, details = {}) => {
    logger.info(`System event: ${event}`, details);
  },
  
  // Get recent logs for monitoring
  getRecentLogs: async (type = 'app', lines = 100) => {
    const logFile = path.join(logsDir, `${type}-${new Date().toISOString().split('T')[0]}.log`);
    
    try {
      if (!fs.existsSync(logFile)) {
        return [];
      }
      
      const content = fs.readFileSync(logFile, 'utf8');
      const logLines = content.split('\n').filter(line => line.trim());
      return logLines.slice(-lines);
    } catch (error) {
      logger.error('Failed to read log file', error);
      return [];
    }
  },
  
  // Get error summary for monitoring
  getErrorSummary: async (hours = 24) => {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const errors = [];
    
    try {
      const errorLog = path.join(logsDir, `error-${new Date().toISOString().split('T')[0]}.log`);
      
      if (fs.existsSync(errorLog)) {
        const content = fs.readFileSync(errorLog, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());
        
        lines.forEach(line => {
          try {
            if (line.includes('[ERROR]')) {
              const timestamp = line.match(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/)?.[0];
              if (timestamp && new Date(timestamp) > since) {
                errors.push(line);
              }
            }
          } catch (e) {
            // Skip malformed lines
          }
        });
      }
      
      return {
        count: errors.length,
        errors: errors.slice(-50), // Last 50 errors
        since: since.toISOString()
      };
    } catch (error) {
      logger.error('Failed to get error summary', error);
      return { count: 0, errors: [], since: since.toISOString() };
    }
  },
  
  // Clean old logs (except audit logs)
  cleanOldLogs: async (daysToKeep = 30) => {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
    
    try {
      const files = fs.readdirSync(logsDir);
      let deletedCount = 0;
      
      for (const file of files) {
        // Never delete audit logs (HIPAA requirement)
        if (file.startsWith('audit-')) continue;
        
        const filePath = path.join(logsDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime < cutoffDate) {
          fs.unlinkSync(filePath);
          deletedCount++;
        }
      }
      
      logger.info(`Cleaned ${deletedCount} old log files`);
      return deletedCount;
    } catch (error) {
      logger.error('Failed to clean old logs', error);
      return 0;
    }
  }
};

// Create middleware for Express
const loggingMiddleware = (req, res, next) => {
  const startTime = Date.now();
  
  // Add request ID for tracking
  req.id = req.headers['x-request-id'] || require('crypto').randomBytes(16).toString('hex');
  
  // Log request
  loggers.info('Incoming request', {
    requestId: req.id,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    userId: req.user?.id
  });
  
  // Capture response
  const originalSend = res.send;
  res.send = function(data) {
    const responseTime = Date.now() - startTime;
    
    // Log response
    loggers.access(req, res, responseTime);
    
    // Log performance metrics
    if (responseTime > 1000) {
      loggers.warn('Slow response', {
        requestId: req.id,
        method: req.method,
        url: req.originalUrl,
        responseTime,
        statusCode: res.statusCode
      });
    }
    
    loggers.performance('http_request_duration', responseTime, {
      method: req.method,
      endpoint: req.route?.path || req.originalUrl,
      statusCode: res.statusCode
    });
    
    return originalSend.call(this, data);
  };
  
  next();
};

// Error logging middleware
const errorLoggingMiddleware = (err, req, res, next) => {
  loggers.error('Unhandled error in request', err, {
    requestId: req.id,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userId: req.user?.id
  });
  
  // Send error response
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message,
    requestId: req.id
  });
};

// Export logger and middleware
module.exports = {
  logger: loggers,
  loggingMiddleware,
  errorLoggingMiddleware,
  
  // Utility to check log health
  checkLogHealth: async () => {
    const health = {
      logsDirectory: logsDir,
      writable: false,
      files: [],
      totalSize: 0,
      oldestLog: null,
      newestLog: null,
      errorCount24h: 0
    };
    
    try {
      // Check if logs directory is writable
      fs.accessSync(logsDir, fs.constants.W_OK);
      health.writable = true;
      
      // Get log files info
      const files = fs.readdirSync(logsDir);
      health.files = files;
      
      let oldestTime = Date.now();
      let newestTime = 0;
      
      files.forEach(file => {
        const filePath = path.join(logsDir, file);
        const stats = fs.statSync(filePath);
        health.totalSize += stats.size;
        
        if (stats.mtime.getTime() < oldestTime) {
          oldestTime = stats.mtime.getTime();
          health.oldestLog = file;
        }
        
        if (stats.mtime.getTime() > newestTime) {
          newestTime = stats.mtime.getTime();
          health.newestLog = file;
        }
      });
      
      // Get error count
      const errorSummary = await loggers.getErrorSummary(24);
      health.errorCount24h = errorSummary.count;
      
      health.totalSizeMB = (health.totalSize / 1024 / 1024).toFixed(2);
      
    } catch (error) {
      health.error = error.message;
    }
    
    return health;
  }
};

// Log system startup
loggers.system('Logger initialized', {
  logsDirectory: logsDir,
  logLevel: process.env.LOG_LEVEL || 'info',
  environment: process.env.NODE_ENV
});