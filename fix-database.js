const sql = require('mssql');
require('dotenv').config();

const config = {
  server: process.env.DB_SERVER || 'localhost\\SQLEXPRESS',
  database: process.env.DB_NAME || 'HospitalScheduler',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'ChangeThisStrongPassword!',
  options: {
    trustServerCertificate: true,
    enableArithAbort: true,
    encrypt: false
  }
};

async function fixDatabase() {
  let pool;

  try {
    console.log('Connecting to database...');
    pool = await sql.connect(config);

    // Create notification_templates table if it doesn't exist
    console.log('Checking notification_templates table...');
    const templateTableExists = await pool.request()
      .query(`SELECT OBJECT_ID('scheduler.notification_templates', 'U') AS exists_flag`);

    if (!templateTableExists.recordset[0].exists_flag) {
      console.log('Creating notification_templates table...');
      await pool.request().query(`
        CREATE TABLE scheduler.notification_templates (
          id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
          name NVARCHAR(100) NOT NULL,
          channel NVARCHAR(50) NOT NULL,
          subject_template NVARCHAR(500),
          body_template NVARCHAR(MAX),
          variables NVARCHAR(MAX) DEFAULT '[]',
          is_active BIT DEFAULT 1,
          created_at DATETIME2 DEFAULT GETUTCDATE(),
          updated_at DATETIME2 DEFAULT GETUTCDATE()
        )
      `);
      console.log('✓ Created notification_templates table');
    } else {
      console.log('✓ notification_templates table already exists');
    }

    // Create notifications table if it doesn't exist
    console.log('Checking notifications table...');
    const notifTableExists = await pool.request()
      .query(`SELECT OBJECT_ID('scheduler.notifications', 'U') AS exists_flag`);

    if (!notifTableExists.recordset[0].exists_flag) {
      console.log('Creating notifications table...');
      await pool.request().query(`
        CREATE TABLE scheduler.notifications (
          id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
          user_id UNIQUEIDENTIFIER,
          template_id UNIQUEIDENTIFIER,
          channel NVARCHAR(50) NOT NULL,
          priority INT DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
          subject NVARCHAR(255),
          body NVARCHAR(MAX),
          data NVARCHAR(MAX) DEFAULT '{}',
          status NVARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'read')),
          scheduled_for DATETIME2 DEFAULT GETUTCDATE(),
          sent_at DATETIME2,
          delivered_at DATETIME2,
          read_at DATETIME2,
          error_message NVARCHAR(MAX),
          retry_count INT DEFAULT 0,
          created_at DATETIME2 DEFAULT GETUTCDATE()
        )
      `);

      // Create indexes
      await pool.request().query(`
        CREATE INDEX IX_Notifications_User ON scheduler.notifications(user_id);
        CREATE INDEX IX_Notifications_Status ON scheduler.notifications(status);
        CREATE INDEX IX_Notifications_Scheduled ON scheduler.notifications(scheduled_for);
      `);

      console.log('✓ Created notifications table with indexes');
    } else {
      console.log('✓ notifications table already exists');
    }

    // Create push_subscriptions table if it doesn't exist
    console.log('Checking push_subscriptions table...');
    const pushTableExists = await pool.request()
      .query(`SELECT OBJECT_ID('scheduler.push_subscriptions', 'U') AS exists_flag`);

    if (!pushTableExists.recordset[0].exists_flag) {
      console.log('Creating push_subscriptions table...');
      await pool.request().query(`
        CREATE TABLE scheduler.push_subscriptions (
          id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
          user_id UNIQUEIDENTIFIER,
          endpoint NVARCHAR(2000) NOT NULL,
          p256dh NVARCHAR(512) NOT NULL,
          auth NVARCHAR(256) NOT NULL,
          user_agent NVARCHAR(1024),
          created_at DATETIME2 DEFAULT GETUTCDATE(),
          updated_at DATETIME2 DEFAULT GETUTCDATE(),
          is_active BIT DEFAULT 1
        )
      `);

      await pool.request().query(`
        CREATE INDEX IX_PushSubs_User ON scheduler.push_subscriptions(user_id)
      `);

      console.log('✓ Created push_subscriptions table');
    } else {
      console.log('✓ push_subscriptions table already exists');
    }

    // Insert default notification templates
    console.log('Checking notification templates...');
    const templatesExist = await pool.request()
      .query(`SELECT COUNT(*) as count FROM scheduler.notification_templates`);

    if (templatesExist.recordset[0].count === 0) {
      console.log('Inserting default notification templates...');
      await pool.request().query(`
        INSERT INTO scheduler.notification_templates (name, channel, subject_template, body_template, variables)
        VALUES
        ('shift_posted', 'email', 'New Shift Available: {{shift_date}}', 'A new shift is available on {{shift_date}} from {{start_time}} to {{end_time}} in {{department}}.', '["shift_date", "start_time", "end_time", "department"]'),
        ('shift_assigned', 'email', 'Shift Assigned: {{shift_date}}', 'You have been assigned to a shift on {{shift_date}} from {{start_time}} to {{end_time}} in {{department}}.', '["shift_date", "start_time", "end_time", "department"]'),
        ('shift_reminder', 'email', 'Reminder: Upcoming Shift', 'Reminder: You have a shift tomorrow {{shift_date}} from {{start_time}} to {{end_time}} in {{department}}.', '["shift_date", "start_time", "end_time", "department"]')
      `);
      console.log('✓ Inserted default notification templates');
    } else {
      console.log('✓ Notification templates already exist');
    }

    console.log('\n✅ Database fix completed successfully!');
    console.log('The notifications table error should now be resolved.');

  } catch (error) {
    console.error('Error fixing database:', error.message);
    if (error.originalError) {
      console.error('Original error:', error.originalError.message);
    }
    process.exit(1);
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

// Run the fix
fixDatabase().catch(console.error);