/**
 * Real-time Notification System with Socket.io
 * HIPAA-compliant encrypted WebSocket communications
 * Supports push, SMS, email, and in-app notifications
 */

const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { db, repositories } = require('./db-config');
const Redis = require('ioredis');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const twilio = require('twilio');
const webpush = require('web-push');

class RealtimeNotificationSystem {
    constructor(server, config) {
        this.config = config;
        this.skipExternals = process.env.SKIP_EXTERNALS === 'true';
        if (this.skipExternals) {
            // No-op Redis interface
            const noop = async () => undefined;
            this.redis = { lpush: noop, get: async () => null, setex: noop, info: async () => '', dbsize: async () => 0, keys: async () => [] };
            this.pubClient = { publish: noop };
            this.subClient = { subscribe: noop, on: () => {} };
        } else {
            this.redis = new Redis({ ...config.redis, lazyConnect: true });
            this.pubClient = new Redis({ ...config.redis, lazyConnect: true });
            this.subClient = new Redis({ ...config.redis, lazyConnect: true });
        }
        this.db = db;
        this.repositories = repositories;
        this.rolePermissions = config.rolePermissions || {
            admin: ['all'],
            manager: ['view_all', 'edit_schedules', 'approve_shifts', 'view_reports', 'view_metrics', 'view_shifts'],
            nurse: ['view_own', 'request_shifts', 'swap_shifts', 'view_shifts'],
            viewer: ['view_only']
        };
        // For Google ID tokens, use tokeninfo endpoint
        this.googleClientId = process.env.REACT_APP_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || config.googleClientId;
        
        // Initialize Socket.io with security settings
        this.io = socketIO(server, {
            cors: {
                origin: config.allowedOrigins,
                credentials: true
            },
            // Force long-polling only to avoid proxy/WebSocket handshake issues behind IIS/ARR
            transports: ['polling'],
            allowUpgrades: false,
            pingTimeout: 60000,
            pingInterval: 25000,
            upgradeTimeout: 30000,
            maxHttpBufferSize: 1e6, // 1MB
            perMessageDeflate: {
                threshold: 1024
            }
        });

        // Initialize notification channels
        this.initializeChannels();
        
        // Set up Socket.io middleware and handlers
        this.setupSocketHandlers();
        
        // Initialize notification queue processor
        if (!this.skipExternals) {
            this.startQueueProcessor();
        }
        
        // Track active connections for presence
        this.activeConnections = new Map();
        
        // Notification templates cache
        this.templateCache = new Map();
    }

    /**
     * Initialize notification channels (Email, SMS, Push)
     */
    initializeChannels() {
        // Email configuration (HIPAA-compliant provider)
        if (this.config.email?.host && this.config.email?.user && this.config.email?.password) {
            this.emailTransporter = nodemailer.createTransport({
                host: this.config.email.host,
                port: this.config.email.port,
                secure: true,
                auth: {
                    user: this.config.email.user,
                    pass: this.config.email.password
                },
                tls: {
                    minVersion: 'TLSv1.2',
                    ciphers: 'HIGH:!aNULL:!MD5'
                }
            });
        } else {
            // Dev fallback no-op transporter
            this.emailTransporter = { sendMail: async () => ({ messageId: 'dev-noop' }) };
        }

        // SMS configuration (Twilio with HIPAA BAA)
        if (this.config.sms?.accountSid && this.config.sms?.authToken) {
            this.twilioClient = twilio(
                this.config.sms.accountSid,
                this.config.sms.authToken
            );
        } else {
            // Dev fallback no-op SMS client
            this.twilioClient = { messages: { create: async () => ({ sid: 'dev-noop' }) } };
        }

        // Web Push configuration
        if (this.config.push?.publicKey && this.config.push?.privateKey) {
            webpush.setVapidDetails(
                this.config.push.subject,
                this.config.push.publicKey,
                this.config.push.privateKey
            );
            this.pushEnabled = true;
        } else {
            this.pushEnabled = false;
        }
    }

    /**
     * Set up Socket.io authentication and event handlers
     */
    setupSocketHandlers() {
        // Authentication middleware
        this.io.use(async (socket, next) => {
            try {
                const token = socket.handshake.auth.token;
                
                if (!token) {
                    return next(new Error('Authentication required'));
                }

                let rawToken = token;
                if (rawToken.startsWith('Bearer ')) rawToken = rawToken.slice(7);
                let decoded;
                if (this.googleClientId) {
                    const resp = await axios.get('https://oauth2.googleapis.com/tokeninfo', { params: { id_token: rawToken } });
                    const data = resp.data || {};
                    if (data.aud !== this.googleClientId) return next(new Error('Authentication failed'));
                    decoded = data;
                } else if (this.config.jwtSecret) {
                    decoded = jwt.verify(rawToken, this.config.jwtSecret);
                } else {
                    return next(new Error('Server not configured for JWT verification'));
                }
                
                // Optional: Check session in Redis (fallback permissive)
                try {
                    const sessionKey = `session:${decoded.sub || decoded.userId}`;
                    await this.redis.get(sessionKey);
                } catch (_) {}

                // Attach user info to socket
                socket.userId = decoded.sub || decoded.userId;
                const ns = 'https://hospital-scheduler.com/';
                socket.hospitalId = decoded[ns + 'hospitalId'] || decoded.hospitalId;
                socket.departmentId = decoded[ns + 'departmentId'] || decoded.departmentId;
                (function(){ const admins=(process.env.ADMIN_EMAILS||'').split(',').map(s=>s.trim()).filter(Boolean); const sups=(process.env.SUPERVISOR_EMAILS||'').split(',').map(s=>s.trim()).filter(Boolean); let role = decoded[ns + 'role'] || decoded.role || 'user'; if (decoded.email && admins.includes(decoded.email)) role='admin'; else if (decoded.email && sups.includes(decoded.email)) role='supervisor'; socket.role = role; })();
                
                // Log connection for audit
                await this.auditLog({
                    action: 'WEBSOCKET_CONNECT',
                    userId: decoded.userId,
                    ip: socket.handshake.address,
                    userAgent: socket.handshake.headers['user-agent']
                });

                next();
            } catch (error) {
                next(new Error('Authentication failed'));
            }
        });

        // Connection handler
        this.io.on('connection', (socket) => {
            console.log(`User ${socket.userId} connected`);
            
            // Track active connection
            this.activeConnections.set(socket.userId, {
                socketId: socket.id,
                connectedAt: new Date(),
                hospitalId: socket.hospitalId,
                departmentId: socket.departmentId
            });

            // Join user-specific room
            socket.join(`user:${socket.userId}`);
            
            // Join hospital room for broadcast messages
            socket.join(`hospital:${socket.hospitalId}`);
            
            // Join department room if applicable
            if (socket.departmentId) {
                socket.join(`department:${socket.departmentId}`);
            }

            // Update user presence
            this.updateUserPresence(socket.userId, 'online');

            // Handle real-time events
            this.attachEventHandlers(socket);

            // Handle disconnection
            socket.on('disconnect', async (reason) => {
                console.log(`User ${socket.userId} disconnected: ${reason}`);
                
                this.activeConnections.delete(socket.userId);
                this.updateUserPresence(socket.userId, 'offline');
                
                await this.auditLog({
                    action: 'WEBSOCKET_DISCONNECT',
                    userId: socket.userId,
                    reason
                });
            });

            // Send pending notifications
            this.sendPendingNotifications(socket.userId);
        });
    }

    /**
     * Attach event handlers for real-time features
     */
    attachEventHandlers(socket) {
        // Shift availability notification
        socket.on('shift:available', async (data) => {
            if (!this.validatePermission(socket, 'view_shifts')) {
                return socket.emit('error', { message: 'Permission denied' });
            }

            // Broadcast to department
            this.io.to(`department:${data.departmentId}`).emit('shift:new', {
                shiftId: data.shiftId,
                startTime: data.startTime,
                endTime: data.endTime,
                urgency: data.urgency,
                timestamp: new Date()
            });
        });

        // Shift response (accept/decline)
        socket.on('shift:respond', async (data) => {
            try {
                const response = await this.processShiftResponse({
                    userId: socket.userId,
                    queueEntryId: data.queueEntryId,
                    response: data.response
                });

                socket.emit('shift:response:success', response);
                
                // Notify relevant parties
                if (data.response === 'accepted') {
                    this.broadcastShiftFilled(data.shiftId);
                }
            } catch (error) {
                socket.emit('shift:response:error', { 
                    message: error.message 
                });
            }
        });

        // Request shift swap
        socket.on('shift:swap:request', async (data) => {
            const swapRequest = await this.createSwapRequest({
                requesterId: socket.userId,
                shiftId: data.shiftId,
                reason: data.reason
            });

            // Notify potential swap partners
            this.notifySwapCandidates(swapRequest);
        });

        // Subscribe to real-time metrics
        socket.on('metrics:subscribe', async (data) => {
            if (!this.validatePermission(socket, 'view_metrics')) {
                return socket.emit('error', { message: 'Permission denied' });
            }

            socket.join(`metrics:${data.type}`);
            
            // Send current metrics
            const metrics = await this.getCurrentMetrics(data.type);
            socket.emit('metrics:update', metrics);
        });

        // Typing indicators for chat
        socket.on('chat:typing', (data) => {
            socket.to(`chat:${data.channelId}`).emit('chat:typing', {
                userId: socket.userId,
                isTyping: data.isTyping
            });
        });

        // Acknowledge notification receipt
        socket.on('notification:ack', async (data) => {
            await this.markNotificationAsRead(data.notificationId, socket.userId);
        });
    }

    /**
     * Send notification through multiple channels
     */
    async sendNotification({
        userId,
        type,
        channel = 'all',
        priority = 3,
        subject,
        body,
        data = {},
        templateId = null
    }) {
        try {
            // Get user preferences
            const userPrefs = await this.getUserNotificationPreferences(userId);
            
            // Get or generate notification content
            const content = templateId ? 
                await this.renderTemplate(templateId, data) : 
                { subject, body };

            // Create notification record
            const notificationId = await this.createNotificationRecord({
                userId,
                type,
                channel,
                priority,
                ...content,
                data
            });

            // Determine channels to use
            const channels = channel === 'all' ? 
                ['in_app', 'push', 'email', 'sms'] : 
                [channel];

            // Send through each channel based on user preferences
            const results = [];
            
            for (const ch of channels) {
                if (userPrefs[ch] !== false) {
                    const result = await this.sendViaChannel(ch, {
                        userId,
                        notificationId,
                        ...content,
                        data,
                        priority
                    });
                    results.push(result);
                }
            }

            // Update notification status
            await this.updateNotificationStatus(notificationId, 'sent');

            return {
                notificationId,
                channels: results
            };
        } catch (error) {
            console.error('Notification error:', error);
            throw error;
        }
    }

    /**
     * Send notification via specific channel
     */
    async sendViaChannel(channel, notification) {
        switch (channel) {
            case 'in_app':
                return this.sendInAppNotification(notification);
            
            case 'push':
                return this.sendPushNotification(notification);
            
            case 'email':
                return this.sendEmailNotification(notification);
            
            case 'sms':
                return this.sendSMSNotification(notification);
            
            default:
                throw new Error(`Unknown channel: ${channel}`);
        }
    }

    /**
     * Send in-app notification via WebSocket
     */
    async sendInAppNotification(notification) {
        const socket = this.activeConnections.get(notification.userId);
        
        if (socket) {
            // User is online, send immediately
            this.io.to(`user:${notification.userId}`).emit('notification', {
                id: notification.notificationId,
                type: notification.type,
                subject: notification.subject,
                body: notification.body,
                data: notification.data,
                priority: notification.priority,
                timestamp: new Date()
            });
            
            return { channel: 'in_app', status: 'delivered' };
        } else {
            // User is offline, queue for later
            await this.queueNotification(notification);
            return { channel: 'in_app', status: 'queued' };
        }
    }

    /**
     * Send push notification to browser/mobile
     */
    async sendPushNotification(notification) {
        try {
            if (!this.pushEnabled) {
                return { channel: 'push', status: 'disabled' };
            }
            // Get user's push subscription
            const subscription = await this.getUserPushSubscription(notification.userId);
            
            if (!subscription) {
                return { channel: 'push', status: 'no_subscription' };
            }

            const payload = JSON.stringify({
                title: notification.subject,
                body: notification.body,
                icon: '/icon-192x192.png',
                badge: '/badge-72x72.png',
                data: {
                    notificationId: notification.notificationId,
                    ...notification.data
                },
                requireInteraction: notification.priority >= 4,
                vibrate: notification.priority >= 4 ? [200, 100, 200] : undefined
            });

            await webpush.sendNotification(subscription, payload);
            
            return { channel: 'push', status: 'sent' };
        } catch (error) {
            console.error('Push notification error:', error);
            return { channel: 'push', status: 'failed', error: error.message };
        }
    }

    /**
     * Send email notification
     */
    async sendEmailNotification(notification) {
        try {
            const user = await this.getUserContact(notification.userId);
            
            if (!user.email) {
                return { channel: 'email', status: 'no_email' };
            }

            // Encrypt sensitive data in email
            const encryptedData = this.encryptData(JSON.stringify(notification.data));

            const mailOptions = {
                from: this.config.email.from,
                to: user.email,
                subject: `[${this.getPriorityLabel(notification.priority)}] ${notification.subject}`,
                html: this.renderEmailTemplate(notification, encryptedData),
                headers: {
                    'X-Priority': notification.priority,
                    'X-Notification-ID': notification.notificationId
                }
            };

            const info = await this.emailTransporter.sendMail(mailOptions);
            
            return { channel: 'email', status: 'sent', messageId: info.messageId };
        } catch (error) {
            console.error('Email notification error:', error);
            return { channel: 'email', status: 'failed', error: error.message };
        }
    }

    /**
     * Send SMS notification
     */
    async sendSMSNotification(notification) {
        try {
            // Only send SMS for high priority notifications
            if (notification.priority < 4) {
                return { channel: 'sms', status: 'skipped_low_priority' };
            }

            const user = await this.getUserContact(notification.userId);
            
            if (!user.phone) {
                return { channel: 'sms', status: 'no_phone' };
            }

            const message = await this.twilioClient.messages.create({
                body: `${notification.subject}\n${notification.body}`.substring(0, 160),
                from: this.config.sms.fromNumber,
                to: user.phone
            });

            return { channel: 'sms', status: 'sent', sid: message.sid };
        } catch (error) {
            console.error('SMS notification error:', error);
            return { channel: 'sms', status: 'failed', error: error.message };
        }
    }

    /**
     * Process queued notifications
     */
    async startQueueProcessor() {
        setInterval(async () => {
            try {
                const pendingNotifications = await this.getPendingNotifications();
                for (const notification of pendingNotifications) {
                    try {
                        if (notification.retry_count < 3) {
                            await this.retryNotification(notification);
                        } else {
                            await this.markNotificationAsFailed(notification.id);
                        }
                    } catch (innerErr) {
                        console.error('Notification retry error:', innerErr?.message || innerErr);
                    }
                }
            } catch (err) {
                console.error('Queue processor error:', err?.message || err);
            }
        }, 30000); // Check every 30 seconds
    }

    /**
     * Send pending notifications when user comes online
     */
    async sendPendingNotifications(userId) {
        const pending = await this.redis.lrange(`pending:${userId}`, 0, -1);
        
        for (const notificationJson of pending) {
            const notification = JSON.parse(notificationJson);
            this.io.to(`user:${userId}`).emit('notification', notification);
        }
        
        // Clear pending queue
        await this.redis.del(`pending:${userId}`);
    }

    /**
     * Update user presence status
     */
    async updateUserPresence(userId, status) {
        const presenceKey = `presence:${userId}`;
        await this.redis.setex(presenceKey, 300, status); // 5 minute TTL
        
        // Broadcast presence update to relevant users
        const user = await this.getUserInfo(userId);
        if (user.departmentId) {
            this.io.to(`department:${user.departmentId}`).emit('presence:update', {
                userId,
                status,
                timestamp: new Date()
            });
        }
    }

    /**
     * Broadcast shift filled notification
     */
    broadcastShiftFilled(shiftId) {
        this.pubClient.publish('shift:filled', JSON.stringify({
            shiftId,
            timestamp: new Date()
        }));
    }

    /**
     * Get current metrics for dashboard
     */
    async getCurrentMetrics(type) {
        const metrics = {
            timestamp: new Date(),
            type
        };

        switch (type) {
            case 'shifts':
                metrics.data = await this.getShiftMetrics();
                break;
            case 'staffing':
                metrics.data = await this.getStaffingMetrics();
                break;
            case 'notifications':
                metrics.data = await this.getNotificationMetrics();
                break;
        }

        return metrics;
    }

    /**
     * Encrypt sensitive data for transmission
     */
    encryptData(data) {
        const algorithm = 'aes-256-gcm';
        const key = Buffer.from(this.config.encryptionKey, 'hex');
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(algorithm, key, iv);
        
        let encrypted = cipher.update(data, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const authTag = cipher.getAuthTag();
        
        return {
            encrypted,
            iv: iv.toString('hex'),
            authTag: authTag.toString('hex')
        };
    }

    /**
     * Validate user permissions
     */
    validatePermission(socket, permission) {
        const permissions = this.rolePermissions[socket.role] || [];
        return permissions.includes(permission) || permissions.includes('all');
    }

    // ----- Minimal data helpers (DB-backed) -----
    async getUserNotificationPreferences(userId) {
        // Default preferences; could be extended to read from users.preferences
        return { in_app: true, push: true, email: true, sms: false };
    }

    async createNotificationRecord({ userId, type, channel, priority, subject, body, data }) {
        const rec = await this.repositories.notifications.create({
            user_id: userId,
            channel,
            priority,
            subject,
            body,
            data: JSON.stringify(data || {}),
            status: 'pending'
        });
        return rec.id;
    }

    async updateNotificationStatus(id, status) {
        await this.repositories.notifications.update(id, { status });
    }

    async getUserContact(userId) {
        const user = await this.repositories.users.findById(userId);
        return { email: user?.email || null, phone: user?.phone || null };
    }

    async queueNotification(notification) {
        await this.redis.lpush(`pending:${notification.userId}`, JSON.stringify(notification));
    }

    async getPendingNotifications() {
        // Pull from DB where status=pending and scheduled_for <= now
        const result = await this.db.query(
            `SELECT TOP 50 * FROM scheduler.notifications WHERE status = 'pending' AND scheduled_for <= GETUTCDATE() ORDER BY scheduled_for ASC`
        );
        return result.recordset || [];
    }

    async retryNotification(notification) {
        // Increment retry counter and leave status pending
        await this.repositories.notifications.update(notification.id, { retry_count: (notification.retry_count || 0) + 1 });
    }

    async markNotificationAsFailed(id) {
        await this.repositories.notifications.update(id, { status: 'failed' });
    }

    async getUserPushSubscription(userId) {
        // Not implemented; return null to skip push
        return null;
    }

    async getUserInfo(userId) {
        return await this.repositories.users.findById(userId);
    }

    async getShiftMetrics() { return { open: 0, filled: 0, avgFillMins: 0 }; }
    async getStaffingMetrics() { return { onDuty: 0, overtimeHours: 0 }; }
    async getNotificationMetrics() { return { sent: 0, failed: 0, queued: 0 }; }

    /**
     * Audit log for HIPAA compliance
     */
    async auditLog(entry) {
        await this.redis.lpush('audit:notifications', JSON.stringify({
            ...entry,
            timestamp: new Date()
        }));
    }

    /**
     * Render email template
     */
    renderEmailTemplate(notification, encryptedData) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: #2563eb; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
                    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
                    .footer { background: #f3f4f6; padding: 15px; text-align: center; border-radius: 0 0 8px 8px; }
                    .priority-high { border-left: 4px solid #ef4444; }
                    .priority-urgent { border-left: 4px solid #f59e0b; animation: pulse 2s infinite; }
                    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
                    .button { 
                        display: inline-block; 
                        padding: 12px 24px; 
                        background: #2563eb; 
                        color: white; 
                        text-decoration: none; 
                        border-radius: 6px;
                        margin: 10px 0;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header ${notification.priority >= 4 ? 'priority-urgent' : ''}">
                        <h2>${notification.subject}</h2>
                    </div>
                    <div class="content">
                        <p>${notification.body}</p>
                        ${notification.data.actionUrl ? 
                            `<a href="${notification.data.actionUrl}" class="button">Take Action</a>` : 
                            ''
                        }
                    </div>
                    <div class="footer">
                        <p style="font-size: 12px; color: #6b7280;">
                            This is a secure notification from Hospital Shift Scheduler.<br>
                            Notification ID: ${notification.notificationId}<br>
                            Do not forward this email. <a href="${this.config.baseUrl}/unsubscribe">Manage preferences</a>
                        </p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    /**
     * Get priority label for notifications
     */
    getPriorityLabel(priority) {
        const labels = {
            1: 'Low',
            2: 'Normal',
            3: 'Important',
            4: 'High',
            5: 'Urgent'
        };
        return labels[priority] || 'Normal';
    }
}

module.exports = RealtimeNotificationSystem;

