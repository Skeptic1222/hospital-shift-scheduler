const express = require('express');

module.exports = function createAuthRouter({ googleAuth, cacheService }) {
  const router = express.Router();

  router.post('/auth/login', (req, res) => res.status(501).json({ error: 'Not Implemented' }));

  router.post('/auth/refresh', googleAuth.authenticate(), async (req, res) => {
    try { res.json({ message: 'Token refreshed' }); } catch { res.status(401).json({ error: 'Token refresh failed' }); }
  });

  router.post('/auth/logout', googleAuth.authenticate(), async (req, res) => {
    try { await cacheService.del('session', { userId: req.user.sub }); res.json({ success: true }); } catch { res.status(500).json({ error: 'Logout failed' }); }
  });

  return router;
};

