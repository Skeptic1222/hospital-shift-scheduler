const express = require('express');

module.exports = function createOncallRouter({ googleAuth, db, repositories, demo, validate, body, isDemo }) {
  const router = express.Router();

  router.get('/oncall', googleAuth.authenticate(), async (req, res) => {
    try {
      const view = (req.query.view || 'day').toLowerCase();
      const date = req.query.date || new Date().toISOString().slice(0,10);
      if (isDemo && isDemo()) {
        if (view === 'day') return res.json({ date, assignments: demo.getOnCall({ date }) });
        const d = new Date(date);
        let start = new Date(d); let end = new Date(d);
        if (view === 'week') { const day = d.getUTCDay(); start.setUTCDate(d.getUTCDate() - day); end.setUTCDate(start.getUTCDate() + 6); }
        else if (view === 'month') { start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)); end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth()+1, 0)); }
        return res.json({ view, range: { start: start.toISOString().slice(0,10), end: end.toISOString().slice(0,10) }, assignments: demo.getOnCallRange({ startDate: start.toISOString().slice(0,10), endDate: end.toISOString().slice(0,10) }) });
      }
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
      if (isDemo && isDemo()) { demo.setOnCall({ date, department, userId, notes }); return res.json({ saved: true }); }
      return res.status(501).json({ error: 'Not Implemented' });
    } catch (e) { return res.status(500).json({ error: 'Failed to save on-call' }); }
  });

  return router;
};
