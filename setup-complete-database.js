/**
 * Complete Database Setup for Hospital Scheduler
 * This script creates the database, schema, and all tables needed
 */

const sql = require('mssql');
require('dotenv').config();

const config = {
  server: process.env.DB_SERVER || 'localhost\\SQLEXPRESS',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'ChangeThisStrongPassword!',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true
  }
};

async function setupDatabase() {
  let connection;

  try {
    console.log('🔄 Connecting to SQL Server...');

    // Connect to master database first
    connection = await sql.connect({ ...config, database: 'master' });
    console.log('✅ Connected to SQL Server');

    // Create database if it doesn't exist
    console.log('🔄 Creating database if not exists...');
    await connection.query(`
      IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'HospitalScheduler')
      BEGIN
        CREATE DATABASE HospitalScheduler;
        PRINT 'Database created';
      END
      ELSE
      BEGIN
        PRINT 'Database already exists';
      END
    `);
    console.log('✅ Database ready');

    // Switch to HospitalScheduler database
    await connection.close();
    connection = await sql.connect({ ...config, database: 'HospitalScheduler' });
    console.log('✅ Connected to HospitalScheduler database');

    // Create schema
    console.log('🔄 Creating scheduler schema...');
    await connection.query(`
      IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'scheduler')
      BEGIN
        EXEC('CREATE SCHEMA scheduler');
        PRINT 'Schema created';
      END
      ELSE
      BEGIN
        PRINT 'Schema already exists';
      END
    `);
    console.log('✅ Schema ready');

    // Create tables
    console.log('🔄 Creating tables...');

    // Departments table
    await connection.query(`
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES
                     WHERE TABLE_SCHEMA = 'scheduler' AND TABLE_NAME = 'departments')
      BEGIN
        CREATE TABLE scheduler.departments (
          id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
          code NVARCHAR(50) UNIQUE NOT NULL,
          name NVARCHAR(100) NOT NULL,
          hospital_id UNIQUEIDENTIFIER,
          created_at DATETIME DEFAULT GETDATE(),
          updated_at DATETIME DEFAULT GETDATE()
        );
        PRINT 'Departments table created';
      END
    `);

    // Staff table
    await connection.query(`
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES
                     WHERE TABLE_SCHEMA = 'scheduler' AND TABLE_NAME = 'staff')
      BEGIN
        CREATE TABLE scheduler.staff (
          id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
          email NVARCHAR(255) UNIQUE NOT NULL,
          name NVARCHAR(100) NOT NULL,
          department_code NVARCHAR(50),
          role NVARCHAR(50),
          seniority_date DATE,
          certifications NVARCHAR(MAX),
          phone NVARCHAR(20),
          is_active BIT DEFAULT 1,
          created_at DATETIME DEFAULT GETDATE(),
          updated_at DATETIME DEFAULT GETDATE()
        );
        PRINT 'Staff table created';
      END
    `);

    // Shifts table
    await connection.query(`
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES
                     WHERE TABLE_SCHEMA = 'scheduler' AND TABLE_NAME = 'shifts')
      BEGIN
        CREATE TABLE scheduler.shifts (
          id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
          shift_date DATE NOT NULL,
          start_datetime DATETIME NOT NULL,
          end_datetime DATETIME NOT NULL,
          department_id UNIQUEIDENTIFIER,
          hospital_id UNIQUEIDENTIFIER,
          required_staff INT DEFAULT 1,
          status NVARCHAR(50) DEFAULT 'open',
          created_at DATETIME DEFAULT GETDATE(),
          created_by UNIQUEIDENTIFIER,
          updated_at DATETIME DEFAULT GETDATE(),
          updated_by UNIQUEIDENTIFIER
        );
        PRINT 'Shifts table created';
      END
    `);

    // Shift assignments table
    await connection.query(`
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES
                     WHERE TABLE_SCHEMA = 'scheduler' AND TABLE_NAME = 'shift_assignments')
      BEGIN
        CREATE TABLE scheduler.shift_assignments (
          id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
          shift_id UNIQUEIDENTIFIER NOT NULL,
          staff_id UNIQUEIDENTIFIER NOT NULL,
          status NVARCHAR(50) DEFAULT 'assigned',
          assigned_at DATETIME DEFAULT GETDATE(),
          response_time_seconds INT,
          priority_score DECIMAL(5,2),
          created_at DATETIME DEFAULT GETDATE()
        );
        PRINT 'Shift assignments table created';
      END
    `);

    // Queue table
    await connection.query(`
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES
                     WHERE TABLE_SCHEMA = 'scheduler' AND TABLE_NAME = 'queue')
      BEGIN
        CREATE TABLE scheduler.queue (
          id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
          shift_id UNIQUEIDENTIFIER NOT NULL,
          staff_id UNIQUEIDENTIFIER NOT NULL,
          position INT NOT NULL,
          priority_score DECIMAL(5,2),
          status NVARCHAR(50) DEFAULT 'pending',
          offer_sent_at DATETIME,
          response_due_at DATETIME,
          responded_at DATETIME,
          response NVARCHAR(50),
          created_at DATETIME DEFAULT GETDATE()
        );
        PRINT 'Queue table created';
      END
    `);

    // Audit log table
    await connection.query(`
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES
                     WHERE TABLE_SCHEMA = 'scheduler' AND TABLE_NAME = 'audit_log')
      BEGIN
        CREATE TABLE scheduler.audit_log (
          id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
          user_id UNIQUEIDENTIFIER,
          user_email NVARCHAR(255),
          action NVARCHAR(100),
          entity_type NVARCHAR(50),
          entity_id UNIQUEIDENTIFIER,
          changes NVARCHAR(MAX),
          ip_address NVARCHAR(45),
          user_agent NVARCHAR(500),
          created_at DATETIME DEFAULT GETDATE()
        );
        PRINT 'Audit log table created';
      END
    `);

    // Insert sample department if none exist
    const deptCheck = await connection.query(
      "SELECT COUNT(*) as cnt FROM scheduler.departments"
    );

    if (deptCheck.recordset[0].cnt === 0) {
      console.log('🔄 Inserting sample departments...');
      await connection.query(`
        INSERT INTO scheduler.departments (code, name) VALUES
        ('ED', 'Emergency Department'),
        ('ICU', 'Intensive Care Unit'),
        ('SURG', 'Surgery'),
        ('MED', 'Medical Ward'),
        ('PEDS', 'Pediatrics');
      `);
      console.log('✅ Sample departments added');
    }

    // Insert sample staff if none exist
    const staffCheck = await connection.query(
      "SELECT COUNT(*) as cnt FROM scheduler.staff"
    );

    if (staffCheck.recordset[0].cnt === 0) {
      console.log('🔄 Inserting sample staff...');
      await connection.query(`
        INSERT INTO scheduler.staff (email, name, department_code, role, seniority_date) VALUES
        ('nurse1@hospital.com', 'Jane Doe', 'ED', 'RN', '2020-01-15'),
        ('nurse2@hospital.com', 'John Smith', 'ICU', 'RN', '2019-06-01'),
        ('nurse3@hospital.com', 'Mary Johnson', 'SURG', 'RN', '2021-03-20');
      `);
      console.log('✅ Sample staff added');
    }

    console.log('\n✅ Database setup completed successfully!');
    console.log('\nDatabase summary:');

    const tables = await connection.query(`
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = 'scheduler'
      ORDER BY TABLE_NAME
    `);

    console.log('Tables created:');
    tables.recordset.forEach(t => console.log(`  - scheduler.${t.TABLE_NAME}`));

    await connection.close();

  } catch (error) {
    console.error('\n❌ Database setup failed!');
    console.error('Error:', error.message);

    if (error.code === 'ELOGIN') {
      console.error('\n⚠️  Login failed. Please check:');
      console.error('1. SQL Server is configured for SQL Authentication');
      console.error('2. The sa account is enabled');
      console.error('3. The password in .env is correct');
      console.error('\nTo enable SQL Authentication:');
      console.error('1. Open SQL Server Management Studio');
      console.error('2. Right-click server → Properties → Security');
      console.error('3. Select "SQL Server and Windows Authentication mode"');
      console.error('4. Restart SQL Server service');
    }

    process.exit(1);
  }
}

// Run setup
setupDatabase();