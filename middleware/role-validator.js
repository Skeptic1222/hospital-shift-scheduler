/**
 * Server-side Role Validation Middleware
 * Enforces role-based access control with database verification
 */

class RoleValidator {
  constructor(db, repositories) {
    this.db = db;
    this.repositories = repositories;
    
    // Role hierarchy (higher roles include lower permissions)
    this.roleHierarchy = {
      admin: ['admin', 'supervisor', 'manager', 'user', 'viewer'],
      supervisor: ['supervisor', 'manager', 'user', 'viewer'],
      manager: ['manager', 'user', 'viewer'],
      user: ['user', 'viewer'],
      viewer: ['viewer']
    };

    // Permission mappings
    this.permissions = {
      admin: [
        'system:manage',
        'users:manage',
        'roles:manage',
        'settings:manage',
        'audit:view',
        'shifts:manage',
        'departments:manage',
        'reports:generate',
        'data:export'
      ],
      supervisor: [
        'shifts:manage',
        'shifts:approve',
        'users:view',
        'departments:view',
        'reports:view',
        'queue:manage',
        'notifications:send'
      ],
      manager: [
        'shifts:create',
        'shifts:edit',
        'shifts:view',
        'users:view',
        'queue:view',
        'reports:view'
      ],
      user: [
        'shifts:view',
        'shifts:claim',
        'shifts:swap',
        'profile:edit',
        'notifications:receive'
      ],
      viewer: [
        'shifts:view',
        'profile:view'
      ]
    };
  }

  /**
   * Validate user has required role(s)
   */
  requireRole(requiredRoles) {
    return async (req, res, next) => {
      try {
        

        // Check if user is authenticated
        if (!req.user) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        // Ensure requiredRoles is an array
        const rolesNeeded = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

        // Get user's roles from database (most authoritative source)
        const userRoles = await this.getUserRoles(req.user.id || req.user.sub || req.user.email);

        // Check if user has any of the required roles
        const hasRequiredRole = rolesNeeded.some(role => 
          userRoles.some(userRole => 
            this.roleHierarchy[userRole]?.includes(role)
          )
        );

        if (!hasRequiredRole) {
          // Log unauthorized access attempt
          console.warn(`Unauthorized access attempt by ${req.user.email} to ${req.path}`);
          
          return res.status(403).json({ 
            error: 'Insufficient permissions',
            required: rolesNeeded,
            current: userRoles
          });
        }

        // Attach validated roles to request
        req.validatedRoles = userRoles;
        next();
      } catch (error) {
        console.error('Role validation error:', error);
        res.status(500).json({ error: 'Role validation failed' });
      }
    };
  }

  /**
   * Validate user has required permission(s)
   */
  requirePermission(requiredPermissions) {
    return async (req, res, next) => {
      try {
        

        if (!req.user) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        // Ensure requiredPermissions is an array
        const permsNeeded = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];

        // Get user's roles and derive permissions
        const userRoles = await this.getUserRoles(req.user.id || req.user.sub || req.user.email);
        const userPermissions = this.getPermissionsForRoles(userRoles);

        // Check if user has all required permissions
        const hasAllPermissions = permsNeeded.every(perm => 
          userPermissions.includes(perm)
        );

        if (!hasAllPermissions) {
          console.warn(`Permission denied for ${req.user.email} - missing: ${permsNeeded.filter(p => !userPermissions.includes(p))}`);
          
          return res.status(403).json({ 
            error: 'Insufficient permissions',
            required: permsNeeded,
            missing: permsNeeded.filter(p => !userPermissions.includes(p))
          });
        }

        // Attach validated permissions
        req.validatedPermissions = userPermissions;
        next();
      } catch (error) {
        console.error('Permission validation error:', error);
        res.status(500).json({ error: 'Permission validation failed' });
      }
    };
  }

  /**
   * Get user's roles from database
   */
  async getUserRoles(userIdentifier) {
    try {
      if (!this.db || !this.db.connected) {
        // Fallback to default role if DB unavailable
        return ['viewer'];
      }

      // Query by email or ID
      const query = userIdentifier.includes('@') 
        ? 'SELECT r.name FROM scheduler.users u JOIN scheduler.roles r ON u.role_id = r.id WHERE u.email = @identifier'
        : 'SELECT r.name FROM scheduler.users u JOIN scheduler.roles r ON u.role_id = r.id WHERE u.id = @identifier';

      const result = await this.db.query(query, { identifier: userIdentifier });
      
      if (result.recordset && result.recordset.length > 0) {
        return result.recordset.map(r => r.name);
      }

      // Check for admin/supervisor emails from environment
      const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim());
      const supervisorEmails = (process.env.SUPERVISOR_EMAILS || '').split(',').map(e => e.trim());

      if (adminEmails.includes(userIdentifier)) {
        return ['admin'];
      }
      if (supervisorEmails.includes(userIdentifier)) {
        return ['supervisor'];
      }

      // Default role for authenticated users
      return ['user'];
    } catch (error) {
      console.error('Error fetching user roles:', error);
      return ['viewer']; // Safest default
    }
  }

  /**
   * Get permissions for given roles
   */
  getPermissionsForRoles(roles) {
    const allPermissions = new Set();

    for (const role of roles) {
      const rolePerms = this.permissions[role] || [];
      rolePerms.forEach(perm => allPermissions.add(perm));
    }

    return Array.from(allPermissions);
  }

  /**
   * Check if user owns the resource
   */
  requireOwnership(resourceGetter) {
    return async (req, res, next) => {
      try {
        

        if (!req.user) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        // Get the resource
        const resource = await resourceGetter(req);
        
        if (!resource) {
          return res.status(404).json({ error: 'Resource not found' });
        }

        // Check ownership
        const userId = req.user.id || req.user.sub;
        const ownerId = resource.user_id || resource.owner_id || resource.created_by;

        if (userId !== ownerId) {
          // Check if user is admin/supervisor (can access any resource)
          const userRoles = await this.getUserRoles(req.user.email);
          if (!userRoles.includes('admin') && !userRoles.includes('supervisor')) {
            return res.status(403).json({ error: 'You do not own this resource' });
          }
        }

        req.resource = resource;
        next();
      } catch (error) {
        console.error('Ownership validation error:', error);
        res.status(500).json({ error: 'Ownership validation failed' });
      }
    };
  }

  /**
   * Department-based access control
   */
  requireDepartmentAccess(departmentGetter) {
    return async (req, res, next) => {
      try {
        

        if (!req.user) {
          return res.status(401).json({ error: 'Authentication required' });
        }

        // Get target department
        const targetDeptId = await departmentGetter(req);
        
        // Get user's department
        const userQuery = 'SELECT department_id FROM scheduler.users WHERE email = @email';
        const userResult = await this.db.query(userQuery, { email: req.user.email });
        
        if (!userResult.recordset || userResult.recordset.length === 0) {
          return res.status(403).json({ error: 'User department not found' });
        }

        const userDeptId = userResult.recordset[0].department_id;

        // Check if user has access to target department
        if (userDeptId !== targetDeptId) {
          // Check for cross-department privileges
          const userRoles = await this.getUserRoles(req.user.email);
          
          // Admins and supervisors can access any department
          if (!userRoles.includes('admin') && !userRoles.includes('supervisor')) {
            // Check for specific cross-department permissions
            const crossDeptQuery = `
              SELECT 1 FROM scheduler.user_department_access 
              WHERE user_id = (SELECT id FROM scheduler.users WHERE email = @email)
              AND department_id = @deptId
            `;
            
            const crossAccess = await this.db.query(crossDeptQuery, { 
              email: req.user.email, 
              deptId: targetDeptId 
            });

            if (!crossAccess.recordset || crossAccess.recordset.length === 0) {
              return res.status(403).json({ 
                error: 'No access to this department',
                userDepartment: userDeptId,
                targetDepartment: targetDeptId
              });
            }
          }
        }

        req.departmentId = targetDeptId;
        next();
      } catch (error) {
        console.error('Department access validation error:', error);
        res.status(500).json({ error: 'Department access validation failed' });
      }
    };
  }

  /**
   * Time-based access control (for shift operations)
   */
  requireTimeWindow(windowMinutes = 15) {
    return (req, res, next) => {
      try {
        

        // Get shift time from request
        const shiftTime = req.body.shift_time || req.query.shift_time;
        if (!shiftTime) {
          return next(); // No time restriction if no shift time specified
        }

        const now = new Date();
        const shift = new Date(shiftTime);
        const timeDiff = Math.abs(shift - now) / (1000 * 60); // Difference in minutes

        if (timeDiff > windowMinutes) {
          return res.status(403).json({ 
            error: `Action only allowed within ${windowMinutes} minutes of shift time`,
            currentTime: now,
            shiftTime: shift,
            minutesRemaining: Math.floor(timeDiff - windowMinutes)
          });
        }

        next();
      } catch (error) {
        console.error('Time window validation error:', error);
        res.status(500).json({ error: 'Time validation failed' });
      }
    };
  }
}

// Export factory function
module.exports = (db, repositories) => new RoleValidator(db, repositories);
