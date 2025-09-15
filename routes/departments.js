const express = require('express');

module.exports = function createDepartmentsRouter({ googleAuth, repositories, db, demo, isDemo }) {
  const router = express.Router();

  router.get('/departments', googleAuth.authenticate(), async (req, res) => {
    try {
      if ((isDemo && isDemo()) || !db.connected) {
        const list = (demo.departments || []).map(d => ({ id: d.code, code: d.code, name: d.name }));
        return res.json({ departments: list });
      }
      const rs = await repositories.departments.findAll({}, { orderBy: 'name ASC' });
      return res.json({ departments: rs || [] });
    } catch (e) { return res.status(500).json({ error: 'Failed to load departments' }); }
  });

  return router;
};
