-- Create HospitalScheduler Database
IF DB_ID('HospitalScheduler') IS NULL
BEGIN
    CREATE DATABASE [HospitalScheduler];
    PRINT 'Database HospitalScheduler created successfully';
END
ELSE
BEGIN
    PRINT 'Database HospitalScheduler already exists';
END
GO

USE [HospitalScheduler];
GO

-- Create scheduler schema if it doesn't exist
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'scheduler')
BEGIN
    EXEC('CREATE SCHEMA [scheduler]');
    PRINT 'Schema scheduler created successfully';
END
ELSE
BEGIN
    PRINT 'Schema scheduler already exists';
END
GO

PRINT 'Database setup complete';
GO