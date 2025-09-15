const express = require('express');

module.exports = function createNotificationsRouter({ googleAuth, repositories, db, cacheService, validate, body, notificationSystem, isDemo }) {
  const router = express.Router();

  router.get('/notifications', googleAuth.authenticate(), async (req, res) => {
    try {
      if (isDemo && isDemo()) {
        const now = new Date().toISOString();
        return res.json({ notifications: [ { id: 'n1', type: 'shift', message: 'New shift available', timestamp: now, actionable: true }, { id: 'n2', type: 'alert', message: 'Policy update available', timestamp: now } ], unread_count: 1 });
      }
      const { status = 'unread', type, limit = 20, offset = 0 } = req.query;
      const filters = { user_id: req.user.sub };
      if (status !== 'all') filters.status = status;
      if (type) filters.type = type;
      const notifications = await repositories.notifications.findAll(filters, { orderBy: 'created_at DESC', limit: parseInt(limit), offset: parseInt(offset) });
      const unreadCount = await repositories.notifications.count({ user_id: req.user.sub, status: 'pending' });
      res.json({ notifications, unread_count: unreadCount });
    } catch (error) {
      res.status(500).json({ error: 'Failed to retrieve notifications' });
    }
  });

  router.put('/notifications/:id/read', googleAuth.authenticate(), async (req, res) => {
    try {
      if (isDemo && isDemo()) { return res.json({ marked_read: true }); }
      await repositories.notifications.update(req.params.id, { status: 'read', read_at: new Date() });
      res.json({ marked_read: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to mark notification as read' });
    }
  });

  router.post('/notifications/subscribe', googleAuth.authenticate(), validate([
      body('subscription').isObject().withMessage('subscription object required'),
      body('types').optional().isArray().withMessage('types must be an array')
    ]), async (req, res) => {
    try {
      if ((isDemo && isDemo()) || !db.connected) {
        // in-memory only in demo (stored in notificationSystem.pubClient? keep ephemeral)
        return res.json({ subscribed: true, mode: 'demo' });
      }
      const sub = req.body.subscription || {};
      const endpoint = String(sub.endpoint || '').slice(0, 2000);
      const p256dh = String(sub.keys?.p256dh || '').slice(0, 512);
      const auth = String(sub.keys?.auth || '').slice(0, 256);
      if (!endpoint || !p256dh || !auth) return res.status(400).json({ error: 'Invalid subscription' });
      const existing = await db.query('SELECT TOP 1 id FROM scheduler.push_subscriptions WHERE user_id=@uid AND endpoint=@endpoint', { uid: req.user.sub, endpoint });
      if (existing.recordset && existing.recordset.length) {
        await repositories.pushSubscriptions.update(existing.recordset[0].id, { p256dh, auth, user_agent: req.headers['user-agent'] || null, is_active: 1 });
      } else {
        await repositories.pushSubscriptions.create({ user_id: req.user.sub, endpoint, p256dh, auth, user_agent: req.headers['user-agent'] || null, is_active: 1 });
      }
      return res.json({ subscribed: true, mode: 'live' });
    } catch (e) { return res.status(500).json({ error: 'Failed to subscribe' }); }
  });

  // Demo-only test push trigger
  router.post('/notifications/test-push', googleAuth.authenticate(), async (req, res) => {
    try {
      if (!(isDemo && isDemo())) return res.status(403).json({ error: 'Forbidden' });
      await notificationSystem.sendNotification({
        userId: req.user.sub,
        type: 'TEST',
        channel: 'push',
        priority: 3,
        subject: 'Test Push',
        body: 'This is a test push',
        data: {}
      });
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: 'Failed to send test push' }); }
  });

  return router;
};
