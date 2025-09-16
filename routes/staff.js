// ⚠️ CRITICAL WARNING: NEVER ADD DEMO MODE TO THIS APPLICATION
// The client has explicitly forbidden ANY form of demo, mock, or test mode.
// This application REQUIRES a live database connection to function.
// DO NOT add any demo mode, mock data, or bypass mechanisms.

const express = require('express');

module.exports = function createStaffRouter({ googleAuth, repositories, db }) {
  const router = express.Router();

  router.get('/staff', googleAuth.authenticate(), async (req, res) => {
    try {
      if (!db.connected) { return res.status(503).json({ error: 'Database unavailable' }); }
      // Include role information in the query
      const rs = await db.query(`
        SELECT 
          u.id, u.first_name, u.last_name, u.email, 
          u.department_id, u.title,
          r.name as role
        FROM scheduler.users u
        LEFT JOIN scheduler.roles r ON u.role_id = r.id
        WHERE u.is_active=1
      `);
      return res.json({ staff: rs.recordset || [] });
    } catch (e) { return res.status(500).json({ error: 'Failed to load staff' }); }
  });

  return router;
};
