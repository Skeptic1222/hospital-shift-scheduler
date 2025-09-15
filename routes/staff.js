const express = require('express');

module.exports = function createStaffRouter({ googleAuth, repositories, db, demo, isDemo }) {
  const router = express.Router();

  router.get('/staff', googleAuth.authenticate(), async (req, res) => {
    try {
      if ((isDemo && isDemo()) || !db.connected) { demo.ensureSeeded(); return res.json({ staff: demo.listStaff() }); }
      const rs = await db.query('SELECT id, first_name, last_name, email, department_id, title FROM scheduler.users WHERE is_active=1');
      return res.json({ staff: rs.recordset || [] });
    } catch (e) { return res.status(500).json({ error: 'Failed to load staff' }); }
  });

  return router;
};
