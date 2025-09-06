/**
 * FCFS (First-Come, First-Served) Scheduling Algorithm
 * Implements 15-minute response windows for fair shift distribution
 * HIPAA-compliant with full audit logging
 */

const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');

class FCFSScheduler extends EventEmitter {
    constructor(db, redis, notificationService) {
        super();
        this.db = db;
        this.redis = redis;
        this.notificationService = notificationService;
        this.WINDOW_DURATION_MINUTES = 15;
        this.MAX_QUEUE_SIZE = 100;
        this.QUEUE_PRIORITY_WEIGHTS = {
            seniority: 0.3,
            lastShiftWorked: 0.2,
            skillMatch: 0.25,
            availability: 0.25
        };
    }

    /**
     * Post an open shift for FCFS distribution
     */
    async postOpenShift({
        shiftId,
        requestedBy,
        reason,
        urgencyLevel = 1,
        expiresInHours = 24
    }) {
        // SQL Server path: insert open shift, build queue via stored procedure
        const insert = await this.db.query(`
            INSERT INTO scheduler.open_shift_requests (
                shift_id, requested_by, reason, urgency_level, expires_at
            )
            OUTPUT INSERTED.*
            VALUES (@shiftId, @requestedBy, @reason, @urgencyLevel, DATEADD(HOUR, @expiresInHours, GETUTCDATE()))
        `, { shiftId, requestedBy, reason, urgencyLevel, expiresInHours });

        const openShift = insert.recordset[0];

        // Create queue entries with stored procedure
        const queueSummary = await this.db.executeProc('scheduler.CreateFCFSQueue', {
            OpenShiftId: openShift.id,
            WindowDurationMinutes: this.WINDOW_DURATION_MINUTES,
            MaxQueueSize: this.MAX_QUEUE_SIZE
        });

        // Notify the current window batch
        await this.notifyFirstBatch(openShift.id);

        // Audit
        await this.auditLog({
            action: 'OPEN_SHIFT_POSTED',
            resourceType: 'shift',
            resourceId: shiftId,
            userId: requestedBy,
            data: { openShiftId: openShift.id, urgencyLevel }
        });

        // Schedule window progression
        this.scheduleWindowProgression(openShift.id);

        const summary = queueSummary.recordset?.[0] || {};
        return {
            success: true,
            openShiftId: openShift.id,
            queueSize: summary.queue_size || 0,
            firstWindowStart: summary.first_window_start || new Date()
        };
    }

    // PostgreSQL-specific helper methods removed. SQL Server stored procedures
    // are used for eligibility and queue creation.

    /**
     * Notify workers in the current window
     */
    async notifyFirstBatch(openShiftId) {
        const currentWindow = await this.db.query(`
            SELECT 
                q.*,
                u.email,
                u.phone,
                u.first_name,
                u.last_name,
                s.start_datetime,
                s.end_datetime,
                d.name as department_name
            FROM scheduler.fcfs_queue q
            JOIN scheduler.users u ON q.user_id = u.id
            JOIN scheduler.open_shift_requests osr ON q.open_shift_id = osr.id
            JOIN scheduler.shifts s ON osr.shift_id = s.id
            JOIN scheduler.departments d ON s.department_id = d.id
            WHERE q.open_shift_id = @openShiftId
                AND q.window_starts_at <= GETUTCDATE()
                AND q.window_expires_at > GETUTCDATE()
                AND q.response_status = 'waiting'
        `, { openShiftId });

        for (const entry of currentWindow.recordset) {
            await this.notificationService.sendNotification({
                userId: entry.user_id,
                type: 'SHIFT_AVAILABLE',
                channel: 'push',
                priority: 5,
                subject: 'Open Shift Available',
                body: 'A department shift is now available.',
                data: {
                    shiftStart: entry.start_datetime,
                    shiftEnd: entry.end_datetime,
                    department: entry.department_name,
                    windowExpires: entry.window_expires_at,
                    responseUrl: `/shifts/respond/${entry.id}`
                }
            });
        }
    }

    /**
     * Handle worker response to shift offer
     */
    async respondToShiftOffer({
        queueEntryId,
        userId,
        response // 'accepted' or 'declined'
    }) {
        const res = await this.db.executeProc('scheduler.AcceptShiftFromQueue', {
            QueueEntryId: queueEntryId,
            UserId: userId,
            Response: response
        });

        if (response === 'accepted') {
            // Best-effort: notify user and others
            await this.notificationService.sendNotification({
                userId,
                type: 'SHIFT_ASSIGNED',
                channel: 'email',
                priority: 3,
                subject: 'Shift Assigned',
                body: 'Your shift has been assigned.'
            });

            // Notify queued workers that shift is filled
            const openShiftIdResult = await this.db.query(`
                SELECT open_shift_id FROM scheduler.fcfs_queue WHERE id = @queueEntryId
            `, { queueEntryId });
            const openShiftId = openShiftIdResult.recordset?.[0]?.open_shift_id;
            if (openShiftId) {
                await this.notifyShiftFilled(openShiftId);
            }
        }

        await this.auditLog({
            action: `SHIFT_OFFER_${response.toUpperCase()}`,
            resourceType: 'fcfs_queue',
            resourceId: queueEntryId,
            userId,
            data: {}
        });

        return { success: true, response, result: res.recordset?.[0]?.result };
    }

    /**
     * Progress to next person in queue when current window expires or declines
     */
    async progressToNextInQueue(openShiftId) {
        await this.db.executeProc('scheduler.ProgressFCFSQueue', { OpenShiftId: openShiftId });
        await this.notifyFirstBatch(openShiftId);
        setTimeout(() => this.checkAndProgressWindow(openShiftId), this.WINDOW_DURATION_MINUTES * 60000);
    }

    /**
     * Schedule automatic window progression
     */
    scheduleWindowProgression(openShiftId) {
        setTimeout(async () => {
            await this.checkAndProgressWindow(openShiftId);
        }, this.WINDOW_DURATION_MINUTES * 60000);
    }

    /**
     * Check and progress expired windows
     */
    async checkAndProgressWindow(openShiftId) {
        await this.db.executeProc('scheduler.CleanupExpiredQueueEntries');
        await this.progressToNextInQueue(openShiftId);
    }

    /**
     * Notify all queued workers that shift has been filled
     */
    async notifyShiftFilled(openShiftId) {
        const queuedWorkers = await this.db.query(`
            SELECT DISTINCT u.id
            FROM scheduler.fcfs_queue q
            JOIN scheduler.users u ON q.user_id = u.id
            WHERE q.open_shift_id = @openShiftId
                AND q.response_status IN ('waiting', 'declined')
        `, { openShiftId });

        for (const worker of queuedWorkers.recordset) {
            await this.notificationService.sendNotification({
                userId: worker.id,
                type: 'SHIFT_FILLED',
                channel: 'push',
                priority: 2,
                subject: 'Shift Filled',
                body: 'The open shift has been filled.',
                data: { openShiftId }
            });
        }
    }

    /**
     * Get current queue status for monitoring
     */
    async getQueueStatus(openShiftId) {
        const status = await this.db.query(`
            SELECT 
                q.*,
                u.first_name,
                u.last_name,
                osr.shift_id,
                osr.status as shift_status
            FROM scheduler.fcfs_queue q
            JOIN scheduler.users u ON q.user_id = u.id
            JOIN scheduler.open_shift_requests osr ON q.open_shift_id = osr.id
            WHERE q.open_shift_id = @openShiftId
            ORDER BY q.queue_position ASC
        `, { openShiftId });

        const rows = status.recordset || [];
        const now = new Date();
        return {
            queueSize: rows.length,
            currentWindow: rows.find(r => 
                r.response_status === 'waiting' && 
                new Date(r.window_starts_at) <= now &&
                new Date(r.window_expires_at) > now
            ),
            queue: rows
        };
    }

    /**
     * Audit logging for HIPAA compliance
     */
    async auditLog(entry) {
        await this.db.query(`
            INSERT INTO audit.audit_log 
            (action, resource_type, resource_id, user_id, additional_data)
            VALUES (@action, @resourceType, @resourceId, @userId, @data)
        `, {
            action: entry.action,
            resourceType: entry.resourceType,
            resourceId: entry.resourceId,
            userId: entry.userId,
            data: JSON.stringify(entry.data || {})
        });
    }

    /**
     * Calculate and cache queue metrics for analytics
     */
    async updateQueueMetrics(openShiftId) {
        const metrics = {
            totalQueued: 0,
            acceptanceRate: 0,
            avgResponseTime: 0,
            fillTime: null
        };

        const stats = await this.db.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN response_status = 'accepted' THEN 1 ELSE 0 END) as accepted,
                SUM(CASE WHEN response_status = 'declined' THEN 1 ELSE 0 END) as declined,
                AVG(DATEDIFF(SECOND, window_starts_at, responded_at)) as avg_response_seconds
            FROM scheduler.fcfs_queue
            WHERE open_shift_id = @openShiftId
        `, { openShiftId });

        const fillInfo = await this.db.query(`
            SELECT DATEDIFF(SECOND, posted_at, filled_at) as fill_seconds
            FROM scheduler.open_shift_requests
            WHERE id = @openShiftId AND filled_at IS NOT NULL
        `, { openShiftId });

        const stat = stats.recordset?.[0] || { total: 0, accepted: 0, avg_response_seconds: null };
        const total = parseInt(stat.total || 0, 10);
        const accepted = parseInt(stat.accepted || 0, 10);
        metrics.totalQueued = total;
        metrics.acceptanceRate = total > 0 ? (accepted / total) * 100 : 0;
        metrics.avgResponseTime = stat.avg_response_seconds ? Math.round(stat.avg_response_seconds / 60) : null;

        if (fillInfo.recordset && fillInfo.recordset.length > 0) {
            metrics.fillTime = Math.round(fillInfo.recordset[0].fill_seconds / 60);
        }

        await this.redis.setex(`queue:metrics:${openShiftId}`, 3600, JSON.stringify(metrics));
        return metrics;
    }
}

module.exports = FCFSScheduler;

