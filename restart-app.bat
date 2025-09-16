@echo off
echo Restarting scheduler application...

REM Recycle application pool
%windir%\system32\inetsrv\appcmd recycle apppool /apppool.name:"scheduler"

REM Stop and start the site
%windir%\system32\inetsrv\appcmd stop site /site.name:"scheduler"
timeout /t 2 /nobreak > nul
%windir%\system32\inetsrv\appcmd start site /site.name:"scheduler"

echo Application restarted!