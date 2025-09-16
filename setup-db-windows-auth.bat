@echo off
echo Setting up database with Windows Authentication...
echo.

REM Create database
sqlcmd -S localhost\SQLEXPRESS -E -Q "IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'HospitalScheduler') CREATE DATABASE HospitalScheduler;"

REM Use the database and create schema
sqlcmd -S localhost\SQLEXPRESS -E -d HospitalScheduler -Q "IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'scheduler') EXEC('CREATE SCHEMA scheduler');"

REM Create tables
sqlcmd -S localhost\SQLEXPRESS -E -d HospitalScheduler -Q "IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'scheduler' AND TABLE_NAME = 'departments') BEGIN CREATE TABLE scheduler.departments (id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(), code NVARCHAR(50) UNIQUE NOT NULL, name NVARCHAR(100) NOT NULL, hospital_id UNIQUEIDENTIFIER, created_at DATETIME DEFAULT GETDATE(), updated_at DATETIME DEFAULT GETDATE()); END"

sqlcmd -S localhost\SQLEXPRESS -E -d HospitalScheduler -Q "IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'scheduler' AND TABLE_NAME = 'staff') BEGIN CREATE TABLE scheduler.staff (id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(), email NVARCHAR(255) UNIQUE NOT NULL, name NVARCHAR(100) NOT NULL, department_code NVARCHAR(50), role NVARCHAR(50), seniority_date DATE, certifications NVARCHAR(MAX), phone NVARCHAR(20), is_active BIT DEFAULT 1, created_at DATETIME DEFAULT GETDATE(), updated_at DATETIME DEFAULT GETDATE()); END"

sqlcmd -S localhost\SQLEXPRESS -E -d HospitalScheduler -Q "IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'scheduler' AND TABLE_NAME = 'shifts') BEGIN CREATE TABLE scheduler.shifts (id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(), shift_date DATE NOT NULL, start_datetime DATETIME NOT NULL, end_datetime DATETIME NOT NULL, department_id UNIQUEIDENTIFIER, hospital_id UNIQUEIDENTIFIER, required_staff INT DEFAULT 1, status NVARCHAR(50) DEFAULT 'open', created_at DATETIME DEFAULT GETDATE(), created_by UNIQUEIDENTIFIER, updated_at DATETIME DEFAULT GETDATE(), updated_by UNIQUEIDENTIFIER); END"

sqlcmd -S localhost\SQLEXPRESS -E -d HospitalScheduler -Q "IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'scheduler' AND TABLE_NAME = 'shift_assignments') BEGIN CREATE TABLE scheduler.shift_assignments (id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(), shift_id UNIQUEIDENTIFIER NOT NULL, staff_id UNIQUEIDENTIFIER NOT NULL, status NVARCHAR(50) DEFAULT 'assigned', assigned_at DATETIME DEFAULT GETDATE(), response_time_seconds INT, priority_score DECIMAL(5,2), created_at DATETIME DEFAULT GETDATE()); END"

sqlcmd -S localhost\SQLEXPRESS -E -d HospitalScheduler -Q "IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'scheduler' AND TABLE_NAME = 'queue') BEGIN CREATE TABLE scheduler.queue (id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(), shift_id UNIQUEIDENTIFIER NOT NULL, staff_id UNIQUEIDENTIFIER NOT NULL, position INT NOT NULL, priority_score DECIMAL(5,2), status NVARCHAR(50) DEFAULT 'pending', offer_sent_at DATETIME, response_due_at DATETIME, responded_at DATETIME, response NVARCHAR(50), created_at DATETIME DEFAULT GETDATE()); END"

sqlcmd -S localhost\SQLEXPRESS -E -d HospitalScheduler -Q "IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'scheduler' AND TABLE_NAME = 'audit_log') BEGIN CREATE TABLE scheduler.audit_log (id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(), user_id UNIQUEIDENTIFIER, user_email NVARCHAR(255), action NVARCHAR(100), entity_type NVARCHAR(50), entity_id UNIQUEIDENTIFIER, changes NVARCHAR(MAX), ip_address NVARCHAR(45), user_agent NVARCHAR(500), created_at DATETIME DEFAULT GETDATE()); END"

echo.
echo Checking tables...
sqlcmd -S localhost\SQLEXPRESS -E -d HospitalScheduler -Q "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'scheduler' ORDER BY TABLE_NAME"

echo.
echo Database setup complete!