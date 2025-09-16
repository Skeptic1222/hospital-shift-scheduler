const express = require('express');

module.exports = function createHealthRouter({ cacheService, db }) {
  const router = express.Router();

  router.get('/health', async (req, res) => {
    try {
      const dbHealth = await db.healthCheck();
      const cacheConnected = cacheService.client.status === 'ready';
      res.json({
        status: dbHealth.healthy && cacheConnected ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        services: { database: dbHealth, cache: { connected: cacheConnected }, notifications: { connected: true } }
      });
    } catch (err) {
      // SECURITY FIX: Don't expose internal error details
      console.error('Health check error:', err);
      res.status(500).json({ status: 'unhealthy' });
    }
  });

  return router;
};
