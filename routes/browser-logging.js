const express = require('express');

module.exports = function createBrowserLoggingRouter({ logger }) {
  const router = express.Router();

  // Endpoint to receive browser errors and logs
  router.post('/browser-log', async (req, res) => {
    try {
      const { level = 'error', message, error, stackTrace, url, userAgent, timestamp, metadata = {} } = req.body;
      
      // Log to appropriate logger based on level
      const logData = {
        source: 'browser',
        url,
        userAgent: userAgent || req.get('user-agent'),
        timestamp: timestamp || new Date().toISOString(),
        ...metadata
      };

      switch (level.toLowerCase()) {
        case 'error':
          logger.error(`Browser Error: ${message}`, null, {
            ...logData,
            error: error,
            stackTrace: stackTrace
          });
          break;
        case 'warn':
          logger.warn(`Browser Warning: ${message}`, logData);
          break;
        case 'info':
          logger.info(`Browser Info: ${message}`, logData);
          break;
        default:
          logger.debug(`Browser Debug: ${message}`, logData);
      }

      res.status(200).json({ received: true });
    } catch (err) {
      console.error('Failed to log browser error:', err);
      res.status(500).json({ error: 'Failed to log browser error' });
    }
  });

  // Endpoint to receive Content Security Policy violations
  router.post('/csp-report', async (req, res) => {
    try {
      const report = req.body['csp-report'] || req.body;
      
      logger.warn('CSP Violation', {
        source: 'browser-csp',
        documentUri: report['document-uri'],
        violatedDirective: report['violated-directive'],
        blockedUri: report['blocked-uri'],
        sourceFile: report['source-file'],
        lineNumber: report['line-number'],
        columnNumber: report['column-number']
      });

      res.status(204).send();
    } catch (err) {
      console.error('Failed to log CSP report:', err);
      res.status(500).json({ error: 'Failed to log CSP report' });
    }
  });

  return router;
};