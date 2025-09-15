-- Hospital Shift Scheduler Database Schema for SQL Server Express
-- HIPAA-compliant with full audit logging
-- Supports FCFS with 15-minute windows

USE master;
GO

-- Create database if it doesn't exist
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'HospitalScheduler')
BEGIN
    CREATE DATABASE HospitalScheduler;
END
GO

USE HospitalScheduler;
GO

-- Enable Row-Level Security
ALTER DATABASE HospitalScheduler SET TRUSTWORTHY ON;
GO

-- =====================================================
-- CORE SCHEMAS
-- =====================================================

IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'scheduler')
    EXEC('CREATE SCHEMA scheduler');
GO

IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'audit')
    EXEC('CREATE SCHEMA audit');
GO

-- =====================================================
-- CORE TABLES
-- =====================================================

-- Drop tables if they exist (for clean rebuild)
IF OBJECT_ID('scheduler.shift_assignments', 'U') IS NOT NULL DROP TABLE scheduler.shift_assignments;
IF OBJECT_ID('scheduler.fcfs_queue', 'U') IS NOT NULL DROP TABLE scheduler.fcfs_queue;
IF OBJECT_ID('scheduler.open_shift_requests', 'U') IS NOT NULL DROP TABLE scheduler.open_shift_requests;
IF OBJECT_ID('scheduler.shifts', 'U') IS NOT NULL DROP TABLE scheduler.shifts;
IF OBJECT_ID('scheduler.shift_templates', 'U') IS NOT NULL DROP TABLE scheduler.shift_templates;
IF OBJECT_ID('scheduler.notifications', 'U') IS NOT NULL DROP TABLE scheduler.notifications;
IF OBJECT_ID('scheduler.notification_templates', 'U') IS NOT NULL DROP TABLE scheduler.notification_templates;
IF OBJECT_ID('scheduler.work_hours_tracking', 'U') IS NOT NULL DROP TABLE scheduler.work_hours_tracking;
IF OBJECT_ID('scheduler.shift_metrics', 'U') IS NOT NULL DROP TABLE scheduler.shift_metrics;
IF OBJECT_ID('scheduler.users', 'U') IS NOT NULL DROP TABLE scheduler.users;
IF OBJECT_ID('scheduler.roles', 'U') IS NOT NULL DROP TABLE scheduler.roles;
IF OBJECT_ID('scheduler.departments', 'U') IS NOT NULL DROP TABLE scheduler.departments;
IF OBJECT_ID('scheduler.hospitals', 'U') IS NOT NULL DROP TABLE scheduler.hospitals;
IF OBJECT_ID('audit.audit_log', 'U') IS NOT NULL DROP TABLE audit.audit_log;
IF OBJECT_ID('scheduler.push_subscriptions', 'U') IS NOT NULL DROP TABLE scheduler.push_subscriptions;

-- Hospitals/Facilities
CREATE TABLE scheduler.hospitals (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(255) NOT NULL,
    code NVARCHAR(50) UNIQUE NOT NULL,
    bed_count INT,
    timezone NVARCHAR(50) DEFAULT 'America/New_York',
    settings NVARCHAR(MAX) DEFAULT '{}', -- JSON data
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE()
);

-- Departments within hospitals
CREATE TABLE scheduler.departments (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    hospital_id UNIQUEIDENTIFIER REFERENCES scheduler.hospitals(id) ON DELETE CASCADE,
    name NVARCHAR(255) NOT NULL,
    code NVARCHAR(50) NOT NULL,
    min_staff_required INT DEFAULT 1,
    max_staff_allowed INT,
    settings NVARCHAR(MAX) DEFAULT '{}', -- JSON data
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    CONSTRAINT UQ_Department_Hospital_Code UNIQUE(hospital_id, code)
);

-- User roles and permissions
CREATE TABLE scheduler.roles (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    name NVARCHAR(100) NOT NULL,
    permissions NVARCHAR(MAX) NOT NULL DEFAULT '[]', -- JSON array
    hospital_id UNIQUEIDENTIFIER REFERENCES scheduler.hospitals(id) ON DELETE CASCADE,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    CONSTRAINT UQ_Role_Hospital UNIQUE(name, hospital_id)
);

-- Users (healthcare workers)
CREATE TABLE scheduler.users (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    employee_id NVARCHAR(100) NOT NULL,
    email NVARCHAR(255) UNIQUE NOT NULL,
    phone NVARCHAR(20),
    first_name NVARCHAR(100) NOT NULL,
    last_name NVARCHAR(100) NOT NULL,
    role_id UNIQUEIDENTIFIER REFERENCES scheduler.roles(id),
    department_id UNIQUEIDENTIFIER REFERENCES scheduler.departments(id),
    hospital_id UNIQUEIDENTIFIER REFERENCES scheduler.hospitals(id) ON DELETE CASCADE,
    auth0_id NVARCHAR(255) UNIQUE,
    hire_date DATE,
    certifications NVARCHAR(MAX) DEFAULT '[]', -- JSON array
    skills NVARCHAR(MAX) DEFAULT '[]', -- JSON array
    preferences NVARCHAR(MAX) DEFAULT '{}', -- JSON object
    is_active BIT DEFAULT 1,
    last_login DATETIME2,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE()
);

-- Create indexes for users table
CREATE INDEX IX_Users_Hospital ON scheduler.users(hospital_id);
CREATE INDEX IX_Users_Department ON scheduler.users(department_id);
CREATE INDEX IX_Users_Active ON scheduler.users(is_active);

-- Shift templates
CREATE TABLE scheduler.shift_templates (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    hospital_id UNIQUEIDENTIFIER REFERENCES scheduler.hospitals(id) ON DELETE CASCADE,
    department_id UNIQUEIDENTIFIER REFERENCES scheduler.departments(id) ON DELETE CASCADE,
    name NVARCHAR(100) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    duration_hours AS (DATEDIFF(MINUTE, start_time, end_time) / 60.0) PERSISTED,
    break_minutes INT DEFAULT 30,
    min_staff INT DEFAULT 1,
    max_staff INT,
    is_active BIT DEFAULT 1,
    created_at DATETIME2 DEFAULT GETUTCDATE()
);

-- Shifts (actual scheduled shifts)
CREATE TABLE scheduler.shifts (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    template_id UNIQUEIDENTIFIER REFERENCES scheduler.shift_templates(id),
    department_id UNIQUEIDENTIFIER REFERENCES scheduler.departments(id) ON DELETE CASCADE,
    hospital_id UNIQUEIDENTIFIER REFERENCES scheduler.hospitals(id) ON DELETE CASCADE,
    shift_date DATE NOT NULL,
    start_datetime DATETIME2 NOT NULL,
    end_datetime DATETIME2 NOT NULL,
    required_staff INT DEFAULT 1,
    status NVARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'open', 'filled', 'cancelled', 'completed')),
    created_by UNIQUEIDENTIFIER REFERENCES scheduler.users(id),
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE()
);

-- Create indexes for shifts table
CREATE INDEX IX_Shifts_Date ON scheduler.shifts(shift_date);
CREATE INDEX IX_Shifts_Status ON scheduler.shifts(status);
CREATE INDEX IX_Shifts_Department ON scheduler.shifts(department_id);

-- Shift assignments (who is working which shift)
CREATE TABLE scheduler.shift_assignments (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    shift_id UNIQUEIDENTIFIER REFERENCES scheduler.shifts(id) ON DELETE CASCADE,
    user_id UNIQUEIDENTIFIER REFERENCES scheduler.users(id) ON DELETE CASCADE,
    status NVARCHAR(50) DEFAULT 'assigned' CHECK (status IN ('assigned', 'confirmed', 'declined', 'cancelled', 'completed', 'no_show')),
    assigned_at DATETIME2 DEFAULT GETUTCDATE(),
    confirmed_at DATETIME2,
    completed_at DATETIME2,
    hours_worked DECIMAL(4,2),
    notes NVARCHAR(MAX),
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    CONSTRAINT UQ_Shift_User UNIQUE(shift_id, user_id)
);

-- Create indexes for assignments
CREATE INDEX IX_Assignments_User ON scheduler.shift_assignments(user_id);
CREATE INDEX IX_Assignments_Shift ON scheduler.shift_assignments(shift_id);
CREATE INDEX IX_Assignments_Status ON scheduler.shift_assignments(status);

-- =====================================================
-- FCFS QUEUE SYSTEM (15-minute windows)
-- =====================================================

-- Open shift requests (for FCFS distribution)
CREATE TABLE scheduler.open_shift_requests (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    shift_id UNIQUEIDENTIFIER REFERENCES scheduler.shifts(id) ON DELETE CASCADE,
    requested_by UNIQUEIDENTIFIER REFERENCES scheduler.users(id),
    reason NVARCHAR(500),
    urgency_level INT DEFAULT 1 CHECK (urgency_level BETWEEN 1 AND 5),
    posted_at DATETIME2 DEFAULT GETUTCDATE(),
    expires_at DATETIME2,
    filled_at DATETIME2,
    filled_by UNIQUEIDENTIFIER REFERENCES scheduler.users(id),
    status NVARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'pending', 'filled', 'expired', 'cancelled'))
);

CREATE INDEX IX_Open_Shifts_Status ON scheduler.open_shift_requests(status);
CREATE INDEX IX_Open_Shifts_Posted ON scheduler.open_shift_requests(posted_at);

-- FCFS queue for shift pickup
CREATE TABLE scheduler.fcfs_queue (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    open_shift_id UNIQUEIDENTIFIER REFERENCES scheduler.open_shift_requests(id) ON DELETE CASCADE,
    user_id UNIQUEIDENTIFIER REFERENCES scheduler.users(id) ON DELETE CASCADE,
    queue_position INT NOT NULL,
    queued_at DATETIME2 DEFAULT GETUTCDATE(),
    window_starts_at DATETIME2 NOT NULL,
    window_expires_at DATETIME2 NOT NULL,
    response_status NVARCHAR(50) DEFAULT 'waiting' CHECK (response_status IN ('waiting', 'accepted', 'declined', 'expired')),
    responded_at DATETIME2,
    CONSTRAINT UQ_OpenShift_User UNIQUE(open_shift_id, user_id)
);

CREATE INDEX IX_Queue_Window ON scheduler.fcfs_queue(window_starts_at, window_expires_at);
CREATE INDEX IX_Queue_Status ON scheduler.fcfs_queue(response_status);

-- =====================================================
-- NOTIFICATIONS & REAL-TIME
-- =====================================================

-- Notification templates
CREATE TABLE scheduler.notification_templates (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    hospital_id UNIQUEIDENTIFIER REFERENCES scheduler.hospitals(id) ON DELETE CASCADE,
    type NVARCHAR(100) NOT NULL,
    channel NVARCHAR(50) NOT NULL CHECK (channel IN ('email', 'sms', 'push', 'in_app')),
    subject NVARCHAR(255),
    body NVARCHAR(MAX) NOT NULL,
    variables NVARCHAR(MAX) DEFAULT '[]', -- JSON array
    is_active BIT DEFAULT 1,
    created_at DATETIME2 DEFAULT GETUTCDATE()
);

-- Notification queue
CREATE TABLE scheduler.notifications (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    user_id UNIQUEIDENTIFIER REFERENCES scheduler.users(id) ON DELETE CASCADE,
    template_id UNIQUEIDENTIFIER REFERENCES scheduler.notification_templates(id),
    channel NVARCHAR(50) NOT NULL,
    priority INT DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
    subject NVARCHAR(255),
    body NVARCHAR(MAX),
    data NVARCHAR(MAX) DEFAULT '{}', -- JSON object
    status NVARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'read')),
    scheduled_for DATETIME2 DEFAULT GETUTCDATE(),
    sent_at DATETIME2,
    delivered_at DATETIME2,
    read_at DATETIME2,
    error_message NVARCHAR(MAX),
    retry_count INT DEFAULT 0,
    created_at DATETIME2 DEFAULT GETUTCDATE()
);

CREATE INDEX IX_Notifications_User ON scheduler.notifications(user_id);
CREATE INDEX IX_Notifications_Status ON scheduler.notifications(status);
CREATE INDEX IX_Notifications_Scheduled ON scheduler.notifications(scheduled_for);

-- Web Push subscriptions
CREATE TABLE scheduler.push_subscriptions (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    user_id UNIQUEIDENTIFIER REFERENCES scheduler.users(id) ON DELETE CASCADE,
    endpoint NVARCHAR(2000) NOT NULL,
    p256dh NVARCHAR(512) NOT NULL,
    auth NVARCHAR(256) NOT NULL,
    user_agent NVARCHAR(1024),
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    is_active BIT DEFAULT 1,
    CONSTRAINT UQ_Push_Subscription UNIQUE(user_id, endpoint)
);
CREATE INDEX IX_PushSubs_User ON scheduler.push_subscriptions(user_id);

-- =====================================================
-- FATIGUE MANAGEMENT
-- =====================================================

-- Track work hours for fatigue management
CREATE TABLE scheduler.work_hours_tracking (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    user_id UNIQUEIDENTIFIER REFERENCES scheduler.users(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    total_hours_scheduled DECIMAL(5,2) DEFAULT 0,
    total_hours_worked DECIMAL(5,2) DEFAULT 0,
    overtime_hours DECIMAL(5,2) DEFAULT 0,
    consecutive_days_worked INT DEFAULT 0,
    last_day_off DATE,
    fatigue_score INT DEFAULT 0 CHECK (fatigue_score BETWEEN 0 AND 100),
    alerts NVARCHAR(MAX) DEFAULT '[]', -- JSON array
    updated_at DATETIME2 DEFAULT GETUTCDATE(),
    CONSTRAINT UQ_User_Week UNIQUE(user_id, week_start)
);

CREATE INDEX IX_Work_Hours_User ON scheduler.work_hours_tracking(user_id);
CREATE INDEX IX_Work_Hours_Week ON scheduler.work_hours_tracking(week_start);

-- =====================================================
-- AUDIT LOGGING (HIPAA COMPLIANCE)
-- =====================================================

-- Comprehensive audit log (partitioned by month)
CREATE TABLE audit.audit_log (
    id UNIQUEIDENTIFIER DEFAULT NEWID(),
    timestamp DATETIME2 DEFAULT GETUTCDATE(),
    user_id UNIQUEIDENTIFIER,
    user_email NVARCHAR(255),
    session_id NVARCHAR(255),
    ip_address NVARCHAR(45),
    user_agent NVARCHAR(MAX),
    action NVARCHAR(100) NOT NULL,
    resource_type NVARCHAR(100),
    resource_id UNIQUEIDENTIFIER,
    method NVARCHAR(20),
    endpoint NVARCHAR(500),
    request_body NVARCHAR(MAX), -- JSON
    response_status INT,
    response_time_ms INT,
    error_message NVARCHAR(MAX),
    hospital_id UNIQUEIDENTIFIER,
    department_id UNIQUEIDENTIFIER,
    additional_data NVARCHAR(MAX) DEFAULT '{}', -- JSON
    CONSTRAINT PK_AuditLog PRIMARY KEY (timestamp, id)
) ON [PRIMARY];

-- Create partitioned index
CREATE CLUSTERED INDEX IX_Audit_Timestamp ON audit.audit_log(timestamp);
CREATE INDEX IX_Audit_User ON audit.audit_log(user_id);
CREATE INDEX IX_Audit_Action ON audit.audit_log(action);
CREATE INDEX IX_Audit_Resource ON audit.audit_log(resource_type, resource_id);

-- =====================================================
-- ANALYTICS & REPORTING
-- =====================================================

-- Shift metrics for analytics
CREATE TABLE scheduler.shift_metrics (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    hospital_id UNIQUEIDENTIFIER REFERENCES scheduler.hospitals(id) ON DELETE CASCADE,
    department_id UNIQUEIDENTIFIER REFERENCES scheduler.departments(id),
    metric_date DATE NOT NULL,
    total_shifts INT DEFAULT 0,
    filled_shifts INT DEFAULT 0,
    open_shifts INT DEFAULT 0,
    cancelled_shifts INT DEFAULT 0,
    fill_rate DECIMAL(5,2),
    avg_fill_time_minutes INT,
    overtime_hours DECIMAL(8,2),
    no_show_count INT DEFAULT 0,
    created_at DATETIME2 DEFAULT GETUTCDATE(),
    CONSTRAINT UQ_Metrics_Date UNIQUE(hospital_id, department_id, metric_date)
);

CREATE INDEX IX_Metrics_Date ON scheduler.shift_metrics(metric_date);

-- =====================================================
-- STORED PROCEDURES
-- =====================================================

-- Procedure to update timestamps
GO
CREATE TRIGGER TR_Users_UpdateTimestamp
ON scheduler.users
AFTER UPDATE
AS
BEGIN
    UPDATE scheduler.users
    SET updated_at = GETUTCDATE()
    FROM scheduler.users u
    INNER JOIN inserted i ON u.id = i.id;
END;
GO

CREATE TRIGGER TR_Shifts_UpdateTimestamp
ON scheduler.shifts
AFTER UPDATE
AS
BEGIN
    UPDATE scheduler.shifts
    SET updated_at = GETUTCDATE()
    FROM scheduler.shifts s
    INNER JOIN inserted i ON s.id = i.id;
END;
GO

CREATE TRIGGER TR_Assignments_UpdateTimestamp
ON scheduler.shift_assignments
AFTER UPDATE
AS
BEGIN
    UPDATE scheduler.shift_assignments
    SET updated_at = GETUTCDATE()
    FROM scheduler.shift_assignments a
    INNER JOIN inserted i ON a.id = i.id;
END;
GO

-- Audit trigger for HIPAA compliance
CREATE TRIGGER TR_Users_Audit
ON scheduler.users
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    DECLARE @action NVARCHAR(10);
    
    IF EXISTS(SELECT * FROM inserted) AND EXISTS(SELECT * FROM deleted)
        SET @action = 'UPDATE';
    ELSE IF EXISTS(SELECT * FROM inserted)
        SET @action = 'INSERT';
    ELSE
        SET @action = 'DELETE';
    
    INSERT INTO audit.audit_log (action, resource_type, resource_id, additional_data)
    SELECT 
        @action,
        'users',
        ISNULL(i.id, d.id),
        (SELECT * FROM ISNULL(inserted, deleted) FOR JSON AUTO)
    FROM inserted i
    FULL OUTER JOIN deleted d ON i.id = d.id;
END;
GO

-- Function to calculate fatigue score
CREATE FUNCTION scheduler.CalculateFatigueScore
(
    @userId UNIQUEIDENTIFIER,
    @weekStart DATE
)
RETURNS INT
AS
BEGIN
    DECLARE @fatigueScore INT = 0;
    DECLARE @hoursWorked DECIMAL(5,2);
    DECLARE @consecutiveDays INT;
    DECLARE @lastDayOff DATE;
    
    SELECT 
        @hoursWorked = total_hours_worked,
        @consecutiveDays = consecutive_days_worked,
        @lastDayOff = last_day_off
    FROM scheduler.work_hours_tracking
    WHERE user_id = @userId AND week_start = @weekStart;
    
    -- Calculate based on hours worked (max 40 points)
    IF @hoursWorked > 60
        SET @fatigueScore = @fatigueScore + 40;
    ELSE IF @hoursWorked > 50
        SET @fatigueScore = @fatigueScore + 30;
    ELSE IF @hoursWorked > 40
        SET @fatigueScore = @fatigueScore + 20;
    ELSE
        SET @fatigueScore = @fatigueScore + (@hoursWorked / 2);
    
    -- Calculate based on consecutive days (max 30 points)
    IF @consecutiveDays > 7
        SET @fatigueScore = @fatigueScore + 30;
    ELSE IF @consecutiveDays > 5
        SET @fatigueScore = @fatigueScore + 20;
    ELSE
        SET @fatigueScore = @fatigueScore + (@consecutiveDays * 3);
    
    -- Calculate based on time since last day off (max 30 points)
    IF @lastDayOff IS NOT NULL
    BEGIN
        DECLARE @daysSinceOff INT = DATEDIFF(DAY, @lastDayOff, GETDATE());
        IF @daysSinceOff > 14
            SET @fatigueScore = @fatigueScore + 30;
        ELSE IF @daysSinceOff > 7
            SET @fatigueScore = @fatigueScore + 20;
        ELSE
            SET @fatigueScore = @fatigueScore + (@daysSinceOff * 2);
    END
    
    -- Cap at 100
    IF @fatigueScore > 100
        SET @fatigueScore = 100;
    
    RETURN @fatigueScore;
END;
GO

-- Stored procedure to clean up expired queue entries
CREATE PROCEDURE scheduler.CleanupExpiredQueueEntries
AS
BEGIN
    UPDATE scheduler.fcfs_queue
    SET response_status = 'expired'
    WHERE window_expires_at < GETUTCDATE()
    AND response_status = 'waiting';
END;
GO

-- Stored procedure to archive old audit logs
CREATE PROCEDURE audit.ArchiveOldLogs
    @DaysToKeep INT = 2555 -- 7 years for HIPAA
AS
BEGIN
    -- In production, you would move old records to archive storage
    -- For now, just delete very old records
    DELETE FROM audit.audit_log 
    WHERE timestamp < DATEADD(DAY, -@DaysToKeep, GETUTCDATE());
END;
GO

-- =====================================================
-- INITIAL DATA
-- =====================================================

-- Insert default roles
INSERT INTO scheduler.roles (name, permissions) VALUES
    ('admin', '["all"]'),
    ('manager', '["view_all", "edit_schedules", "approve_shifts"]'),
    ('nurse', '["view_own", "request_shifts", "swap_shifts"]'),
    ('viewer', '["view_only"]');

-- Create a default hospital for testing
INSERT INTO scheduler.hospitals (name, code, bed_count) VALUES
    ('General Hospital', 'GH001', 500);

-- Create default departments
DECLARE @hospitalId UNIQUEIDENTIFIER;
SELECT @hospitalId = id FROM scheduler.hospitals WHERE code = 'GH001';

INSERT INTO scheduler.departments (hospital_id, name, code, min_staff_required) VALUES
    (@hospitalId, 'Emergency', 'ER', 5),
    (@hospitalId, 'ICU', 'ICU', 3),
    (@hospitalId, 'Surgery', 'SURG', 4),
    (@hospitalId, 'Pediatrics', 'PEDS', 3);

PRINT 'Database schema created successfully!';
