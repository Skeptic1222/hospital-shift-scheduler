const express = require('express');

module.exports = function createOncallRouter({ googleAuth, db, repositories, validate, body }) {
  const router = express.Router();

  router.get('/oncall', googleAuth.authenticate(), async (req, res) => {
    try {
      const view = (req.query.view || 'day').toLowerCase();
      const date = req.query.date || new Date().toISOString().slice(0,10);
      return res.status(501).json({ error: 'Not Implemented' });
    } catch (e) { return res.status(500).json({ error: 'Failed to load on-call' }); }
  });

  router.post('/oncall', googleAuth.authenticate(), googleAuth.authorize(['admin','supervisor']), validate([
    body('date').notEmpty().isISO8601().withMessage('date required (ISO8601)'),
    body('department').notEmpty().withMessage('department required'),
    body('userId').notEmpty().withMessage('userId required')
  ]), async (req, res) => {
    try {
      const { date, department, userId, notes } = req.body || {};
      return res.status(501).json({ error: 'Not Implemented' });
    } catch (e) { return res.status(500).json({ error: 'Failed to save on-call' }); }
  });

  return router;
};
