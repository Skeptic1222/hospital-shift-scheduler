const express = require('express');

module.exports = function createDebugRouter({ googleAuth, db }) {
  const router = express.Router();

  // Admin-only diagnostics for shift creation prerequisites
  router.get('/debug/shift-create', googleAuth.authenticate(), googleAuth.authorize(['admin']), async (req, res) => {
    const out = { ts: new Date().toISOString() };
    try {
      out.dbConnected = !!db?.connected;
      if (!db?.connected) {
        return res.status(200).json(out);
      }
      const deps = await Promise.all([
        db.query('SELECT TOP 5 id, name, code FROM scheduler.departments ORDER BY name'),
        db.query('SELECT TOP 5 id, name, code FROM scheduler.hospitals ORDER BY name')
      ]);
      out.departments = (deps[0].recordset || []).map(r => ({ id: r.id, name: r.name, code: r.code }));
      out.hospitals = (deps[1].recordset || []).map(r => ({ id: r.id, name: r.name, code: r.code }));
      return res.json(out);
    } catch (e) {
      return res.status(200).json({ ...out, error: e?.message || String(e) });
    }
  });

  return router;
};

