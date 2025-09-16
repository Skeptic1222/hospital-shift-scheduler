const express = require('express');

module.exports = function createNotificationsRouter({ googleAuth, repositories, db, cacheService, validate, body, notificationSystem }) {
  const router = express.Router();

  router.get('/notifications', googleAuth.authenticate(), async (req, res) => {
    try {
      const { status = 'unread', type, limit = 20, offset = 0 } = req.query;
      const filters = { user_id: req.user.id || null };
      if (status !== 'all') filters.status = status;
      if (type) filters.type = type;
      const notifications = await repositories.notifications.findAll(filters, { orderBy: 'created_at DESC', limit: parseInt(limit), offset: parseInt(offset) });
      const unreadCount = await repositories.notifications.count({ user_id: req.user.id || null, status: 'pending' });
      res.json({ notifications, unread_count: unreadCount });
    } catch (error) {
      res.status(500).json({ error: 'Failed to retrieve notifications' });
    }
  });

  router.put('/notifications/:id/read', googleAuth.authenticate(), async (req, res) => {
    try {
      await repositories.notifications.update(req.params.id, { status: 'read', read_at: new Date() });
      res.json({ marked_read: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to mark notification as read' });
    }
  });

  // Bulk mark as read
  router.post('/notifications/mark-read', googleAuth.authenticate(), validate([
    body('ids').isArray({ min: 1 }).withMessage('ids must be a non-empty array')
  ]), async (req, res) => {
    try {
      const ids = req.body.ids || [];
      for (const id of ids) {
        try { await repositories.notifications.update(id, { status: 'read', read_at: new Date() }); } catch (_) {}
      }
      res.json({ marked_read: ids.length });
    } catch (error) {
      res.status(500).json({ error: 'Failed to mark notifications as read' });
    }
  });

  // Bulk delete (soft-delete via marking read)
  router.delete('/notifications/delete', googleAuth.authenticate(), validate([
    body('ids').isArray({ min: 1 }).withMessage('ids must be a non-empty array')
  ]), async (req, res) => {
    try {
      const ids = req.body.ids || [];
      for (const id of ids) {
        try { await repositories.notifications.update(id, { status: 'read', read_at: new Date() }); } catch (_) {}
      }
      res.json({ deleted: ids.length });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete notifications' });
    }
  });

  router.post('/notifications/subscribe', googleAuth.authenticate(), validate([
      body('subscription').isObject().withMessage('subscription object required'),
      body('types').optional().isArray().withMessage('types must be an array')
    ]), async (req, res) => {
    try {
      if (!db.connected) return res.status(503).json({ error: 'Database unavailable' });
      const sub = req.body.subscription || {};
      const endpoint = String(sub.endpoint || '').slice(0, 2000);
      const p256dh = String(sub.keys?.p256dh || '').slice(0, 512);
      const auth = String(sub.keys?.auth || '').slice(0, 256);
      if (!endpoint || !p256dh || !auth) return res.status(400).json({ error: 'Invalid subscription' });
      const existing = await db.query('SELECT TOP 1 id FROM scheduler.push_subscriptions WHERE user_id=@uid AND endpoint=@endpoint', { uid: req.user.id || null, endpoint });
      if (existing.recordset && existing.recordset.length) {
        await repositories.pushSubscriptions.update(existing.recordset[0].id, { p256dh, auth, user_agent: req.headers['user-agent'] || null, is_active: 1 });
      } else {
        await repositories.pushSubscriptions.create({ user_id: req.user.id || null, endpoint, p256dh, auth, user_agent: req.headers['user-agent'] || null, is_active: 1 });
      }
      return res.json({ subscribed: true });
    } catch (e) { return res.status(500).json({ error: 'Failed to subscribe' }); }
  });

  // Test push route intentionally omitted in production-only build

  return router;
};
