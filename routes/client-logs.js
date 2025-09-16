const express = require('express');
const fs = require('fs');
const path = require('path');

module.exports = function createClientLogsRouter() {
  const router = express.Router();
  const logsDir = path.join(__dirname, '..', 'logs');

  // Ensure logs directory exists
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  const clientLogFile = path.join(logsDir, `client-debug-${new Date().toISOString().split('T')[0]}.log`);

  // Endpoint to receive client logs
  router.post('/client-logs', (req, res) => {
    try {
      const { logs } = req.body;
      if (!logs || !Array.isArray(logs)) {
        return res.status(400).json({ error: 'Invalid logs format' });
      }

      // Append logs to file
      const stream = fs.createWriteStream(clientLogFile, { flags: 'a' });
      logs.forEach(log => {
        stream.write(JSON.stringify(log) + '\n');
      });
      stream.end();

      res.json({ received: logs.length });
    } catch (error) {
      console.error('Error saving client logs:', error);
      res.status(500).json({ error: 'Failed to save logs' });
    }
  });

  return router;
};