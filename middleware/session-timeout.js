/**
 * Session Timeout Middleware
 * HIPAA-compliant automatic session timeout
 */

class SessionTimeoutManager {
  constructor(options = {}) {
    this.timeoutMinutes = options.timeoutMinutes || 15; // HIPAA requirement
    this.warningMinutes = options.warningMinutes || 2;  // Warning before timeout
    this.sessions = new Map();
    
    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 60000); // Check every minute
  }

  /**
   * Middleware for session timeout
   */
  middleware() {
    return (req, res, next) => {
      // Skip for non-authenticated requests
      if (!req.user) {
        return next();
      }

      const sessionId = req.sessionID || req.user.sub || req.user.id;
      const now = Date.now();
      
      // Get or create session
      let session = this.sessions.get(sessionId);
      if (!session) {
        session = {
          id: sessionId,
          userId: req.user.id || req.user.sub,
          createdAt: now,
          lastActivity: now,
          warningShown: false
        };
        this.sessions.set(sessionId, session);
      }

      // Check if session has expired
      const timeSinceActivity = now - session.lastActivity;
      const timeoutMs = this.timeoutMinutes * 60 * 1000;
      const warningMs = (this.timeoutMinutes - this.warningMinutes) * 60 * 1000;

      if (timeSinceActivity > timeoutMs) {
        // Session expired
        this.sessions.delete(sessionId);
        return res.status(401).json({
          error: 'SESSION_EXPIRED',
          message: 'Your session has expired due to inactivity. Please log in again.',
          code: 'HIPAA_TIMEOUT'
        });
      }

      // Add warning header if approaching timeout
      if (timeSinceActivity > warningMs && !session.warningShown) {
        const remainingMinutes = Math.ceil((timeoutMs - timeSinceActivity) / 60000);
        res.setHeader('X-Session-Warning', `Session expires in ${remainingMinutes} minutes`);
        res.setHeader('X-Session-Timeout', this.timeoutMinutes);
        res.setHeader('X-Session-Remaining', remainingMinutes);
        session.warningShown = true;
      }

      // Update last activity
      session.lastActivity = now;
      session.warningShown = false;

      // Add session info to request
      req.session = {
        ...session,
        remainingTime: timeoutMs - timeSinceActivity,
        isExpiringSoon: timeSinceActivity > warningMs
      };

      next();
    };
  }

  /**
   * Clean up expired sessions
   */
  cleanupExpiredSessions() {
    const now = Date.now();
    const timeoutMs = this.timeoutMinutes * 60 * 1000;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastActivity > timeoutMs) {
        this.sessions.delete(sessionId);
        console.log(`Session expired: ${sessionId}`);
      }
    }
  }

  /**
   * Extend session manually
   */
  extendSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = Date.now();
      session.warningShown = false;
      return true;
    }
    return false;
  }

  /**
   * Force logout
   */
  terminateSession(sessionId) {
    return this.sessions.delete(sessionId);
  }

  /**
   * Get active sessions count
   */
  getActiveSessions() {
    return this.sessions.size;
  }

  /**
   * Get session info
   */
  getSessionInfo(sessionId) {
    return this.sessions.get(sessionId);
  }
}

// Export singleton
module.exports = new SessionTimeoutManager();