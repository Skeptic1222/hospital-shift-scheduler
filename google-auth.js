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
  return async (req, res, next) => {
    try {
      const auth = req.headers.authorization || '';
      if (!auth.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const token = auth.slice(7);
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
      // SECURITY: no soft fallback; require valid Google ID token
      console.error('Authentication error:', err);
      return res.status(401).json({ error: 'Unauthorized' });
    }
  };
}

function authorize(requiredRoles = []) {
  return async (req, res, next) => {
    if (!requiredRoles || requiredRoles.length === 0) return next();
    
    try {
      // SECURITY: Check roles from database
      const userEmail = req.user?.email;
      
      if (!userEmail) {
        return res.status(403).json({ error: 'Forbidden: No user email' });
      }
      
      let userRoles = new Set(req.user?.roles || []);
      
      // Get roles from database
      try {
          const { db } = require('./db-config');
          if (db.connected) {
            const result = await db.query(`
              SELECT r.name as role_name
              FROM scheduler.users u
              LEFT JOIN scheduler.roles r ON u.role_id = r.id
              WHERE u.email = @email AND u.is_active = 1
            `, { email: userEmail });
            
            if (result.recordset && result.recordset.length > 0) {
              const dbRole = result.recordset[0].role_name;
              if (dbRole) userRoles.add(dbRole);
            }
          }
      } catch (dbError) {
        try {
          const { logger } = require('./logger-config');
          logger.error('Authz role lookup failed', { error: dbError?.message });
        } catch (_) {
          console.error('Error fetching user roles from database:', dbError);
        }
      }
      
      // Fallback: treat configured admin emails as admins (no demo mode)
      try {
        const adminsEnv = (process.env.ADMIN_EMAILS || 'sop1973@gmail.com')
          .split(',')
          .map(s => s.trim().toLowerCase())
          .filter(Boolean);
        if (adminsEnv.includes(userEmail.toLowerCase())) {
          userRoles.add('admin');
        }
      } catch (_) {}

      // Admin role has access to everything
      if (userRoles.has('admin')) return next();
      
      // Check if user has any required role
      const allowed = requiredRoles.some(r => userRoles.has(r));
      if (!allowed) {
        try {
          const { logger } = require('./logger-config');
          logger.warn('Authz denied', { email: userEmail, required: requiredRoles, roles: Array.from(userRoles) });
        } catch (_) {}
        return res.status(403).json({ 
          error: 'Forbidden',
          message: `Required roles: ${requiredRoles.join(', ')}. Your roles: ${Array.from(userRoles).join(', ')}`
        });
      }
      
      // Store roles in request for later use
      req.user.roles = Array.from(userRoles);
      next();
    } catch (error) {
      try {
        const { logger } = require('./logger-config');
        logger.error('Authorization error', { error: error?.message });
      } catch (_) { console.error('Authorization error:', error); }
      return res.status(500).json({ error: 'Authorization check failed' });
    }
  };
}

module.exports = {
  authenticate,
  authorize,
  verifyGoogleIdToken,
  softAuthenticate,
  handleGoogleAuth
};

function softAuthenticate() {
  const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  return async (req, _res, next) => {
    try {
      const auth = req.headers.authorization || '';
      if (!auth.startsWith('Bearer ')) return next();
      const token = auth.slice(7);
      const info = await verifyGoogleIdToken(token, clientId).catch(() => null);
      if (info) {
        req.user = {
          sub: info.sub,
          email: info.email,
          email_verified: info.email_verified === 'true' || info.email_verified === true,
          name: info.name,
          picture: info.picture,
          roles: []
        };
      }
      return next();
    } catch (_) {
      return next();
    }
  };
}

// Handle Google authentication login
async function handleGoogleAuth(req, res) {
  try {
    const { credential, password } = req.body;
    const jwt = require('jsonwebtoken');
    
    // SECURITY FIX: Remove demo password bypass
    // Never accept passwords in Google OAuth flow
    if (password) {
      return res.status(400).json({ 
        error: 'Invalid authentication method',
        message: 'Google authentication does not use passwords' 
      });
    }
    
    if (!credential) {
      return res.status(400).json({ error: 'Missing credential' });
    }

    // Production: Verify with Google
    const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return res.status(500).json({ error: 'Google client ID not configured' });
    }
    
    const info = await verifyGoogleIdToken(credential, clientId);
    
    // Generate session token
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) {
      console.error('JWT_SECRET not configured or too weak');
      return res.status(500).json({ error: 'Server configuration error' });
    }
    
    const token = jwt.sign(
      { 
        sub: info.sub,
        email: info.email,
        name: info.name,
        picture: info.picture,
        email_verified: info.email_verified
      },
      secret,
      { expiresIn: '24h' }
    );
    
    res.json({ 
      access_token: token,
      user: {
        email: info.email,
        name: info.name,
        picture: info.picture,
        email_verified: info.email_verified
      }
    });
  } catch (error) {
    console.error('Google auth error:', error);
    // SECURITY FIX: Don't expose internal error details
    res.status(401).json({ error: 'Authentication failed' });
  }
}
