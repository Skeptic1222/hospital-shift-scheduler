
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const http = require('http');
const path = require('path');
require('dotenv').config();

// Import services
const { db, repositories } = require('./db-config');
const googleAuth = require('./google-auth');
const RedisCacheService = require('./redis-cache');
const FCFSScheduler = require('./fcfs-algorithm');
const RealtimeNotificationSystem = require('./realtime-notifications');
const demo = require('./demo-data');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize services
// Auth0 removed

// Behind IIS/ARR, trust the first proxy (safer than 'true')
// Can be overridden with TRUST_PROXY env (e.g., 'loopback')
app.set('trust proxy', process.env.TRUST_PROXY || 1);

// Request ID + basic structured logging
try {
    const requestLogger = require('./src/middleware/request-logger');
    app.use(requestLogger);
} catch (_) {}

const cacheService = new RedisCacheService({
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD
    },
    encryptionKey: process.env.ENCRYPTION_KEY
});

const notificationSystem = new RealtimeNotificationSystem(server, {
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379
    },
    email: {
        host: process.env.EMAIL_HOST,
        port: process.env.EMAIL_PORT,
        user: process.env.EMAIL_USER,
        password: process.env.EMAIL_PASSWORD,
        from: process.env.EMAIL_FROM || 'noreply@hospital-scheduler.com'
    },
    sms: {
        accountSid: process.env.TWILIO_ACCOUNT_SID,
        authToken: process.env.TWILIO_AUTH_TOKEN,
        fromNumber: process.env.TWILIO_PHONE_NUMBER
    },
    push: {
        subject: 'mailto:admin@hospital-scheduler.com',
        publicKey: process.env.VAPID_PUBLIC_KEY,
        privateKey: process.env.VAPID_PRIVATE_KEY
    },
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    auth0: {
        domain: process.env.AUTH0_DOMAIN,
        audience: process.env.AUTH0_AUDIENCE
    },
    rolePermissions: {
        admin: ['all'],
        manager: ['view_all', 'edit_schedules', 'approve_shifts', 'view_reports', 'view_metrics', 'view_shifts'],
        nurse: ['view_own', 'request_shifts', 'swap_shifts', 'view_shifts'],
        viewer: ['view_only']
    },
    encryptionKey: process.env.ENCRYPTION_KEY
});

const fcfsScheduler = new FCFSScheduler(db, cacheService.client, notificationSystem);

// -----------------------------------------------------
// PWA Icon helper endpoint (avoids 404s for manifest icons)
// Serves a tiny transparent PNG for requested sizes
// -----------------------------------------------------
const TRANSPARENT_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAOojR8kAAAAASUVORK5CYII=';
app.get('/api/assets/icon', (req, res) => {
    try {
        const size = parseInt(req.query.size, 10) || 192;
        res.setHeader('Content-Type', 'image/png');
        // Single-pixel PNG is acceptable for placeholder; browsers will scale it
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.end(Buffer.from(TRANSPARENT_PNG_BASE64, 'base64'));
    } catch (e) {
        res.status(500).end();
    }
});

// Middleware
// Ensure Google user is upserted in DB and attach DB role -> req.user.roles
async function ensureUserAndRoles(req, res, next) {
    try {
        if (process.env.SKIP_EXTERNALS === 'true') return next();
        if (!req.user || !req.user.email) return next();

        const email = req.user.email;
        const name = req.user.name || '';
        const [first_name, ...rest] = name.split(' ').filter(Boolean);
        const last_name = rest.join(' ') || (first_name ? '' : email.split('@')[0]);
        const employee_id = (req.user.sub || email).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 50) || email;

        // Find by email
        const existing = await db.query('SELECT TOP 1 * FROM scheduler.users WHERE email=@email', { email });
        let userRow = existing.recordset && existing.recordset[0];
        if (!userRow) {
            userRow = await repositories.users.create({
                employee_id,
                email,
                first_name: first_name || email.split('@')[0],
                last_name,
                is_active: 1,
                last_login: new Date()
            });
        } else {
            try { await repositories.users.update(userRow.id, { last_login: new Date() }); } catch (_) {}
        }

        // Attach DB role name if any
        if (userRow?.role_id) {
            const rr = await db.query('SELECT name FROM scheduler.roles WHERE id=@id', { id: userRow.role_id });
            const dbRole = rr.recordset && rr.recordset[0] && rr.recordset[0].name;
            if (dbRole) {
                req.user.roles = Array.from(new Set([...(req.user.roles || []), dbRole]));
            }
        }
    } catch (e) {
        // Non-fatal in request lifecycle
    } finally {
        next();
    }
}

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "wss:", "https:"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
}));

app.use(compression());
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    message: 'Too many requests, please try again later.'
});

const strictLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 10, // 10 requests per minute for sensitive operations
    message: 'Rate limit exceeded for this operation.'
});

app.use('/api/', limiter);
app.use('/api/auth/', strictLimiter);

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'build')));
}

// Health check endpoint
app.get('/api/health', async (req, res) => {
    try {
        if (process.env.SKIP_EXTERNALS === 'true') {
            return res.json({
                status: 'degraded',
                timestamp: new Date().toISOString(),
                services: {
                    database: { healthy: false, skipped: true },
                    cache: { connected: false, skipped: true },
                    notifications: { connected: true }
                }
            });
        }
        const dbHealth = await db.healthCheck();
        const cacheConnected = cacheService.client.status === 'ready';
        res.json({
            status: dbHealth.healthy && cacheConnected ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString(),
            services: { database: dbHealth, cache: { connected: cacheConnected }, notifications: { connected: true } }
        });
    } catch (err) {
        res.status(500).json({ status: 'unhealthy', error: err.message });
    }
});
// =====================================================
// AUTHENTICATION ENDPOINTS
// =====================================================

app.post('/api/auth/login', (req, res) => res.status(501).json({ error: 'Not Implemented' }));

app.post('/api/auth/refresh', googleAuth.authenticate(), async (req, res) => {
    try {
        // Refresh token logic
        res.json({ message: 'Token refreshed' });
    } catch (error) {
        res.status(401).json({ error: 'Token refresh failed' });
    }
});

app.post('/api/auth/logout', googleAuth.authenticate(), async (req, res) => {
    try {
        const userId = req.user.sub;
        await cacheService.del('session', { userId });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Logout failed' });
    }
});

// =====================================================
// SHIFT MANAGEMENT ENDPOINTS
// =====================================================

app.get('/api/shifts', googleAuth.authenticate(), async (req, res) => {
    try {
        if (process.env.SKIP_EXTERNALS === 'true') {
            demo.ensureSeeded();
            const date = req.query.date || new Date().toISOString().slice(0,10);
            const dept = req.query.department_id;
            const list = demo.listShifts({ date, department_id: dept });
            return res.json({ shifts: list, pagination: { page: 1, limit: list.length, total: list.length } });
        }
        const { date, department_id, status, assigned_to, page = 1, limit = 50 } = req.query;
        
        // Build filters
        const filters = {};
        if (date) filters.shift_date = date;
        if (department_id) filters.department_id = department_id;
        if (status) filters.status = status;
        
        // Get shifts from database
        const shifts = await repositories.shifts.findAll(filters, {
            orderBy: 'shift_date DESC, start_datetime ASC',
            limit: parseInt(limit),
            offset: (parseInt(page) - 1) * parseInt(limit)
        });
        
        // Get total count
        const total = await repositories.shifts.count(filters);
        
        res.json({
            shifts,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total
            }
        });
    } catch (error) {
        console.error('Get shifts error:', error);
        res.status(500).json({ error: 'Failed to retrieve shifts' });
    }
});

app.post('/api/shifts', googleAuth.authenticate(), ensureUserAndRoles, googleAuth.authorize(['admin','supervisor']), async (req, res) => {
    try {
        if (process.env.SKIP_EXTERNALS === 'true') {
            const body = req.body || {};
            const created = demo.createShift(body);
            return res.status(201).json({ id: created.id, created: true, shift: created });
        }
        const b = req.body || {};
        const date = b.date || new Date().toISOString().slice(0,10);
        const start = b.start_time || '07:00:00';
        const end = b.end_time || '15:00:00';
        const startDt = new Date(`${date}T${start}`);
        // If end is past midnight, roll by +1 day
        let endDt = new Date(`${date}T${end}`);
        if (end <= start) { endDt = new Date(endDt.getTime() + 24*60*60*1000); }

        const shift = await repositories.shifts.create({
            shift_date: date,
            start_datetime: startDt,
            end_datetime: endDt,
            required_staff: parseInt(b.required_staff || 1, 10),
            status: 'open'
        });
        
        // Cache the shift
        try { await cacheService.set('shift', { shiftId: shift.id }, shift); } catch (_) {}
        
        // Audit log
        await repositories.auditLog.create({
            action: 'SHIFT_CREATED',
            user_id: req.user.sub,
            resource_type: 'shift',
            resource_id: shift.id,
            additional_data: JSON.stringify(shift)
        });
        
        res.status(201).json({ id: shift.id, created: true, shift });
    } catch (error) {
        console.error('Create shift error:', error);
        res.status(500).json({ error: 'Failed to create shift' });
    }
});

// Update shift (admin/supervisor)
app.put('/api/shifts/:id', googleAuth.authenticate(), ensureUserAndRoles, googleAuth.authorize(['admin','supervisor']), async (req, res) => {
  try {
    const id = req.params.id;
    if (process.env.SKIP_EXTERNALS === 'true') {
      const updated = demo.updateShift(id, req.body || {});
      if (!updated) return res.status(404).json({ error: 'Shift not found' });
      return res.json({ updated: true, shift: updated });
    }
    const exists = await repositories.shifts.findById(id);
    if (!exists) return res.status(404).json({ error: 'Shift not found' });
    const payload = {};
    const b = req.body || {};
    if (b.date) payload.shift_date = b.date;
    if (b.start_time) payload.start_datetime = new Date(`${b.date || exists.shift_date}T${b.start_time}`);
    if (b.end_time) payload.end_datetime = new Date(`${b.date || exists.shift_date}T${b.end_time}`);
    if (typeof b.required_staff !== 'undefined') payload.required_staff = parseInt(b.required_staff, 10);
    if (b.status) payload.status = b.status;
    const updated = await repositories.shifts.update(id, payload);
    return res.json({ updated: true, shift: updated });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to update shift' });
  }
});

// Register DB-backed assignment handler before legacy handler so it runs first
app.post('/api/shifts/assign', googleAuth.authenticate(), ensureUserAndRoles, googleAuth.authorize(['admin','supervisor']), async (req, res) => {
  try {
    const { shift_id, user_id } = req.body || {};
    if (!shift_id || !user_id) return res.status(400).json({ error: 'shift_id and user_id required' });
    if (process.env.SKIP_EXTERNALS === 'true') {
      const ok = demo.assignToShift(shift_id, user_id);
      return res.json({ assigned: ok });
    }
    const shift = await repositories.shifts.findById(shift_id);
    if (!shift) return res.status(404).json({ error: 'Shift not found' });
    const existing = await db.query('SELECT TOP 1 id FROM scheduler.shift_assignments WHERE shift_id=@shift_id AND user_id=@user_id', { shift_id, user_id });
    if (!existing.recordset || existing.recordset.length === 0) {
      await repositories.assignments.create({ shift_id, user_id, status: 'assigned' });
    }
    const cntRs = await db.query("SELECT COUNT(*) as cnt FROM scheduler.shift_assignments WHERE shift_id=@shift_id AND status IN ('assigned','confirmed')", { shift_id });
    const assignedCount = parseInt(cntRs.recordset?.[0]?.cnt || 0, 10);
    const required = parseInt(shift.required_staff || 1, 10);
    if (assignedCount >= required) {
      await repositories.shifts.update(shift_id, { status: 'filled' });
    }
    return res.json({ assigned: true });
  } catch (e) { return res.status(500).json({ error: 'Failed to assign' }); }
});

app.post('/api/shifts/assign', googleAuth.authenticate(), googleAuth.authorize(['admin','supervisor']), async (req, res) => {
  try {
    const { shift_id, user_id } = req.body || {};
    if (!shift_id || !user_id) return res.status(400).json({ error: 'shift_id and user_id required' });
    if (process.env.SKIP_EXTERNALS === 'true') {
      const ok = demo.assignToShift(shift_id, user_id);
      return res.json({ assigned: ok });
    }
    return res.status(501).json({ error: 'Not Implemented' });
  } catch (e) { return res.status(500).json({ error: 'Failed to assign' }); }
});// =====================================================
// FCFS QUEUE ENDPOINTS
// =====================================================

app.post('/api/queue/open-shift', googleAuth.authenticate(), googleAuth.authorize(['admin','supervisor']), async (req, res) => {
    try {
        if (process.env.SKIP_EXTERNALS === 'true') {
            return res.json({ success: true, openShiftId: 'mock-open-' + Date.now(), queueSize: 0, firstWindowStart: new Date().toISOString() });
        }
        const { shift_id, reason, urgency_level, expires_in_hours } = req.body;
        
        const result = await fcfsScheduler.postOpenShift({
            shiftId: shift_id,
            requestedBy: req.user.sub,
            reason,
            urgencyLevel: urgency_level,
            expiresInHours: expires_in_hours
        });
        
        res.json(result);
    } catch (error) {
        console.error('Post open shift error:', error);
        res.status(500).json({ error: 'Failed to post open shift' });
    }
});

app.post('/api/queue/respond', googleAuth.authenticate(), async (req, res) => {
    try {
        if (process.env.SKIP_EXTERNALS === 'true') { return res.json({ success: true, response: req.body?.response || 'accepted' }); }
        const { queue_entry_id, response } = req.body;
        
        const result = await fcfsScheduler.respondToShiftOffer({
            queueEntryId: queue_entry_id,
            userId: req.user.sub,
            response
        });
        
        res.json(result);
    } catch (error) {
        console.error('Queue response error:', error);
        res.status(500).json({ error: 'Failed to respond to shift offer' });
    }
});

app.get('/api/queue/status/:openShiftId', googleAuth.authenticate(), async (req, res) => {
    try {
        const status = await fcfsScheduler.getQueueStatus(req.params.openShiftId);
        res.json(status);
    } catch (error) {
        console.error('Queue status error:', error);
        res.status(500).json({ error: 'Failed to get queue status' });
    }
});

// =====================================================
// STAFF & ON-CALL (DEMO + API)
// =====================================================
app.post('/api/seed/radtechs', googleAuth.authenticate(), googleAuth.authorize(['admin']), async (req, res) => {
  try {
    if (process.env.SKIP_EXTERNALS === 'true') {
      const count = parseInt(req.body?.count) || 20;
      const staff = demo.seedStaff(count);
      return res.json({ seeded: staff.length });
    }
    return res.status(501).json({ error: 'Not Implemented' });
  } catch (e) { return res.status(500).json({ error: 'Failed to seed' }); }
});

// Seed demo shifts (admin)
app.post('/api/seed/shifts', googleAuth.authenticate(), googleAuth.authorize(['admin']), async (req, res) => {
    try {
        if (process.env.SKIP_EXTERNALS === 'true') {
            const count = parseInt(req.body?.count) || 40;
            const seeded = demo.seedShifts(count);
            return res.json({ seeded: seeded.length });
        }
        return res.status(501).json({ error: 'Not Implemented' });
    } catch (e) { return res.status(500).json({ error: 'Failed to seed shifts' }); }
});

app.get('/api/staff', googleAuth.authenticate(), async (req, res) => {
  try {
    if (process.env.SKIP_EXTERNALS === 'true' || !db.connected) { demo.ensureSeeded(); return res.json({ staff: demo.listStaff() }); }
    const rs = await db.query('SELECT id, first_name, last_name, email, department_id, title FROM scheduler.users WHERE is_active=1');
    return res.json({ staff: rs.recordset || [] });
  } catch (e) { return res.status(500).json({ error: 'Failed to load staff' }); }
});

app.get('/api/oncall', googleAuth.authenticate(), async (req, res) => {
  try {
    const view = (req.query.view || 'day').toLowerCase();
    const date = req.query.date || new Date().toISOString().slice(0,10);
    if (process.env.SKIP_EXTERNALS === 'true') {
      if (view === 'day') return res.json({ date, assignments: demo.getOnCall({ date }) });
      const d = new Date(date);
      let start = new Date(d); let end = new Date(d);
      if (view === 'week') { const day = d.getUTCDay(); start.setUTCDate(d.getUTCDate() - day); end.setUTCDate(start.getUTCDate() + 6); }
      else if (view === 'month') { start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)); end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth()+1, 0)); }
      return res.json({ view, range: { start: start.toISOString().slice(0,10), end: end.toISOString().slice(0,10) }, assignments: demo.getOnCallRange({ startDate: start.toISOString().slice(0,10), endDate: end.toISOString().slice(0,10) }) });
    }
    return res.status(501).json({ error: 'Not Implemented' });
  } catch (e) { return res.status(500).json({ error: 'Failed to load on-call' }); }
});

app.post('/api/oncall', googleAuth.authenticate(), googleAuth.authorize(['admin','supervisor']), async (req, res) => {
  try {
    const { date, department, userId, notes } = req.body || {};
    if (!date || !department || !userId) return res.status(400).json({ error: 'date, department, userId required' });
    if (process.env.SKIP_EXTERNALS === 'true') { demo.setOnCall({ date, department, userId, notes }); return res.json({ saved: true }); }
    return res.status(501).json({ error: 'Not Implemented' });
  } catch (e) { return res.status(500).json({ error: 'Failed to save on-call' }); }
});
// =====================================================
// NOTIFICATION ENDPOINTS
// =====================================================

app.get('/api/notifications', googleAuth.authenticate(), async (req, res) => {
    try {
        if (process.env.SKIP_EXTERNALS === 'true') {
            const now = new Date().toISOString();
            return res.json({ notifications: [ { id: 'n1', type: 'shift', message: 'New shift available', timestamp: now, actionable: true }, { id: 'n2', type: 'alert', message: 'Policy update available', timestamp: now } ], unread_count: 1 });
        }
        const { status = 'unread', type, limit = 20, offset = 0 } = req.query;
        
        const filters = { user_id: req.user.sub };
        if (status !== 'all') filters.status = status;
        if (type) filters.type = type;
        
        const notifications = await repositories.notifications.findAll(filters, {
            orderBy: 'created_at DESC',
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
        
        const unreadCount = await repositories.notifications.count({
            user_id: req.user.sub,
            status: 'pending'
        });
        
        res.json({ notifications, unread_count: unreadCount });
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ error: 'Failed to retrieve notifications' });
    }
});

app.put('/api/notifications/:id/read', googleAuth.authenticate(), async (req, res) => {
    try {
        if (process.env.SKIP_EXTERNALS === 'true') {
            return res.json({ marked_read: true });
        }
        await repositories.notifications.update(req.params.id, {
            status: 'read',
            read_at: new Date()
        });
        
        res.json({ marked_read: true });
    } catch (error) {
        console.error('Mark notification read error:', error);
        res.status(500).json({ error: 'Failed to mark notification as read' });
    }
});

// =====================================================
// ANALYTICS ENDPOINTS
// =====================================================
// DASHBOARD METRICS (compat route) — soft auth so UI loads without token
app.get('/api/dashboard/metrics', googleAuth.softAuthenticate(), async (req, res) => {
  res.set('X-Route','dashboard-soft');
  try {
    if (process.env.SKIP_EXTERNALS === 'true') {
      return res.json({
        metrics: { shiftsToday: 12, openShifts: 3, staffOnDuty: 27, fillRate: 92, avgResponseTime: 180, overtimeHours: 14, fatigueAlerts: 1, upcomingShifts: [] },
        userStats: { hoursThisWeek: 32, shiftsCompleted: 4, nextShift: null, fatigueScore: 2, consecutiveDays: 2 },
        alerts: []
      });
    }
    // Try cached metrics first (short TTL)
    const cached = await cacheService.get('metrics', { type: 'dashboard_soft', id: 'global' }).catch(() => null);
    if (cached) {
      return res.json({ metrics: cached, userStats: {}, alerts: [] });
    }
    // Minimal live metrics from DB if not cached
    const today = new Date().toISOString().slice(0,10);
    const openCount = await repositories.shifts.count({ status: 'open' }).catch(() => 0);
    const todayCount = await repositories.shifts.count({ shift_date: today }).catch(() => 0);
    const metrics = { shiftsToday: todayCount, openShifts: openCount, staffOnDuty: 0, fillRate: 0, avgResponseTime: 0, overtimeHours: 0, fatigueAlerts: 0, upcomingShifts: [] };
    // Cache for 60 seconds
    await cacheService.set('metrics', { type: 'dashboard_soft', id: 'global' }, metrics, { ttl: 60 }).catch(() => {});
    return res.json({ metrics, userStats: {}, alerts: [] });
  } catch (e) {
    // Graceful fallback if DB not reachable
    return res.json({
      metrics: { shiftsToday: 0, openShifts: 0, staffOnDuty: 0, fillRate: 0, avgResponseTime: 0, overtimeHours: 0, fatigueAlerts: 0, upcomingShifts: [] },
      userStats: {},
      alerts: []
    });
  }
});

app.get('/api/analytics/dashboard', googleAuth.authenticate(), async (req, res) => {
    try {
        const hospitalId = req.user['https://hospital-scheduler.com/hospitalId'];
        
        // Get cached metrics first
        let metrics = await cacheService.get('metrics', { 
            type: 'dashboard', 
            id: hospitalId 
        });
        
        if (!metrics) {
            // Calculate fresh metrics
            const today = new Date().toISOString().split('T')[0];
            
            const [shiftsToday, openShifts, staffOnDuty] = await Promise.all([
                repositories.shifts.count({ hospital_id: hospitalId, shift_date: today }),
                repositories.shifts.count({ hospital_id: hospitalId, status: 'open' }),
                db.query(`
                    SELECT COUNT(DISTINCT user_id) as count
                    FROM scheduler.shift_assignments sa
                    JOIN scheduler.shifts s ON sa.shift_id = s.id
                    WHERE s.hospital_id = @hospitalId
                    AND s.shift_date = @today
                    AND sa.status IN ('assigned', 'confirmed')
                `, { hospitalId, today })
            ]);
            
            metrics = {
                shifts_today: shiftsToday,
                open_shifts: openShifts,
                staff_on_duty: staffOnDuty.recordset[0].count,
                fill_rate: 97.5, // Calculate from actual data
                avg_response_time: 8.5,
                overtime_hours: 145
            };
            
            // Cache metrics
            await cacheService.set('metrics', { type: 'dashboard', id: hospitalId }, metrics);
        }
        
        res.json({
            metrics,
            trends: {
                fill_rate_7d: [95, 96, 97, 98, 97, 96, 97.5],
                overtime_7d: [120, 130, 125, 140, 135, 150, 145]
            },
            alerts: []
        });
    } catch (error) {
        console.error('Dashboard metrics error:', error);
        res.status(500).json({ error: 'Failed to retrieve dashboard metrics' });
    }
});

// =====================================================
// USER MANAGEMENT ENDPOINTS
// =====================================================

app.get('/api/users/profile', googleAuth.authenticate(), async (req, res) => {
    try {
        const userId = req.user.sub;
        
        // Get user from cache or database
        let user = await cacheService.get('user', { userId });
        
        if (!user) {
            user = await repositories.users.findById(userId);
            await cacheService.set('user', { userId }, user);
        }
        
        // Get current stats
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        
        const stats = await db.query(`
            SELECT 
                total_hours_worked as hours_this_week,
                fatigue_score,
                consecutive_days_worked
            FROM scheduler.work_hours_tracking
            WHERE user_id = @userId AND week_start = @weekStart
        `, { userId, weekStart: weekStart.toISOString().split('T')[0] });
        
        res.json({
            ...user,
            stats: stats.recordset[0] || {
                hours_this_week: 0,
                fatigue_score: 0,
                consecutive_days_worked: 0
            }
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Failed to retrieve profile' });
    }
});

// =====================================================
// ERROR HANDLING
// =====================================================

app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    
    // Log to audit if repository is available
    if (repositories && repositories.auditLog && repositories.auditLog.create) {
        repositories.auditLog.create({
            action: 'ERROR',
            user_id: req.user?.sub,
            error_message: err.message,
            endpoint: req.path,
            method: req.method,
            additional_data: JSON.stringify({
                stack: err.stack,
                body: req.body
            })
        }).catch(() => {});
    }
    
    res.status(err.status || 500).json({
        error: {
            code: err.code || 'INTERNAL_ERROR',
            message: process.env.NODE_ENV === 'production' ? 
                'An error occurred' : err.message,
            request_id: req.id
        }
    });
});

// =====================================================
// =====================================================
// ADMIN ENDPOINTS (Roles)
// =====================================================

// List roles
app.get('/api/admin/roles', googleAuth.authenticate(), googleAuth.authorize(['admin']), async (req, res) => {
  try {
    if (process.env.SKIP_EXTERNALS === 'true' || !db.connected) {
      return res.json({ roles: [ { name: 'admin' }, { name: 'supervisor' }, { name: 'user' } ] });
    }
    const rs = await db.query("SELECT name FROM scheduler.roles ORDER BY name");
    return res.json({ roles: rs.recordset || [] });
  } catch (e) { return res.status(500).json({ error: 'Failed to load roles' }); }
});

// Seed default roles
app.post('/api/admin/roles/seed', googleAuth.authenticate(), googleAuth.authorize(['admin']), async (req, res) => {
  try {
    if (process.env.SKIP_EXTERNALS === 'true' || !db.connected) {
      return res.json({ seeded: true });
    }
    const hospitalId = req.body?.hospital_id || null;
    const roles = ['admin','supervisor','user'];
    for (const r of roles) {
      const existing = await db.query("SELECT id FROM scheduler.roles WHERE name=@name AND (@hid IS NULL OR hospital_id=@hid)", { name: r, hid: hospitalId });
      if (!existing.recordset || existing.recordset.length === 0) {
        await db.query("INSERT INTO scheduler.roles (name, permissions, hospital_id) VALUES (@name, '[]', @hid)", { name: r, hid: hospitalId });
      }
    }
    return res.json({ seeded: true });
  } catch (e) { return res.status(500).json({ error: 'Failed to seed roles' }); }
});

// Assign role to user by email
app.post('/api/admin/users/assign-role', googleAuth.authenticate(), googleAuth.authorize(['admin']), async (req, res) => {
  try {
    const { email, roleName, hospital_id } = req.body || {};
    if (!email || !roleName) return res.status(400).json({ error: 'email and roleName required' });
    if (process.env.SKIP_EXTERNALS === 'true' || !db.connected) {
      return res.json({ updated: true });
    }
    const roleRs = await db.query("SELECT TOP 1 id FROM scheduler.roles WHERE name=@name AND (@hid IS NULL OR hospital_id=@hid)", { name: roleName, hid: hospital_id || null });
    if (!roleRs.recordset || roleRs.recordset.length === 0) return res.status(404).json({ error: 'Role not found' });
    const roleId = roleRs.recordset[0].id;
    await db.query("UPDATE scheduler.users SET role_id=@roleId WHERE email=@email", { roleId, email });
    return res.json({ updated: true });
  } catch (e) { return res.status(500).json({ error: 'Failed to assign role' }); }
});// SERVER STARTUP
// =====================================================

const PORT = process.env.PORT || 3001;

async function startServer() {
    let dbReady = true;
    try {
        if (process.env.SKIP_EXTERNALS === 'true') {
            console.log('SKIP_EXTERNALS=true: Skipping DB connection');
        } else {
            try {
                await db.connect();
                console.log('Database connected');
            } catch (dbErr) {
                dbReady = false;
                console.error('Database connection failed:', dbErr?.message || dbErr);
                console.error('Continuing to start server so endpoints can return informative errors.');
            }
        }

        server.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
            console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`API available at http://localhost:${PORT}/api`);
            if (!dbReady) {
                console.warn('Warning: DB not connected. Some endpoints will return 500 until DB is reachable.');
            }
        });

        process.on('SIGTERM', async () => {
            console.log('SIGTERM received, shutting down gracefully');
            server.close(() => {
                try { db.close(); } catch (_) {}
                try { cacheService.close(); } catch (_) {}
                process.exit(0);
            });
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        // Do not exit immediately; attempt to start listener for diagnosability
        try {
            server.listen(PORT, () => {
                console.log(`Server running on port ${PORT} (degraded)`);
            });
        } catch (_) {
            process.exit(1);
        }
    }
}

// Start the server only when run directly (not during tests)
if (require.main === module) {
    startServer();
}

module.exports = app;





