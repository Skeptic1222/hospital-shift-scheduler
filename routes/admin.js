const express = require('express');

module.exports = function createAdminRouter({ googleAuth, repositories, db, validate, body, cacheService }) {
  const router = express.Router();

  // List roles
  router.get('/admin/roles', googleAuth.authenticate(), googleAuth.authorize(['admin']), async (req, res) => {
    try {
      if (!db.connected) {
        return res.status(503).json({ error: 'Database unavailable' });
      }
      const rs = await db.query("SELECT name FROM scheduler.roles ORDER BY name");
      return res.json({ roles: rs.recordset || [] });
    } catch (e) { return res.status(500).json({ error: 'Failed to load roles' }); }
  });

  // Seed default roles
  router.post('/admin/roles/seed', googleAuth.authenticate(), googleAuth.authorize(['admin']), async (req, res) => {
    try {
      if (!db.connected) {
        return res.status(503).json({ error: 'Database unavailable' });
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

  // Assign role to user by email (upsert)
  router.post(
    '/admin/users/assign-role',
    googleAuth.authenticate(),
    googleAuth.authorize(['admin']),
    validate([
      body('email').isEmail().withMessage('valid email required'),
      body('roleName').notEmpty().withMessage('roleName required')
    ]),
    async (req, res) => {
      try {
        const { email, roleName, hospital_id } = req.body || {};
        if (!db.connected) {
          return res.status(503).json({ error: 'Database unavailable' });
        }
        const roleRs = await db.query("SELECT TOP 1 id FROM scheduler.roles WHERE name=@name AND (@hid IS NULL OR hospital_id=@hid)", { name: roleName, hid: hospital_id || null });
        if (!roleRs.recordset || roleRs.recordset.length === 0) return res.status(404).json({ error: 'Role not found' });
        const roleId = roleRs.recordset[0].id;

        const uRs = await db.query("SELECT TOP 1 id FROM scheduler.users WHERE email=@email", { email });
        let userId = uRs.recordset && uRs.recordset[0] && uRs.recordset[0].id;
        if (!userId) {
          const [first] = (email || '').split('@');
          const [firstNameDefault, ...restDefault] = (first || '').split(/[._-]/).filter(Boolean);
          const lastNameDefault = restDefault.join(' ') || '';
          const first_name = (req.body.first_name || req.body.firstName || '').trim() || firstNameDefault || first || email;
          const last_name = (req.body.last_name || req.body.lastName || '').trim() || lastNameDefault;
          const employee_id = email.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 50);
          const newUser = { employee_id, email, first_name, last_name, is_active: 1, last_login: new Date() };
          if (req.body.department_id) newUser.department_id = req.body.department_id;
          else if (req.body.department_code) {
            try {
              const dRs = await db.query('SELECT TOP 1 id FROM scheduler.departments WHERE code=@code', { code: req.body.department_code });
              if (dRs.recordset && dRs.recordset.length) newUser.department_id = dRs.recordset[0].id;
            } catch (_) {}
          }
          const created = await repositories.users.create(newUser);
          userId = created.id;
        }
        await db.query("UPDATE scheduler.users SET role_id=@roleId WHERE id=@id", { roleId, id: userId });
        return res.json({ updated: true, upserted: true });
      } catch (e) { return res.status(500).json({ error: 'Failed to assign role' }); }
    }
  );


  // Status endpoint - requires authentication
  router.get('/admin/status', 
    googleAuth.authenticate(), 
    googleAuth.authorize(['admin', 'supervisor']),
    async (req, res) => {
    try {
      // Check database connection status
      let dbConnected = false;
      let dbHealth = null;
      
      if (db) {
        // Check if database has a connection
        if (db.connected === true) {
          dbConnected = true;
          dbHealth = { healthy: true, mode: 'connected' };
        } else {
          dbConnected = false;
          dbHealth = { healthy: false, error: 'Not connected' };
        }
      } else {
        dbConnected = false;
        dbHealth = { healthy: false, error: 'Database not configured' };
      }
      
      res.json({ 
        database_connected: dbConnected,
        database_health: dbHealth,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      console.error('Status check error:', e);
      res.status(500).json({ error: 'Failed to check status' });
    }
  });

  // Settings: system status
  router.get('/admin/settings', googleAuth.authenticate(), googleAuth.authorize(['admin']), async (req, res) => {
    try {
      // Check database connection status
      let dbConnected = false;
      let dbHealth = null;
      
      if (db) {
        // Check if database has a connection and health check method
        if (db.connected === true) {
          // Database claims to be connected, verify with health check
          try {
            if (typeof db.healthCheck === 'function') {
              dbHealth = await db.healthCheck();
              dbConnected = dbHealth && dbHealth.healthy === true;
            } else {
              // No healthCheck method, but connected flag is true
              dbConnected = true;
              dbHealth = { healthy: true, mode: 'connected' };
            }
          } catch (e) {
            // Health check failed, connection might be stale
            dbConnected = false;
            dbHealth = { healthy: false, error: 'Health check failed' };
          }
        } else if (db.connected === false) {
          // Database explicitly not connected
          dbConnected = false;
          dbHealth = { healthy: false, error: 'Not connected' };
        } else {
          // Database connection status unknown, assume not connected
          dbConnected = false;
          dbHealth = { healthy: false, error: 'Connection status unknown' };
        }
      } else {
        dbConnected = false;
        dbHealth = { healthy: false, error: 'Database not configured' };
      }
      
      // Check Redis availability
      let redisAvailable = false;
      try { redisAvailable = cacheService?.client?.status === 'ready'; } catch (_) { redisAvailable = false; }

      // Load persisted admin settings (non-PHI, small config)
      let adminSettings = {};
      try {
        const s = await cacheService.get('system_settings', { userId: 'global' });
        if (s && typeof s === 'object') adminSettings = s;
      } catch (_) {}
      
      res.json({ 
        database_connected: dbConnected,
        database_health: dbHealth,
        redis_available: redisAvailable,
        active_sessions: 0, // This would need session tracking
        maintenance_mode: Boolean(adminSettings.maintenance_mode),
        allow_registration: Boolean(adminSettings.allow_registration)
      });
    } catch (e) { 
      console.error('Admin settings error:', e);
      res.status(500).json({ error: 'Failed to load settings' }); 
    }
  });

  // Settings: save
  router.put('/admin/settings', googleAuth.authenticate(), googleAuth.authorize(['admin']), async (req, res) => {
    try {
      const body = req.body || {};
      const toSave = {
        maintenance_mode: Boolean(body.maintenance_mode),
        allow_registration: Boolean(body.allow_registration)
      };
      try {
        await cacheService.set('system_settings', { userId: 'global' }, toSave, { ttl: 0 });
      } catch (e) {
        console.error('Failed to persist admin settings:', e);
        return res.status(500).json({ error: 'Failed to save settings' });
      }
      return res.json({ saved: true, settings: toSave });
    } catch (e) {
      return res.status(500).json({ error: 'Failed to save settings' });
    }
  });


  return router;
};
