const express = require('express');

module.exports = function createSettingsRouter({ googleAuth, repositories, db, cacheService }) {
  const router = express.Router();

  const defaultSettings = {
    notifications: {
      email: true,
      sms: false,
      push: true,
      sound: true,
      vibration: true,
      quietHours: false,
      quietStart: '22:00',
      quietEnd: '07:00',
    },
    display: {
      theme: 'light',
      fontSize: 'medium',
      highContrast: false,
      colorBlind: false,
    },
    language: 'en',
    timezone: 'America/New_York',
    shifts: {
      autoAccept: false,
      preferredShift: 'day',
      maxConsecutive: 3,
      minRestHours: 8,
      overtimeAlert: true,
    },
    privacy: {
      showProfile: true,
      shareSchedule: true,
      locationTracking: false,
    },
  };

  router.get('/settings', googleAuth.authenticate(), async (req, res) => {
    try {
      if (!db.connected) return res.status(503).json({ error: 'Database unavailable' });

      const email = req.user.email;
      if (!email) return res.status(400).json({ error: 'Missing user email' });
      // Find user by email
      const users = await repositories.users.findAll({ email });
      const user = users && users[0];
      if (!user) {
        // No user record yet; return defaults
        return res.json({ settings: defaultSettings });
      }
      // Try cache first
      try {
        const cached = await cacheService.get('user_settings', { userId: user.id });
        if (cached) return res.json({ settings: cached });
      } catch (_) {}
      let prefs = {};
      if (user && user.preferences) {
        try { prefs = JSON.parse(user.preferences || '{}'); } catch (_) { prefs = {}; }
      }
      const merged = { ...defaultSettings, ...(prefs.settings || {}) };
      try { await cacheService.set('user_settings', { userId: user.id }, merged, { ttl: 600 }); } catch (_) {}
      return res.json({ settings: merged });
    } catch (e) {
      res.status(500).json({ error: 'Failed to load settings' });
    }
  });

  router.put('/settings', googleAuth.authenticate(), async (req, res) => {
    try {
      const body = req.body || {};
      if (!db.connected) return res.status(503).json({ error: 'Database unavailable' });

      const email = req.user.email;
      if (!email) return res.status(400).json({ error: 'Missing user email' });
      let users = await repositories.users.findAll({ email });
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
      // Merge and persist settings in preferences JSON (under preferences.settings)
      let prefs = {};
      try { prefs = JSON.parse(user.preferences || '{}'); } catch (_) { prefs = {}; }
      const merged = { ...(prefs.settings || {}), ...body };
      prefs.settings = merged;
      await repositories.users.update(user.id, { preferences: JSON.stringify(prefs) });
      try { await cacheService.set('user_settings', { userId: user.id }, prefs.settings, { ttl: 600 }); } catch (_) {}
      return res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: 'Failed to save settings' });
    }
  });

  return router;
};
