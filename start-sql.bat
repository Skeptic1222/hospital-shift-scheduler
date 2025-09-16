@echo off
echo Starting SQL Server Express...
net start "MSSQL$SQLEXPRESS"
if %errorlevel% equ 0 (
    echo SQL Server started successfully
) else (
    echo SQL Server may already be running or failed to start
)
echo.
echo Checking service status...
sc query "MSSQL$SQLEXPRESS"