@echo off
echo Starting SQL Server Express...
net start "MSSQL$SQLEXPRESS"

echo.
echo Checking SQL Server status...
sc query "MSSQL$SQLEXPRESS"

echo.
echo Creating database and schema...
sqlcmd -S localhost\SQLEXPRESS -Q "IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'HospitalScheduler') CREATE DATABASE HospitalScheduler;"

sqlcmd -S localhost\SQLEXPRESS -d HospitalScheduler -Q "IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'scheduler') EXEC('CREATE SCHEMA scheduler');"

echo.
echo Creating shifts table...
sqlcmd -S localhost\SQLEXPRESS -d HospitalScheduler -Q "IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'scheduler' AND TABLE_NAME = 'shifts') BEGIN CREATE TABLE scheduler.shifts ( id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(), shift_date DATE NOT NULL, start_datetime DATETIME NOT NULL, end_datetime DATETIME NOT NULL, department_id UNIQUEIDENTIFIER, hospital_id UNIQUEIDENTIFIER, required_staff INT DEFAULT 1, status NVARCHAR(50) DEFAULT 'open', created_at DATETIME DEFAULT GETDATE(), created_by UNIQUEIDENTIFIER, updated_at DATETIME DEFAULT GETDATE(), updated_by UNIQUEIDENTIFIER ); END"

echo.
echo Database setup complete!
pause