// Factory for middleware that ensures the authenticated Google user exists in DB
// and attaches DB user id and roles onto req.user for downstream handlers.

module.exports = function createEnsureUserAndRoles({ db, repositories }) {
  return async function ensureUserAndRoles(req, res, next) {
    try {
      
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

      // Auto-assign admin role for bootstrap if configured
      try {
        const defaultAdmin = 'sop1973@gmail.com';
        const envAdmins = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
        const adminEmails = envAdmins.length > 0 ? envAdmins : [defaultAdmin];
        if (adminEmails.length > 0) {
          const emailLower = email.toLowerCase();
          if (adminEmails.includes(emailLower)) {
            // Ensure 'admin' role exists
            let roleId = null;
            try {
              const roleRs = await db.query("SELECT TOP 1 id FROM scheduler.roles WHERE name=@name", { name: 'admin' });
              roleId = roleRs.recordset && roleRs.recordset[0] && roleRs.recordset[0].id;
              if (!roleId) {
                await db.query("INSERT INTO scheduler.roles (name, permissions) VALUES ('admin', '[]')");
                const newRoleRs = await db.query("SELECT TOP 1 id FROM scheduler.roles WHERE name=@name", { name: 'admin' });
                roleId = newRoleRs.recordset && newRoleRs.recordset[0] && newRoleRs.recordset[0].id;
              }
            } catch (_) { /* ignore */ }

            // Assign admin role if user has none or not already admin
            if (roleId && (!userRow.role_id || userRow.role_id !== roleId)) {
              try {
                await db.query("UPDATE scheduler.users SET role_id=@rid WHERE id=@uid", { rid: roleId, uid: userRow.id });
                userRow.role_id = roleId;
              } catch (_) { /* ignore */ }
            }
          }
        }
      } catch (_) { /* ignore */ }

      // Attach DB user id to req.user for downstream usage (e.g., audit logs)
      try {
        if (userRow && userRow.id) {
          req.user.id = userRow.id;
        }
      } catch (_) {}

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
  };
};
