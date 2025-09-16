/**
 * Centralized CORS configuration with no-port policy.
 */
const cors = require('cors');

function buildCorsOptions() {
  const defaultOrigins = ['http://localhost', 'https://localhost'];
  const env = (process.env.ALLOWED_ORIGINS || defaultOrigins.join(',')).split(',').map(s => s.trim()).filter(Boolean);
  const allowed = new Set(env);

  return {
    origin(origin, callback) {
      if (!origin || allowed.has(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  };
}

const corsOptions = buildCorsOptions();
const corsMiddleware = cors(corsOptions);

module.exports = { buildCorsOptions, corsOptions, corsMiddleware };

