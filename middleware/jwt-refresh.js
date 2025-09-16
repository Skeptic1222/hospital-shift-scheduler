/**
 * JWT Refresh Token Middleware
 * Implements secure token rotation for HIPAA compliance
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

class JWTRefreshService {
  constructor() {
    this.refreshTokens = new Map(); // In production, use Redis
    this.tokenExpiry = {
      access: '15m',  // Short-lived access tokens
      refresh: '7d',  // Longer refresh tokens
      remember: '30d' // Extended for "remember me"
    };
  }

  /**
   * Generate secure token pair
   */
  generateTokenPair(user, rememberMe = false) {
    const tokenId = crypto.randomBytes(16).toString('hex');
    
    // Access token with minimal claims
    const accessToken = jwt.sign(
      {
        sub: user.id || user.sub,
        email: user.email,
        roles: user.roles || [],
        type: 'access',
        jti: tokenId
      },
      process.env.JWT_SECRET || 'CHANGE_THIS_IN_PRODUCTION',
      {
        expiresIn: this.tokenExpiry.access,
        issuer: 'hospital-scheduler',
        audience: 'hospital-scheduler-api'
      }
    );

    // Refresh token with extended expiry
    const refreshToken = jwt.sign(
      {
        sub: user.id || user.sub,
        type: 'refresh',
        jti: tokenId,
        family: crypto.randomBytes(8).toString('hex')
      },
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'CHANGE_THIS_IN_PRODUCTION',
      {
        expiresIn: rememberMe ? this.tokenExpiry.remember : this.tokenExpiry.refresh,
        issuer: 'hospital-scheduler',
        audience: 'hospital-scheduler-refresh'
      }
    );

    // Store refresh token metadata
    this.refreshTokens.set(tokenId, {
      userId: user.id || user.sub,
      family: tokenId,
      createdAt: new Date(),
      lastUsed: new Date(),
      userAgent: null,
      ipAddress: null
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
      tokenType: 'Bearer'
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken, req) {
    try {
      // Verify refresh token
      const decoded = jwt.verify(
        refreshToken,
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET || 'CHANGE_THIS_IN_PRODUCTION',
        {
          issuer: 'hospital-scheduler',
          audience: 'hospital-scheduler-refresh'
        }
      );

      // Check if token is in our store
      const storedToken = this.refreshTokens.get(decoded.jti);
      if (!storedToken) {
        throw new Error('Invalid refresh token');
      }

      // Check for token reuse (potential theft)
      if (storedToken.revoked) {
        // Token family has been compromised
        this.revokeTokenFamily(decoded.family);
        throw new Error('Token reuse detected - all tokens revoked');
      }

      // Update last used
      storedToken.lastUsed = new Date();
      storedToken.userAgent = req.headers['user-agent'];
      storedToken.ipAddress = req.ip;

      // Generate new token pair (rotation)
      const user = {
        id: decoded.sub,
        sub: decoded.sub,
        roles: storedToken.roles || []
      };

      // Revoke old token
      storedToken.revoked = true;
      storedToken.revokedAt = new Date();

      // Issue new token pair
      return this.generateTokenPair(user);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Refresh token expired');
      }
      throw error;
    }
  }

  /**
   * Revoke all tokens in a family (compromised token)
   */
  revokeTokenFamily(family) {
    for (const [key, token] of this.refreshTokens.entries()) {
      if (token.family === family) {
        token.revoked = true;
        token.revokedAt = new Date();
        token.revokedReason = 'family_compromised';
      }
    }
  }

  /**
   * Revoke all tokens for a user
   */
  revokeUserTokens(userId) {
    for (const [key, token] of this.refreshTokens.entries()) {
      if (token.userId === userId) {
        token.revoked = true;
        token.revokedAt = new Date();
        token.revokedReason = 'user_logout';
      }
    }
  }

  /**
   * Clean up expired tokens
   */
  cleanupExpiredTokens() {
    const now = new Date();
    const expiryMs = 7 * 24 * 60 * 60 * 1000; // 7 days

    for (const [key, token] of this.refreshTokens.entries()) {
      const age = now - token.createdAt;
      if (age > expiryMs || token.revoked) {
        this.refreshTokens.delete(key);
      }
    }
  }

  /**
   * Middleware to handle token refresh
   */
  middleware() {
    return async (req, res, next) => {
      

      // Check for refresh endpoint
      if (req.path === '/api/auth/refresh' && req.method === 'POST') {
        try {
          const { refreshToken } = req.body;
          if (!refreshToken) {
            return res.status(400).json({ error: 'Refresh token required' });
          }

          const tokens = await this.refreshAccessToken(refreshToken, req);
          
          // Set secure cookie for refresh token
          res.cookie('refreshToken', tokens.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
          });

          return res.json({
            accessToken: tokens.accessToken,
            expiresIn: tokens.expiresIn,
            tokenType: tokens.tokenType
          });
        } catch (error) {
          console.error('Token refresh error:', error);
          return res.status(401).json({ error: 'Invalid refresh token' });
        }
      }

      next();
    };
  }

  /**
   * Validate access token
   */
  validateAccessToken(token) {
    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'CHANGE_THIS_IN_PRODUCTION',
        {
          issuer: 'hospital-scheduler',
          audience: 'hospital-scheduler-api'
        }
      );

      // Check if token has been revoked
      const tokenData = this.refreshTokens.get(decoded.jti);
      if (tokenData && tokenData.revoked) {
        throw new Error('Token has been revoked');
      }

      return decoded;
    } catch (error) {
      throw error;
    }
  }
}

// Singleton instance
const jwtRefreshService = new JWTRefreshService();

// Schedule cleanup every hour
setInterval(() => {
  jwtRefreshService.cleanupExpiredTokens();
}, 60 * 60 * 1000);

module.exports = jwtRefreshService;
