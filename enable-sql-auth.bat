@echo off
echo Enabling SQL Authentication and sa account...
echo.

REM Enable sa account and set password
sqlcmd -S localhost\SQLEXPRESS -E -Q "ALTER LOGIN sa ENABLE;"
sqlcmd -S localhost\SQLEXPRESS -E -Q "ALTER LOGIN sa WITH PASSWORD = 'ChangeThisStrongPassword!';"

echo.
echo Testing sa login...
sqlcmd -S localhost\SQLEXPRESS -U sa -P ChangeThisStrongPassword! -Q "SELECT 'SA login successful' as Result"

echo.
echo Granting sa access to database...
sqlcmd -S localhost\SQLEXPRESS -E -d HospitalScheduler -Q "IF NOT EXISTS (SELECT * FROM sys.database_principals WHERE name = 'sa') CREATE USER sa FOR LOGIN sa;"
sqlcmd -S localhost\SQLEXPRESS -E -d HospitalScheduler -Q "ALTER ROLE db_owner ADD MEMBER sa;"

echo.
echo SQL Authentication setup complete!