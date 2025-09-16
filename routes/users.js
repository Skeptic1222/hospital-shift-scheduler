const express = require('express');

module.exports = function createUsersRouter({ googleAuth, repositories, db, cacheService }) {
  const router = express.Router();

  // Get current user's profile with minimal stats
  router.get('/users/profile', googleAuth.authenticate(), async (req, res) => {
    try {
      const email = req.user.email;
      if (!email) return res.status(400).json({ error: 'Missing user email' });

      if (!db.connected) return res.status(503).json({ error: 'Database unavailable' });

      // Live DB path: find by email
      const users = await repositories.users.findAll({ email });
      let user = users && users[0];
      if (!user) {
        // Create minimal user record
        const [first] = (email || '').split('@');
        const [firstNameDefault, ...restDefault] = (first || '').split(/[._-]/).filter(Boolean);
        const lastNameDefault = restDefault.join(' ') || '';
        const employee_id = email.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 50);
        user = await repositories.users.create({
          employee_id,
          email,
          first_name: firstNameDefault || first || email,
          last_name: lastNameDefault,
          is_active: 1,
          last_login: new Date()
        });
      }

      // Try cache
      let cached = null;
      try { cached = await cacheService.get('user', { userId: user.id }); } catch (_) {}
      if (!cached) {
        try { await cacheService.set('user', { userId: user.id }, user, { ttl: 600 }); } catch (_) {}
      }

      // Stats: current week start
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const stats = await db.query(
        `SELECT total_hours_worked as hours_this_week, fatigue_score, consecutive_days_worked
         FROM scheduler.work_hours_tracking
         WHERE user_id = @userId AND week_start = @weekStart`,
        { userId: user.id, weekStart: weekStart.toISOString().split('T')[0] }
      ).catch(() => ({ recordset: [] }));
      const stat = (stats.recordset && stats.recordset[0]) || { hours_this_week: 0, fatigue_score: 0, consecutive_days_worked: 0 };

      return res.json({ ...user, stats: stat });
    } catch (error) {
      return res.status(500).json({ error: 'Failed to retrieve profile' });
    }
  });

  return router;
};
