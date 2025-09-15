const express = require('express');

module.exports = function createQueueRouter({ googleAuth, fcfsScheduler, validate, body, isDemo }) {
  const router = express.Router();

  router.post('/queue/open-shift', googleAuth.authenticate(), googleAuth.authorize(['admin','supervisor']), validate([
    body('shift_id').notEmpty().withMessage('shift_id required'),
    body('reason').optional().isString(),
    body('urgency_level').optional().isInt({ min: 1, max: 5 }),
    body('expires_in_hours').optional().isInt({ min: 1 })
  ]), async (req, res) => {
    try {
      if (isDemo && isDemo()) return res.json({ success: true, openShiftId: 'mock-open-' + Date.now(), queueSize: 0, firstWindowStart: new Date().toISOString() });
      const { shift_id, reason, urgency_level, expires_in_hours } = req.body;
      const result = await fcfsScheduler.postOpenShift({ shiftId: shift_id, requestedBy: req.user.sub, reason, urgencyLevel: urgency_level, expiresInHours: expires_in_hours });
      res.json(result);
    } catch (error) { res.status(500).json({ error: 'Failed to post open shift' }); }
  });

  router.post('/queue/respond', googleAuth.authenticate(), validate([
    body('queue_entry_id').notEmpty().withMessage('queue_entry_id required'),
    body('response').isIn(['accepted','declined']).withMessage('response must be accepted or declined')
  ]), async (req, res) => {
    try {
      if (isDemo && isDemo()) return res.json({ success: true, response: req.body?.response || 'accepted' });
      const { queue_entry_id, response } = req.body;
      const result = await fcfsScheduler.respondToShiftOffer({ queueEntryId: queue_entry_id, userId: req.user.sub, response });
      res.json(result);
    } catch (error) { res.status(500).json({ error: 'Failed to respond to shift offer' }); }
  });

  router.get('/queue/status/:openShiftId', googleAuth.authenticate(), async (req, res) => {
    try {
      if (isDemo && isDemo()) {
        const now = new Date();
        const windowEnd = new Date(now.getTime() + 15 * 60 * 1000);
        return res.json({ queue_size: 5, current_window: { user: 'Demo Nurse', position: 1, expires_at: windowEnd.toISOString() }, your_position: 3, estimated_wait: 30 });
      }
      const status = await fcfsScheduler.getQueueStatus(req.params.openShiftId);
      res.json(status);
    } catch (error) { res.status(500).json({ error: 'Failed to get queue status' }); }
  });

  return router;
};
