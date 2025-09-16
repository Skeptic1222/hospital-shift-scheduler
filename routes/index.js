// ⚠️ CRITICAL WARNING: NEVER ADD DEMO MODE TO THIS APPLICATION
// The client has explicitly forbidden ANY form of demo, mock, or test mode.
// This application REQUIRES a live database connection to function.
// DO NOT add any demo mode, mock data, or bypass mechanisms.

const express = require('express');

module.exports = function createApiRouters(deps) {
  const router = express.Router();

  router.use(require('./health')(deps));
  // Serve PWA icons via API fallback when static files are missing
  try { router.use(require('./assets')(deps)); } catch (_) {}
  router.use(require('./auth')(deps));
  router.use(require('./departments')(deps));
  router.use(require('./staff')(deps));
  router.use(require('./hospitals')(deps));
  router.use(require('./admin')(deps));
  router.use(require('./admin-users')(deps));
  // admin-users-fixed removed (legacy)
  router.use(require('./notifications')(deps));
  router.use(require('./queue')(deps));
  router.use(require('./shifts')(deps));
  router.use(require('./oncall')(deps));
  router.use(require('./analytics')(deps));
  router.use(require('./settings')(deps));
  router.use(require('./users')(deps));
  router.use(require('./debug')(deps));
  
  // Browser error logging route (rate-limited)
  try {
    const { rateLimiters } = require('../middleware/security');
    const fileLogger = (function(){ try { return require('../logger-config').logger; } catch(_) { return console; } })();
    router.post('/browser-log', rateLimiters.logs, (req, res) => {
      const { level = 'error', message, stack, url, userAgent, timestamp, ...metadata } = req.body || {};
      const logData = {
        source: 'browser',
        message,
        stack,
        url,
        userAgent: userAgent || req.get('user-agent'),
        timestamp: timestamp || new Date().toISOString(),
        requestId: req.id,
        ...metadata
      };

      try {
        if (String(level).toLowerCase() === 'error') fileLogger.error('Browser error', logData);
        else fileLogger.info('Browser log', logData);
      } catch (_) { /* ignore */ }

      res.status(200).json({ received: true });
    });
  } catch (_) {
    const fileLogger = (function(){ try { return require('../logger-config').logger; } catch(_) { return console; } })();
    router.post('/browser-log', (req, res) => {
      const { level = 'error', message, stack, url, userAgent, timestamp, ...metadata } = req.body || {};
      const logData = {
        source: 'browser',
        message,
        stack,
        url,
        userAgent: userAgent || req.get('user-agent'),
        timestamp: timestamp || new Date().toISOString(),
        requestId: req.id,
        ...metadata
      };
      try {
        if (String(level).toLowerCase() === 'error') fileLogger.error('Browser error', logData);
        else fileLogger.info('Browser log', logData);
      } catch(_) {}
      res.status(200).json({ received: true });
    });
  }

  return router;
};
