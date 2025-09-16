-- Fix missing notifications table and related dependencies
-- This creates only the missing tables without dropping existing ones

USE HospitalScheduler;
GO

-- Create notification_templates table if it doesn't exist
IF OBJECT_ID('scheduler.notification_templates', 'U') IS NULL
BEGIN
    CREATE TABLE scheduler.notification_templates (
        id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        name NVARCHAR(100) NOT NULL,
        channel NVARCHAR(50) NOT NULL,
        subject_template NVARCHAR(500),
        body_template NVARCHAR(MAX),
        variables NVARCHAR(MAX) DEFAULT '[]', -- JSON array
        is_active BIT DEFAULT 1,
        created_at DATETIME2 DEFAULT GETUTCDATE(),
        updated_at DATETIME2 DEFAULT GETUTCDATE()
    );
    PRINT 'Created table: scheduler.notification_templates';
END
ELSE
    PRINT 'Table already exists: scheduler.notification_templates';
GO

-- Create notifications table if it doesn't exist
IF OBJECT_ID('scheduler.notifications', 'U') IS NULL
BEGIN
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

    PRINT 'Created table: scheduler.notifications';
END
ELSE
    PRINT 'Table already exists: scheduler.notifications';
GO

-- Create push_subscriptions table if it doesn't exist
IF OBJECT_ID('scheduler.push_subscriptions', 'U') IS NULL
BEGIN
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

    PRINT 'Created table: scheduler.push_subscriptions';
END
ELSE
    PRINT 'Table already exists: scheduler.push_subscriptions';
GO

-- Insert some default notification templates
IF NOT EXISTS (SELECT 1 FROM scheduler.notification_templates WHERE name = 'shift_posted')
BEGIN
    INSERT INTO scheduler.notification_templates (name, channel, subject_template, body_template, variables)
    VALUES
    ('shift_posted', 'email', 'New Shift Available: {{shift_date}}', 'A new shift is available on {{shift_date}} from {{start_time}} to {{end_time}} in {{department}}.', '["shift_date", "start_time", "end_time", "department"]'),
    ('shift_assigned', 'email', 'Shift Assigned: {{shift_date}}', 'You have been assigned to a shift on {{shift_date}} from {{start_time}} to {{end_time}} in {{department}}.', '["shift_date", "start_time", "end_time", "department"]'),
    ('shift_reminder', 'email', 'Reminder: Upcoming Shift', 'Reminder: You have a shift tomorrow {{shift_date}} from {{start_time}} to {{end_time}} in {{department}}.', '["shift_date", "start_time", "end_time", "department"]');

    PRINT 'Inserted default notification templates';
END
GO

PRINT 'Database fix completed successfully';
GO