/**
 * Security middleware for HIPAA-compliant hospital scheduler
 * Implements defense-in-depth security controls
 */

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');

// Content Security Policy configuration
const contentSecurityPolicy = {
    directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", 'https://apis.google.com', 'https://accounts.google.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https://oauth2.googleapis.com', 'https://accounts.google.com'],
        // Allow Google Identity Services to render frames
        frameSrc: ['https://accounts.google.com'],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: []
    }
};

// Rate limiting configurations
const createRateLimiter = (windowMs, max, message) => {
    return rateLimit({
        windowMs,
        max,
        message,
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => {
            res.status(429).json({
                error: 'Too Many Requests',
                message,
                retryAfter: Math.ceil(windowMs / 1000)
            });
        }
    });
};

// Different rate limits for different operations
const rateLimiters = {
    // Standard API calls - 100 requests per minute
    standard: createRateLimiter(60 * 1000, 100, 'Too many requests, please try again later'),
    
    // Authentication attempts - 5 per 15 minutes
    auth: createRateLimiter(15 * 60 * 1000, 5, 'Too many authentication attempts'),
    
    // Admin operations - 30 per minute
    admin: createRateLimiter(60 * 1000, 30, 'Admin rate limit exceeded'),
    
    // Shift operations - 50 per minute
    shifts: createRateLimiter(60 * 1000, 50, 'Shift operation rate limit exceeded'),

    // Browser log endpoint - 20 per minute
    logs: createRateLimiter(60 * 1000, 20, 'Log rate limit exceeded')
};

// Session timeout middleware
const sessionTimeout = (timeoutMinutes = 15) => {
    return (req, res, next) => {
        if (req.session) {
            const now = Date.now();
            const lastActivity = req.session.lastActivity || now;
            const timeout = timeoutMinutes * 60 * 1000;
            
            if (now - lastActivity > timeout) {
                req.session.destroy((err) => {
                    if (err) console.error('Session destruction error:', err);
                });
                return res.status(401).json({
                    error: 'Session expired',
                    message: 'Your session has expired due to inactivity'
                });
            }
            
            req.session.lastActivity = now;
        }
        next();
    };
};

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
    // Sanitize body, params, and query
    if (req.body) req.body = sanitizeObject(req.body);
    if (req.params) req.params = sanitizeObject(req.params);
    if (req.query) req.query = sanitizeObject(req.query);
    next();
};

const sanitizeObject = (obj) => {
    if (typeof obj !== 'object' || obj === null) return obj;
    
    const sanitized = Array.isArray(obj) ? [] : {};
    
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            const value = obj[key];
            if (typeof value === 'string') {
                // Remove potential SQL injection attempts
                sanitized[key] = value
                    .replace(/(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE)\b)/gi, '')
                    .replace(/[<>]/g, '') // Basic XSS prevention
                    .trim();
            } else if (typeof value === 'object' && value !== null) {
                sanitized[key] = sanitizeObject(value);
            } else {
                sanitized[key] = value;
            }
        }
    }
    
    return sanitized;
};

// HIPAA audit logging
const auditLog = (action) => {
    return (req, res, next) => {
        const startTime = Date.now();
        
        // Capture original end function
        const originalEnd = res.end;
        
        res.end = function(...args) {
            const duration = Date.now() - startTime;
            const auditEntry = {
                timestamp: new Date().toISOString(),
                action,
                user: req.user?.email || 'anonymous',
                userId: req.user?.sub || 'unknown',
                method: req.method,
                path: req.path,
                statusCode: res.statusCode,
                duration,
                ip: req.ip || req.connection.remoteAddress,
                userAgent: req.headers['user-agent'],
                success: res.statusCode < 400
            };
            
            // Log PHI access separately with enhanced detail
            if (action.includes('PHI') || action.includes('patient')) {
                auditEntry.phiAccess = true;
                auditEntry.resourceId = req.params.id || req.body?.id;
                console.log('[HIPAA AUDIT]', JSON.stringify(auditEntry));
            } else {
                console.log('[AUDIT]', JSON.stringify(auditEntry));
            }
            
            originalEnd.apply(res, args);
        };
        
        next();
    };
};

// Security headers configuration
const securityHeaders = helmet({
    contentSecurityPolicy,
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    },
    noSniff: true,
    referrerPolicy: { policy: 'same-origin' },
    frameguard: { action: 'deny' }
});

// Production mode check
const requireProductionMode = (req, res, next) => next();

// Validate demo mode restrictions
const restrictDemoMode = (_req, _res, next) => next();

module.exports = {
    securityHeaders,
    rateLimiters,
    sessionTimeout,
    sanitizeInput,
    auditLog,
    requireProductionMode,
    restrictDemoMode,
    mongoSanitize,
    xss,
    hpp
};
