/**
 * Auth0 Configuration with MFA for HIPAA Compliance
 * Implements secure authentication with multi-factor authentication
 */

const { expressjwt: jwt } = require('express-jwt');
const jwksRsa = require('jwks-rsa');
const { ManagementClient, AuthenticationClient } = require('auth0');
const crypto = require('crypto');

class Auth0Service {
    constructor(config) {
        this.config = config;
        
        // Management API client for user management
        this.management = new ManagementClient({
            domain: config.auth0Domain,
            clientId: config.auth0ClientId,
            clientSecret: config.auth0ClientSecret,
            scope: 'read:users update:users create:users delete:users read:user_idp_tokens'
        });

        // Authentication client for login/MFA
        this.auth = new AuthenticationClient({
            domain: config.auth0Domain,
            clientId: config.auth0ClientId,
            clientSecret: config.auth0ClientSecret
        });

        // JWT middleware configuration
        this.jwtCheck = jwt({
            secret: jwksRsa.expressJwtSecret({
                cache: true,
                rateLimit: true,
                jwksRequestsPerMinute: 5,
                jwksUri: `https://${config.auth0Domain}/.well-known/jwks.json`
            }),
            audience: config.auth0Audience,
            issuer: `https://${config.auth0Domain}/`,
            algorithms: ['RS256']
        });

        // Session encryption key
        this.sessionKey = crypto.randomBytes(32);
    }

    /**
     * Express middleware for authentication
     */
    authenticate() {
        return this.jwtCheck;
    }

    /**
     * Verify MFA requirement and enforce for healthcare workers
     */
    requireMFA() {
        return async (req, res, next) => {
            try {
                const userId = req.user.sub;
                const user = await this.management.getUser({ id: userId });
                
                // Check if user has MFA enabled
                const mfaEnrollments = await this.management.getUserEnrollments({ id: userId });
                
                if (!mfaEnrollments || mfaEnrollments.length === 0) {
                    // Force MFA enrollment for HIPAA compliance
                    return res.status(403).json({
                        error: 'MFA_REQUIRED',
                        message: 'Multi-factor authentication is required for healthcare workers',
                        enrollmentUrl: `/api/auth/mfa/enroll`
                    });
                }

                // Verify MFA was used in current session
                const amr = req.user['amr'] || [];
                if (!amr.includes('mfa')) {
                    return res.status(403).json({
                        error: 'MFA_VERIFICATION_REQUIRED',
                        message: 'Please complete MFA verification',
                        verificationUrl: `/api/auth/mfa/verify`
                    });
                }

                // Check session timeout (15 minutes for HIPAA)
                const tokenAge = Date.now() / 1000 - req.user.iat;
                if (tokenAge > 900) { // 15 minutes
                    return res.status(401).json({
                        error: 'SESSION_EXPIRED',
                        message: 'Session expired. Please re-authenticate.'
                    });
                }

                next();
            } catch (error) {
                console.error('MFA verification error:', error);
                res.status(500).json({ error: 'MFA verification failed' });
            }
        };
    }

    /**
     * Role-based access control middleware
     */
    authorize(requiredRoles = []) {
        return (req, res, next) => {
            const userRoles = req.user['https://hospital-scheduler.com/roles'] || [];
            const hasRole = requiredRoles.some(role => userRoles.includes(role));
            
            if (!hasRole && requiredRoles.length > 0) {
                return res.status(403).json({
                    error: 'INSUFFICIENT_PERMISSIONS',
                    message: 'You do not have permission to access this resource'
                });
            }
            
            next();
        };
    }

    /**
     * Create new user with MFA enrollment
     */
    async createUser({ email, password, firstName, lastName, role, departmentId, hospitalId }) {
        try {
            // Create user in Auth0
            const user = await this.management.createUser({
                email,
                password,
                email_verified: false,
                name: `${firstName} ${lastName}`,
                given_name: firstName,
                family_name: lastName,
                connection: 'Username-Password-Authentication',
                app_metadata: {
                    role,
                    departmentId,
                    hospitalId,
                    createdAt: new Date().toISOString(),
                    mfaRequired: true
                },
                user_metadata: {
                    preferences: {
                        notifications: {
                            email: true,
                            sms: true,
                            push: true
                        }
                    }
                }
            });

            // Trigger MFA enrollment
            await this.enrollMFA(user.user_id);

            // Send verification email
            await this.auth.requestChangePasswordEmail({
                email,
                connection: 'Username-Password-Authentication'
            });

            return {
                userId: user.user_id,
                email: user.email,
                requiresVerification: true,
                requiresMFA: true
            };
        } catch (error) {
            console.error('User creation error:', error);
            throw error;
        }
    }

    /**
     * Enroll user in MFA
     */
    async enrollMFA(userId) {
        try {
            // Generate MFA enrollment ticket
            const enrollmentTicket = await this.management.createGuardianEnrollmentTicket({
                user_id: userId,
                send_mail: true
            });

            return {
                ticketUrl: enrollmentTicket.ticket_url,
                ticketId: enrollmentTicket.ticket_id
            };
        } catch (error) {
            console.error('MFA enrollment error:', error);
            throw error;
        }
    }

    /**
     * Verify MFA token
     */
    async verifyMFAToken(userId, token) {
        try {
            const result = await this.auth.verifyMultifactorToken({
                userId,
                token,
                grant_type: 'http://auth0.com/oauth/grant-type/mfa-otp'
            });

            return {
                success: true,
                accessToken: result.access_token,
                expiresIn: result.expires_in
            };
        } catch (error) {
            console.error('MFA verification error:', error);
            return {
                success: false,
                error: 'Invalid MFA token'
            };
        }
    }

    /**
     * Update user metadata
     */
    async updateUserMetadata(userId, metadata) {
        try {
            const updated = await this.management.updateUserMetadata(
                { id: userId },
                metadata
            );
            return updated;
        } catch (error) {
            console.error('User update error:', error);
            throw error;
        }
    }

    /**
     * Lock user account (for security)
     */
    async lockUser(userId, reason) {
        try {
            await this.management.updateUser(
                { id: userId },
                {
                    blocked: true,
                    app_metadata: {
                        blocked_reason: reason,
                        blocked_at: new Date().toISOString()
                    }
                }
            );

            // Audit log
            await this.auditLog({
                action: 'USER_LOCKED',
                userId,
                reason,
                timestamp: new Date()
            });

            return { success: true };
        } catch (error) {
            console.error('User lock error:', error);
            throw error;
        }
    }

    /**
     * Get user sessions
     */
    async getUserSessions(userId) {
        try {
            const logs = await this.management.getLogsByUser({
                id: userId,
                type: 's',
                per_page: 10
            });

            return logs.map(log => ({
                sessionId: log.session_id,
                ip: log.ip,
                userAgent: log.user_agent,
                timestamp: log.date,
                location: log.location_info
            }));
        } catch (error) {
            console.error('Session retrieval error:', error);
            throw error;
        }
    }

    /**
     * Revoke all user sessions
     */
    async revokeUserSessions(userId) {
        try {
            // Invalidate refresh tokens
            await this.management.invalidateRememberBrowser({ id: userId });
            
            // Update user metadata to force re-authentication
            await this.management.updateUserMetadata(
                { id: userId },
                {
                    sessions_revoked_at: new Date().toISOString()
                }
            );

            return { success: true };
        } catch (error) {
            console.error('Session revocation error:', error);
            throw error;
        }
    }

    /**
     * Audit log for HIPAA compliance
     */
    async auditLog(entry) {
        // This would integrate with your audit logging system
        console.log('AUDIT:', entry);
    }
}

// Auth0 Rules for additional security (to be added in Auth0 dashboard)
const auth0Rules = {
    // Rule 1: Add custom claims
    addCustomClaims: `
        function addCustomClaims(user, context, callback) {
            const namespace = 'https://hospital-scheduler.com/';
            context.idToken[namespace + 'role'] = user.app_metadata.role;
            context.idToken[namespace + 'hospitalId'] = user.app_metadata.hospitalId;
            context.idToken[namespace + 'departmentId'] = user.app_metadata.departmentId;
            context.accessToken[namespace + 'role'] = user.app_metadata.role;
            
            callback(null, user, context);
        }
    `,

    // Rule 2: Enforce MFA
    enforceMFA: `
        function enforceMFA(user, context, callback) {
            const completedMfa = !!context.authentication.methods.find(
                (method) => method.name === 'mfa'
            );
            
            if (!completedMfa) {
                context.multifactor = {
                    provider: 'guardian',
                    allowRememberBrowser: false
                };
            }
            
            callback(null, user, context);
        }
    `,

    // Rule 3: Session timeout
    sessionTimeout: `
        function sessionTimeout(user, context, callback) {
            const sessionLifetime = 900; // 15 minutes in seconds
            context.accessToken.exp = Math.floor(Date.now() / 1000) + sessionLifetime;
            context.idToken.exp = Math.floor(Date.now() / 1000) + sessionLifetime;
            
            callback(null, user, context);
        }
    `,

    // Rule 4: IP allowlist for admin
    ipAllowlist: `
        function ipAllowlist(user, context, callback) {
            const allowedIPs = configuration.ALLOWED_IPS.split(',');
            const userRole = user.app_metadata.role;
            
            if (userRole === 'admin' && !allowedIPs.includes(context.request.ip)) {
                return callback(new UnauthorizedError('Access denied from this IP'));
            }
            
            callback(null, user, context);
        }
    `,

    // Rule 5: Audit logging
    auditLogging: `
        function auditLogging(user, context, callback) {
            const log = {
                userId: user.user_id,
                email: user.email,
                ip: context.request.ip,
                userAgent: context.request.userAgent,
                timestamp: new Date().toISOString(),
                action: 'LOGIN',
                hospitalId: user.app_metadata.hospitalId
            };
            
            // Send to audit service
            request.post({
                url: configuration.AUDIT_ENDPOINT,
                json: log,
                headers: {
                    'X-API-Key': configuration.AUDIT_API_KEY
                }
            }, function(err, response, body) {
                // Continue even if audit fails
                callback(null, user, context);
            });
        }
    `
};

// Configuration template
const auth0Config = {
    auth0Domain: process.env.AUTH0_DOMAIN,
    auth0ClientId: process.env.AUTH0_CLIENT_ID,
    auth0ClientSecret: process.env.AUTH0_CLIENT_SECRET,
    auth0Audience: process.env.AUTH0_AUDIENCE || 'https://api.hospital-scheduler.com',
    auth0CallbackUrl: process.env.AUTH0_CALLBACK_URL || 'http://localhost:3000/callback',
    auth0LogoutUrl: process.env.AUTH0_LOGOUT_URL || 'http://localhost:3000',
    rolePermissions: {
        admin: ['all'],
        manager: ['view_all', 'edit_schedules', 'approve_shifts', 'view_reports'],
        nurse: ['view_own', 'request_shifts', 'swap_shifts', 'view_schedule'],
        viewer: ['view_only']
    }
};

module.exports = {
    Auth0Service,
    auth0Config,
    auth0Rules
};
