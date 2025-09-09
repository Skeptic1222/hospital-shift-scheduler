const { v4: uuidv4 } = require('uuid');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

module.exports = function requestLogger(req, res, next) {
  req.id = req.id || uuidv4();
  const start = Date.now();
  const { method, originalUrl } = req;
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0] || req.ip;

  logger.info({ evt: 'req:start', id: req.id, method, url: originalUrl, ip });
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({ evt: 'req:end', id: req.id, method, url: originalUrl, status: res.statusCode, duration });
  });
  next();
};

