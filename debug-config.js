// Maximum debugging configuration for shift creation issues
const fs = require('fs');
const path = require('path');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Enhanced logging configuration
const DEBUG_CONFIG = {
  // Enable all debug flags
  enabled: true,
  verbose: true,

  // Log levels
  logLevel: 'trace', // trace, debug, info, warn, error

  // Log all HTTP requests/responses
  logRequests: true,
  logResponses: true,
  logHeaders: true,
  logBody: true,

  // Database debugging
  logSQL: true,
  logConnectionPool: true,

  // Client-side error capture
  captureClientErrors: true,
  captureStackTraces: true,

  // Performance monitoring
  logPerformance: true,
  slowQueryThreshold: 100, // ms

  // File locations
  logFiles: {
    main: path.join(logsDir, `debug-main-${new Date().toISOString().split('T')[0]}.log`),
    sql: path.join(logsDir, `debug-sql-${new Date().toISOString().split('T')[0]}.log`),
    http: path.join(logsDir, `debug-http-${new Date().toISOString().split('T')[0]}.log`),
    client: path.join(logsDir, `debug-client-${new Date().toISOString().split('T')[0]}.log`),
    shift: path.join(logsDir, `debug-shift-${new Date().toISOString().split('T')[0]}.log`),
    iis: path.join(logsDir, `debug-iis-${new Date().toISOString().split('T')[0]}.log`)
  }
};

// Debug logger with multiple outputs
class DebugLogger {
  constructor(config = DEBUG_CONFIG) {
    this.config = config;
    this.streams = {};

    // Initialize file streams
    Object.entries(config.logFiles).forEach(([key, filepath]) => {
      this.streams[key] = fs.createWriteStream(filepath, { flags: 'a' });
    });
  }

  log(category, level, message, data = {}) {
    if (!this.config.enabled) return;

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      category,
      level,
      message,
      data,
      stack: level === 'error' ? new Error().stack : undefined
    };

    // Console output
    console.log(`[${timestamp}] [${category}] [${level}] ${message}`, data);

    // File output
    const stream = this.streams[category] || this.streams.main;
    stream.write(JSON.stringify(logEntry) + '\n');

    // Also write to main log
    if (category !== 'main') {
      this.streams.main.write(JSON.stringify(logEntry) + '\n');
    }
  }

  trace(category, message, data) {
    this.log(category, 'trace', message, data);
  }

  debug(category, message, data) {
    this.log(category, 'debug', message, data);
  }

  info(category, message, data) {
    this.log(category, 'info', message, data);
  }

  warn(category, message, data) {
    this.log(category, 'warn', message, data);
  }

  error(category, message, data) {
    this.log(category, 'error', message, data);
  }

  // SQL query logger
  logQuery(query, params, duration) {
    this.log('sql', 'debug', 'SQL Query', {
      query,
      params,
      duration,
      slow: duration > this.config.slowQueryThreshold
    });
  }

  // HTTP request logger
  logRequest(req) {
    this.log('http', 'info', `${req.method} ${req.url}`, {
      method: req.method,
      url: req.url,
      headers: this.config.logHeaders ? req.headers : undefined,
      body: this.config.logBody ? req.body : undefined,
      query: req.query,
      params: req.params,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
  }

  // HTTP response logger
  logResponse(res, body, duration) {
    this.log('http', 'info', `Response ${res.statusCode}`, {
      statusCode: res.statusCode,
      headers: this.config.logHeaders ? res.getHeaders() : undefined,
      body: this.config.logBody ? body : undefined,
      duration
    });
  }

  // Client error logger
  logClientError(error) {
    this.log('client', 'error', 'Client Error', {
      message: error.message,
      stack: error.stack,
      userAgent: error.userAgent,
      url: error.url,
      line: error.line,
      column: error.column
    });
  }

  // Shift-specific logger
  logShift(action, data) {
    this.log('shift', 'info', `Shift Action: ${action}`, data);
  }
}

// Create singleton instance
const debugLogger = new DebugLogger(DEBUG_CONFIG);

// Express middleware for request/response logging
function debugMiddleware(req, res, next) {
  const startTime = Date.now();

  // Log request
  debugLogger.logRequest(req);

  // Capture response
  const originalSend = res.send;
  res.send = function(body) {
    const duration = Date.now() - startTime;
    debugLogger.logResponse(res, body, duration);
    originalSend.call(this, body);
  };

  next();
}

// Database query wrapper
function wrapDatabaseQuery(db) {
  // Only wrap if not already wrapped
  if (db._debugWrapped) return db;

  const originalQuery = db.query.bind(db);
  db.query = async function(query, params) {
    const startTime = Date.now();
    try {
      const result = await originalQuery(query, params);
      const duration = Date.now() - startTime;
      debugLogger.logQuery(query, params, duration);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      debugLogger.logQuery(query, params, duration);
      debugLogger.error('sql', 'Query Error', { query, params, error: error.message });
      throw error;
    }
  };

  db._debugWrapped = true;
  return db;
}

module.exports = {
  DEBUG_CONFIG,
  debugLogger,
  debugMiddleware,
  wrapDatabaseQuery
};