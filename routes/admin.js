const express = require('express');

module.exports = function createAdminRouter({ googleAuth, repositories, db, demo, validate, body, isDemo, setDemoOverride }) {
  const router = express.Router();

  // List roles
  router.get('/admin/roles', googleAuth.authenticate(), googleAuth.authorize(['admin']), async (req, res) => {
    try {
      if (process.env.SKIP_EXTERNALS === 'true' || !db.connected) {
        return res.json({ roles: [ { name: 'admin' }, { name: 'supervisor' }, { name: 'user' } ] });
      }
      const rs = await db.query("SELECT name FROM scheduler.roles ORDER BY name");
      return res.json({ roles: rs.recordset || [] });
    } catch (e) { return res.status(500).json({ error: 'Failed to load roles' }); }
  });

  // Seed default roles
  router.post('/admin/roles/seed', googleAuth.authenticate(), googleAuth.authorize(['admin']), async (req, res) => {
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
        if (process.env.SKIP_EXTERNALS === 'true' || !db.connected) {
          try { demo.ensureSeeded(); } catch (_) {}
          try {
            const r = demo.upsertStaff({
              email,
              first_name: req.body.first_name || req.body.firstName,
              last_name: req.body.last_name || req.body.lastName,
              department_code: req.body.department_code,
              roleName
            });
            return res.json({ updated: true, upserted: r.upserted, user: r.user });
          } catch (_) {
            return res.json({ updated: true, upserted: true });
          }
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

  // Demo seeds
  router.post('/seed/radtechs', googleAuth.authenticate(), googleAuth.authorize(['admin']), async (req, res) => {
    try {
      if (process.env.SKIP_EXTERNALS === 'true') {
        const count = parseInt(req.body?.count) || 20;
        const staff = demo.seedStaff(count);
        return res.json({ seeded: staff.length });
      }
      return res.status(501).json({ error: 'Not Implemented' });
    } catch (e) { return res.status(500).json({ error: 'Failed to seed' }); }
  });

  router.post('/seed/shifts', googleAuth.authenticate(), googleAuth.authorize(['admin']), async (req, res) => {
    try {
      if (process.env.SKIP_EXTERNALS === 'true') {
        const count = parseInt(req.body?.count) || 40;
        const seeded = demo.seedShifts(count);
        return res.json({ seeded: seeded.length });
      }
      return res.status(501).json({ error: 'Not Implemented' });
    } catch (e) { return res.status(500).json({ error: 'Failed to seed shifts' }); }
  });

  // Settings: demo/live toggle
  router.get('/admin/settings', googleAuth.authenticate(), googleAuth.authorize(['admin']), async (req, res) => {
    try {
      const envDemo = process.env.SKIP_EXTERNALS === 'true';
      const current = isDemo && isDemo();
      const override = (isDemo && isDemo()) !== envDemo;
      res.json({ demo_mode: current, override, source: override ? 'override' : (envDemo ? 'env:true' : 'env:false') });
    } catch (e) { res.status(500).json({ error: 'Failed to load settings' }); }
  });

  router.put('/admin/settings', googleAuth.authenticate(), googleAuth.authorize(['admin']), validate([
    body('demo_mode').isBoolean().withMessage('demo_mode must be boolean')
  ]), async (req, res) => {
    try {
      const toDemo = !!req.body.demo_mode;
      if (setDemoOverride) setDemoOverride(toDemo);
      // If switching to live and DB not connected, try to connect now
      if (!toDemo && !db.connected) {
        try { await db.connect(); } catch (err) { return res.status(500).json({ error: 'DB connect failed', detail: err.message }); }
      }
      res.json({ ok: true, demo_mode: toDemo });
    } catch (e) { res.status(500).json({ error: 'Failed to update settings' }); }
  });

  return router;
};
