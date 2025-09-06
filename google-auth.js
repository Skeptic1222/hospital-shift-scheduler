/**
 * Google OAuth verification middleware
 * Verifies Google ID tokens and attaches user info to req.user
 */

const axios = require('axios');

const GOOGLE_TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';

async function verifyGoogleIdToken(idToken, expectedAud) {
  // Fast path: minimal structural check
  if (!idToken || typeof idToken !== 'string' || idToken.split('.').length !== 3) {
    throw new Error('Invalid token');
  }
  // Call Google tokeninfo endpoint (sufficient for server-side verification)
  const res = await axios.get(GOOGLE_TOKENINFO_URL, { params: { id_token: idToken } });
  const data = res.data || {};
  if (expectedAud && data.aud !== expectedAud) {
    throw new Error('Token audience mismatch');
  }
  // exp is seconds since epoch
  const now = Math.floor(Date.now() / 1000);
  if (data.exp && Number(data.exp) < now) {
    throw new Error('Token expired');
  }
  return data;
}

function authenticate() {
  const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  const skipExternals = process.env.SKIP_EXTERNALS === 'true';
  return async (req, res, next) => {
    try {
      const auth = req.headers.authorization || '';
      if (!auth.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const token = auth.slice(7);
      if (skipExternals) {
        // Minimal decode for local/dev: accept any token and attach basic user
        try {
          const payload = JSON.parse(Buffer.from(token.split('.')[1] || '', 'base64').toString('utf8'));
          req.user = {
            sub: payload.sub || 'local-user',
            email: payload.email || 'user@example.com',
            name: payload.name || 'Local User',
            picture: payload.picture,
            roles: payload.roles || []
          };
        } catch (_) {
          req.user = { sub: 'local-user', email: 'user@example.com', name: 'Local User', roles: [] };
        }
        return next();
      }
      const info = await verifyGoogleIdToken(token, clientId);
      req.user = {
        sub: info.sub,
        email: info.email,
        email_verified: info.email_verified === 'true' || info.email_verified === true,
        name: info.name,
        picture: info.picture,
        roles: []
      };
      return next();
    } catch (err) {
      return res.status(401).json({ error: 'Unauthorized', detail: err.message });
    }
  };
}

function authorize(requiredRoles = []) {
  return (req, res, next) => {
    if (!requiredRoles || requiredRoles.length === 0) return next();
    const adminEnv = (process.env.ADMIN_EMAILS || '').trim();
    const supervisorEnv = (process.env.SUPERVISOR_EMAILS || '').trim();
    const defaultAdmins = ['sop1973@gmail.com'];
    const adminEmails = adminEnv.length ? adminEnv.split(',').map(s => s.trim()).filter(Boolean) : defaultAdmins;
    const supervisorEmails = supervisorEnv.length ? supervisorEnv.split(',').map(s => s.trim()).filter(Boolean) : [];
    const userRoles = new Set(req.user?.roles || []);
    if (req.user?.email) {
      if (adminEmails.includes(req.user.email)) userRoles.add('admin');
      if (supervisorEmails.includes(req.user.email)) userRoles.add('supervisor');
    }
    if (userRoles.has('admin')) return next();
    const allowed = requiredRoles.some(r => userRoles.has(r));
    if (!allowed) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}module.exports = {
  authenticate,
  authorize,
  verifyGoogleIdToken,
};





