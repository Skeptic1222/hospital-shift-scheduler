/**
 * Admin user management routes
 * Handles user creation, role assignment, and permission management
 */

const express = require('express');
const router = express.Router();

// Admin user management routes (production only)

module.exports = function createAdminUsersRouter(deps) {
  const { googleAuth, db, repositories, validate, body } = deps;

  // Initialize demo data
  function initDemoUsers() { /* removed in production build */ }

  /**
   * GET /api/admin/users
   * List all users with their roles
   */
  router.get('/admin/users', googleAuth.authenticate(), googleAuth.authorize(['admin']), async (req, res) => {
    try {
      // Production: from DB

      const result = await db.query(`
        SELECT 
          u.id, u.email, u.first_name, u.last_name,
          u.department_id, u.is_active,
          r.name as role_name
        FROM scheduler.users u
        LEFT JOIN scheduler.roles r ON u.role_id = r.id
        ORDER BY u.last_name, u.first_name
      `);

      const users = (result.recordset || []).map(u => ({
        id: u.id,
        email: u.email,
        first_name: u.first_name,
        last_name: u.last_name,
        name: `${u.first_name} ${u.last_name}`,
        role: u.role_name || 'user',
        department_id: u.department_id,
        is_active: u.is_active
      }));

      res.json({ users });
    } catch (error) {
      console.error('List users error:', error);
      res.status(500).json({ error: 'Failed to list users' });
    }
  });

  /**
   * POST /api/admin/users
   * Create a new user
   */
  router.post(
    '/admin/users',
    googleAuth.authenticate(),
    googleAuth.authorize(['admin']),
    validate([
      body('email').isEmail().withMessage('Valid email required'),
      body('first_name').notEmpty().withMessage('First name required'),
      body('last_name').notEmpty().withMessage('Last name required'),
      body('role').optional().isIn(['admin', 'supervisor', 'user']).withMessage('Invalid role')
    ]),
    async (req, res) => {
      try {
        const { email, first_name, last_name, role = 'user', department_id } = req.body;

        // Production only path

        // Check if user exists in database
        const existing = await db.query(
          'SELECT id FROM scheduler.users WHERE email = @email',
          { email }
        );

        if (existing.recordset?.length > 0) {
          return res.status(400).json({ error: 'User already exists' });
        }

        // Get role ID
        const roleResult = await db.query(
          'SELECT id FROM scheduler.roles WHERE name = @name',
          { name: role }
        );

        const role_id = roleResult.recordset?.[0]?.id || null;

        // Create user
        const employee_id = email.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 50);
        const user = await repositories.users.create({
          employee_id,
          email,
          first_name,
          last_name,
          role_id,
          department_id,
          is_active: 1,
          last_login: null
        });

        res.status(201).json({ 
          success: true, 
          user: {
            id: user.id,
            email: user.email,
            name: `${user.first_name} ${user.last_name}`,
            role
          }
        });
      } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Failed to create user' });
      }
    }
  );

  /**
   * DELETE /api/admin/users/:id
   * Delete a user
   */
  router.delete(
    '/admin/users/:id',
    googleAuth.authenticate(),
    googleAuth.authorize(['admin']),
    async (req, res) => {
      try {
        const { id } = req.params;

        // Production only path

        // Delete from database
        const result = await db.query(
          'DELETE FROM scheduler.users WHERE id = @id',
          { id }
        );

        if (result.rowsAffected[0] === 0) {
          return res.status(404).json({ error: 'User not found' });
        }

        res.json({ success: true, message: 'User deleted successfully' });
      } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Failed to delete user' });
      }
    }
  );

  /**
   * POST /api/admin/users/assign-role
   * Assign or update role for a user
   */
  router.post(
    '/admin/users/assign-role',
    googleAuth.authenticate(),
    googleAuth.authorize(['admin']),
    validate([
      body('email').isEmail().withMessage('Valid email required'),
      body('roleName').notEmpty().withMessage('Role name required')
    ]),
    async (req, res) => {
      try {
        const { email, roleName, first_name, last_name, department_id, department_code } = req.body;

        // Production only path

        // Live mode - database operations
        const roleResult = await db.query(
          "SELECT TOP 1 id FROM scheduler.roles WHERE name=@name",
          { name: roleName }
        );
        
        if (!roleResult.recordset?.length) {
          // Create role if it doesn't exist
          await db.query(
            "INSERT INTO scheduler.roles (name, permissions) VALUES (@name, '[]')",
            { name: roleName }
          );
          const newRoleResult = await db.query(
            "SELECT TOP 1 id FROM scheduler.roles WHERE name=@name",
            { name: roleName }
          );
          var roleId = newRoleResult.recordset[0].id;
        } else {
          var roleId = roleResult.recordset[0].id;
        }

        // Check if user exists
        const userResult = await db.query(
          "SELECT TOP 1 id, first_name, last_name FROM scheduler.users WHERE email=@email",
          { email }
        );
        
        let userId;
        let isNewUser = false;
        
        if (!userResult.recordset?.length) {
          // Create new user
          const [emailName] = email.split('@');
          const employee_id = email.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 50);
          
          // Handle department
          let deptId = null;
          if (department_code) {
            const deptResult = await db.query(
              'SELECT TOP 1 id FROM scheduler.departments WHERE code=@code',
              { code: department_code }
            );
            deptId = deptResult.recordset?.[0]?.id;
          } else if (department_id) {
            deptId = department_id;
          }
          
          const newUser = await repositories.users.create({
            employee_id,
            email,
            first_name: first_name || emailName,
            last_name: last_name || '',
            role_id: roleId,
            department_id: deptId,
            is_active: 1,
            last_login: null
          });
          
          userId = newUser.id;
          isNewUser = true;
        } else {
          // Update existing user's role
          userId = userResult.recordset[0].id;
          await db.query(
            "UPDATE scheduler.users SET role_id=@roleId WHERE id=@id",
            { roleId, id: userId }
          );
        }

        // Log the change
        if (deps.repositories?.auditLog) {
          await deps.repositories.auditLog.create({
            action: isNewUser ? 'USER_CREATED' : 'ROLE_UPDATED',
            user_id: req.user.id || null,
            resource_type: 'user',
            resource_id: userId,
            additional_data: JSON.stringify({ email, role: roleName })
          });
        }

        res.json({ 
          updated: true, 
          upserted: isNewUser,
          user: {
            email,
            role: roleName
          }
        });
      } catch (error) {
        console.error('Assign role error:', error);
        res.status(500).json({ error: 'Failed to assign role' });
      }
    }
  );

  /**
   * PUT /api/admin/users/:id
   * Update user details
   */
  router.put(
    '/users/:id',
    googleAuth.authenticate(),
    googleAuth.authorize(['admin']),
    async (req, res) => {
      try {
        const { id } = req.params;
        const updates = req.body;

        // Production only path

        // Live mode
        const user = await repositories.users.findById(id);
        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }

        // Handle role update
        if (updates.role) {
          const roleResult = await db.query(
            "SELECT id FROM scheduler.roles WHERE name=@name",
            { name: updates.role }
          );
          if (roleResult.recordset?.length) {
            updates.role_id = roleResult.recordset[0].id;
          }
          delete updates.role;
        }

        await repositories.users.update(id, updates);
        
        res.json({ 
          success: true,
          updated: true
        });
      } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Failed to update user' });
      }
    }
  );

  /**
   * DELETE /api/admin/users/:id
   * Deactivate a user
   */
  router.delete(
    '/users/:id',
    googleAuth.authenticate(),
    googleAuth.authorize(['admin']),
    async (req, res) => {
      try {
        const { id } = req.params;

        // Production only path

        // Live mode - soft delete
        await repositories.users.update(id, { is_active: 0 });
        
        res.json({ success: true, deactivated: true });
      } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Failed to delete user' });
      }
    }
  );

  return router;
};
