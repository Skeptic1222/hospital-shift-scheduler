// ⚠️ CRITICAL WARNING: NEVER ADD DEMO MODE TO THIS APPLICATION
// The client has explicitly forbidden ANY form of demo, mock, or test mode.
// This application REQUIRES a live database connection to function.
// DO NOT add any demo mode, mock data, or bypass mechanisms.

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { body, param, query } = require('express-validator');
const http = require('http');
const path = require('path');
require('dotenv').config();
const createApiRouters = require('./routes');

// Import logging configuration
const { logger, loggingMiddleware, errorLoggingMiddleware } = require('./logger-config');

// Import enhanced debugging
const { debugLogger, debugMiddleware, wrapDatabaseQuery } = require('./debug-config');

// Import services
const { db, repositories } = require('./db-config');
const googleAuth = require('./google-auth');
const RedisCacheService = require('./redis-cache');
const FCFSScheduler = require('./fcfs-algorithm');
const RealtimeNotificationSystem = require('./realtime-notifications');
const HIPAAAuditLogger = require('./hipaa-audit');

// Import security middleware
const secretsManager = require('./utils/secrets-manager');

// Validate environment on startup
if (process.env.NODE_ENV === 'production') {
    const { errors, warnings } = secretsManager.validateEnvironment();
    if (errors.length > 0) {
        console.error('🔴 Critical security errors detected:');
        errors.forEach(e => console.error(`  - ${e}`));
        console.error('\n⚠️  Refusing to start in production with security issues');
        console.error('Run: node utils/secrets-manager.js to generate secure secrets');
        process.exit(1);
    }
    if (warnings.length > 0) {
        console.warn('⚠️  Security warnings:');
        warnings.forEach(w => console.warn(`  - ${w}`));
    }
}

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize services
// Google Authentication is the primary auth method - no initialization needed

// Wrap database with debug logging
if (db) {
    wrapDatabaseQuery(db);
    debugLogger.info('main', 'Database debug logging enabled');
}

// Initialize cache service
const cacheService = new RedisCacheService({
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT || 6379),
        password: process.env.REDIS_PASSWORD,
        db: 0
    },
    encryptionKey: process.env.ENCRYPTION_KEY
});

// Initialize FCFS scheduler
const fcfsScheduler = new FCFSScheduler(db, cacheService);

// Initialize notification system (skip background workers in tests)
const notificationSystem = (process.env.NODE_ENV === 'test')
  ? { sendShiftNotification: async () => {}, sendNotification: async () => {} }
  : new RealtimeNotificationSystem(server, {
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT || 6379),
        password: process.env.REDIS_PASSWORD
    },
    email: {
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        secure: true,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD
        }
    },
    sms: {
        accountSid: process.env.TWILIO_ACCOUNT_SID,
        authToken: process.env.TWILIO_AUTH_TOKEN,
        fromNumber: process.env.TWILIO_PHONE_NUMBER
    },
    push: {
        vapidPublicKey: process.env.VAPID_PUBLIC_KEY,
        vapidPrivateKey: process.env.VAPID_PRIVATE_KEY,
        subject: 'mailto:admin@hospital.com'
    },
    allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost,https://localhost')
        .split(',')
        .map(s => s.trim())
});

// Initialize HIPAA audit logger
const auditLogger = new HIPAAAuditLogger(db);

// Trust proxy (IIS/ARR)
app.set('trust proxy', process.env.TRUST_PROXY || 1);

// Apply security middleware (centralized in middleware/security.js)
try {
    const { securityHeaders } = require('./middleware/security');
    app.use(securityHeaders);
} catch (_) {
    // Fallback minimal helmet if module unavailable
    app.use(helmet());
}

// Apply compression
app.use(compression());

// Apply logging middleware
app.use(loggingMiddleware);

// Parse JSON bodies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Add enhanced debug middleware
app.use(debugMiddleware);
debugLogger.info('main', 'Debug middleware enabled');

// CORS middleware
try {
    const { corsMiddleware } = require('./middleware/cors');
    app.use(corsMiddleware);
} catch (_) {
    const { buildCorsOptions } = require('./middleware/cors');
    app.use(cors(buildCorsOptions()));
}

// Rate limiting (centralized policies)
try {
    const { rateLimiters } = require('./middleware/security');
    app.use('/api', rateLimiters.standard);
    app.use('/api/shifts/create', rateLimiters.shifts);
    app.use('/api/auth', rateLimiters.auth);
} catch (_) {
    const standardLimiter = rateLimit({ windowMs: 60 * 1000, max: 100 });
    app.use('/api', standardLimiter);
}

// Structured request logging
try {
    const requestLogger = require('./src/middleware/request-logger');
    app.use(requestLogger);
} catch (_) {}

// Health route served under /api/health by routes/health

// Database health endpoint
app.get('/api/db/health', async (req, res) => {
    try {
        const result = await db.healthCheck();
        const status = result.healthy ? 200 : 503;
        res.status(status).json(result);
    } catch (e) {
        res.status(503).json({ healthy: false, error: e.message });
    }
});

// API Routes
const deps = { googleAuth, repositories, db, cacheService, notificationSystem, fcfsScheduler };
deps.body = body;
deps.param = param;
deps.query = query;
deps.validate = require('./middleware/validation');
try {
    const ensureUserFactory = require('./middleware/ensure-user-roles');
    deps.ensureUserAndRoles = ensureUserFactory({ db, repositories });
} catch (_) {}
deps.auditLogger = auditLogger;

// Create and mount API routers under /api
app.use('/api', createApiRouters(deps));

// API endpoints served by routes/*

// Socket.io for real-time updates
let ioCorsOptions = undefined;
try { ioCorsOptions = require('./middleware/cors').buildCorsOptions(); } catch (_) { ioCorsOptions = { origin: false }; }
const io = require('socket.io')(server, {
    cors: ioCorsOptions,
    path: '/api/socket.io'
});

// Socket authentication
io.use(async (socket, next) => {
    try {
        const token = socket.handshake.auth.token;
        const user = await googleAuth.verifyToken(token);
        socket.user = user;
        next();
    } catch (err) {
        next(new Error('Authentication failed'));
    }
});

io.on('connection', (socket) => {
    console.log('User connected:', socket.user.email);
    
    // Join user to their personal room
    socket.join(`user:${socket.user.id}`);
    
    // Join department rooms based on user's department (enrich if missing)
    (async () => {
        try {
            if (!socket.user.department_id && socket.user.email && db?.connected) {
                const rs = await db.query('SELECT TOP 1 department_id, id FROM scheduler.users WHERE email=@e', { e: socket.user.email });
                const row = rs.recordset && rs.recordset[0];
                if (row) {
                    if (!socket.user.id && row.id) socket.user.id = row.id;
                    if (row.department_id) {
                        socket.user.department_id = row.department_id;
                        socket.join(`dept:${row.department_id}`);
                    }
                }
            } else if (socket.user.department_id) {
                socket.join(`dept:${socket.user.department_id}`);
            }
        } catch (_) { /* ignore */ }
    })();
    
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.user.email);
    });
});

// Make io available to other modules
app.set('io', io);

// Static files (React build) served under /scheduler
app.use('/scheduler', express.static(path.join(__dirname, 'build')));

// Serve React app for all non-API routes under /scheduler
app.get(['/scheduler', '/scheduler/*'], (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Error handling with logging
app.use(errorLoggingMiddleware);

// Start server
const PORT = process.env.PORT || 3001;

// Initialize database connection and start server (skips listen during tests)
if (process.env.NODE_ENV !== 'test') {
    (async () => {
        try {
            await db.connect();
            console.log('Database connected');
            
            server.listen(PORT, () => {
                console.log(`Server running on port ${PORT}`);
                console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
                console.log(`API available at http://localhost:${PORT}/api`);
            });
        } catch (error) {
            console.error('Failed to start server:', error);
            process.exit(1);
        }
    })();
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('Server closed');
    });
    
    if (db) await db.close();
    if (cacheService.client) await cacheService.client.quit();
    
    process.exit(0);
});

// Global error handlers to capture unexpected issues into logs
try {
  const { logger } = require('./logger-config');
  process.on('unhandledRejection', (reason, promise) => {
    try { logger.error('Unhandled promise rejection', { reason: reason?.message || String(reason), stack: reason?.stack }); } catch (_) {}
  });
  process.on('uncaughtException', (err) => {
    try { logger.error('Uncaught exception', { error: err?.message, stack: err?.stack }); } catch (_) {}
  });
} catch (_) { /* ignore */ }

module.exports = app;
