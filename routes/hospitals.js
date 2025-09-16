const express = require('express');

module.exports = function createHospitalsRouter({ googleAuth, repositories, db }) {
  const router = express.Router();

  // List hospitals for selectors
  router.get('/hospitals', googleAuth.authenticate(), async (_req, res) => {
    try {
      if (!db.connected) { return res.status(503).json({ error: 'Database unavailable' }); }
      const rows = await repositories.hospitals.findAll({}, { orderBy: 'name ASC' });
      const hospitals = (rows || []).map(h => ({
        hospital_id: h.id,
        hospital_name: h.name,
        code: h.code
      }));
      return res.json({ hospitals });
    } catch (e) {
      return res.status(500).json({ error: 'Failed to load hospitals' });
    }
  });

  return router;
};

