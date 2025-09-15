const express = require('express');

module.exports = function createHealthRouter({ cacheService, db, isDemo }) {
  const router = express.Router();

  router.get('/health', async (req, res) => {
    try {
      if (isDemo && isDemo()) {
        return res.json({
          status: 'degraded',
          timestamp: new Date().toISOString(),
          services: {
            database: { healthy: false, skipped: true },
            cache: { connected: false, skipped: true },
            notifications: { connected: true }
          }
        });
      }
      const dbHealth = await db.healthCheck();
      const cacheConnected = cacheService.client.status === 'ready';
      res.json({
        status: dbHealth.healthy && cacheConnected ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        services: { database: dbHealth, cache: { connected: cacheConnected }, notifications: { connected: true } }
      });
    } catch (err) {
      res.status(500).json({ status: 'unhealthy', error: err.message });
    }
  });

  return router;
};
