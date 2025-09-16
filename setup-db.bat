@echo off
echo Setting up SQL Server Express for Hospital Scheduler...
echo.

REM Check if database exists
sqlcmd -S localhost\SQLEXPRESS -E -Q "IF DB_ID('HospitalScheduler') IS NULL CREATE DATABASE [HospitalScheduler]" -b
if %ERRORLEVEL% EQU 0 (
    echo Database created or already exists.
) else (
    echo Error creating database.
)

REM Use the database
sqlcmd -S localhost\SQLEXPRESS -d HospitalScheduler -E -Q "SELECT 'Database connected successfully'" -b
if %ERRORLEVEL% EQU 0 (
    echo Connected to HospitalScheduler database.
) else (
    echo Error connecting to database.
)

REM Run schema creation script if it exists
if exist "C:\inetpub\wwwroot\scheduler\database-schema-sqlserver.sql" (
    echo Running database schema script...
    sqlcmd -S localhost\SQLEXPRESS -d HospitalScheduler -E -i "C:\inetpub\wwwroot\scheduler\database-schema-sqlserver.sql" -b
    if %ERRORLEVEL% EQU 0 (
        echo Schema created successfully.
    ) else (
        echo Error creating schema.
    )
) else (
    echo Schema file not found.
)

REM Count tables in scheduler schema
sqlcmd -S localhost\SQLEXPRESS -d HospitalScheduler -E -Q "SELECT COUNT(*) as TableCount FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'scheduler'" -b

echo.
echo Setup complete!
echo.
echo Connection details:
echo   Server: localhost\SQLEXPRESS
echo   Database: HospitalScheduler
echo   Authentication: Windows Authentication
echo.
pause