-- Fix admin role assignment for Create Shift functionality
USE HospitalScheduler;
GO

-- First, check if roles exist and create if needed
IF NOT EXISTS (SELECT 1 FROM scheduler.roles WHERE name = 'admin')
BEGIN
    INSERT INTO scheduler.roles (id, name, description, created_at)
    VALUES (NEWID(), 'admin', 'Administrator with full access', GETUTCDATE());
END

IF NOT EXISTS (SELECT 1 FROM scheduler.roles WHERE name = 'supervisor')
BEGIN
    INSERT INTO scheduler.roles (id, name, description, created_at)
    VALUES (NEWID(), 'supervisor', 'Supervisor with shift management access', GETUTCDATE());
END

-- Create or update admin user
DECLARE @AdminRoleId UNIQUEIDENTIFIER;
SELECT @AdminRoleId = id FROM scheduler.roles WHERE name = 'admin';

DECLARE @UserId UNIQUEIDENTIFIER;

-- Check for existing admin user
SELECT @UserId = id FROM scheduler.users WHERE email = 'admin@hospital.com';

IF @UserId IS NULL
BEGIN
    -- Create admin user
    SET @UserId = NEWID();
    INSERT INTO scheduler.users (
        id,
        employee_id,
        email,
        first_name,
        last_name,
        phone,
        role_id,
        department_id,
        is_active,
        created_at,
        updated_at
    )
    VALUES (
        @UserId,
        'EMP001',
        'admin@hospital.com',
        'System',
        'Administrator',
        '555-0100',
        @AdminRoleId,
        NULL, -- No specific department
        1,
        GETUTCDATE(),
        GETUTCDATE()
    );

    PRINT 'Created admin user: admin@hospital.com';
END
ELSE
BEGIN
    -- Update existing user to have admin role
    UPDATE scheduler.users
    SET role_id = @AdminRoleId,
        updated_at = GETUTCDATE()
    WHERE id = @UserId;

    PRINT 'Updated admin user role for: admin@hospital.com';
END

-- Also create/update a demo supervisor
DECLARE @SupervisorRoleId UNIQUEIDENTIFIER;
SELECT @SupervisorRoleId = id FROM scheduler.roles WHERE name = 'supervisor';

DECLARE @SupervisorId UNIQUEIDENTIFIER;
SELECT @SupervisorId = id FROM scheduler.users WHERE email = 'supervisor@hospital.com';

IF @SupervisorId IS NULL
BEGIN
    SET @SupervisorId = NEWID();
    INSERT INTO scheduler.users (
        id,
        employee_id,
        email,
        first_name,
        last_name,
        phone,
        role_id,
        department_id,
        is_active,
        created_at,
        updated_at
    )
    VALUES (
        @SupervisorId,
        'EMP002',
        'supervisor@hospital.com',
        'Demo',
        'Supervisor',
        '555-0101',
        @SupervisorRoleId,
        NULL,
        1,
        GETUTCDATE(),
        GETUTCDATE()
    );

    PRINT 'Created supervisor user: supervisor@hospital.com';
END

-- Display current admin/supervisor users
SELECT
    u.email,
    u.first_name + ' ' + u.last_name AS full_name,
    r.name AS role_name,
    u.is_active
FROM scheduler.users u
INNER JOIN scheduler.roles r ON u.role_id = r.id
WHERE r.name IN ('admin', 'supervisor')
ORDER BY r.name, u.email;

PRINT 'Admin role setup complete!';
PRINT 'Users with shift creation permissions:';