@echo off
setlocal
chcp 65001 >nul

REM Change to project root directory (parent of binapp)
cd /d "%~dp0.."

echo(  ==============================================
echo(^|^| ██╗    ██╗ █████╗ ██╗   ██╗███████╗ ██████╗  ^|^|
echo(^|^| ██║    ██║██╔══██╗╚██╗ ██╔╝██╔════╝██╔═══██╗ ^|^|
echo(^|^| ██║ █╗ ██║███████║ ╚████╔╝ █████╗  ██║   ██║ ^|^|
echo(^|^| ██║███╗██║██╔══██║  ╚██╔╝  ██╔══╝  ██║   ██║ ^|^|
echo(^|^| ╚███╔███╔╝██║  ██║   ██║   ██║     ╚██████╔╝ ^|^|
echo(^|^|  ╚══╝╚══╝ ╚═╝  ╚═╝   ╚═╝   ╚═╝      ╚═════╝  ^|^|
echo(^|^| Wayfo by Nomen(https://github.com/helloyork) ^|^|
echo(  ==============================================
echo(

if "%~1"=="" goto :usage
if /I "%~1"=="launch" goto :launch
if /I "%~1"=="stop" goto :stop
if /I "%~1"=="update" goto :update
goto :usage

::launch
set "SERVICE_URL=http://127.0.0.1:3999"
call :is_running
if %errorlevel%==0 (
  echo Wayfo service already running. Attaching logs...
  goto :logs
)

echo Starting Wayfo service...
if /I "%~2"=="--dev" (
  powershell -NoProfile -Command "Start-Process -WindowStyle Hidden -FilePath 'yarn' -ArgumentList 'workspace','@wayfo/service','dev' -WorkingDirectory '%cd%'"
) else (
  powershell -NoProfile -Command "Start-Process -WindowStyle Hidden -FilePath 'yarn' -ArgumentList 'workspace','@wayfo/service','start' -WorkingDirectory '%cd%'"
)

timeout /t 1 /nobreak >nul
:logs
curl -N %SERVICE_URL%/logs/stream
goto :eof

::stop
set "SERVICE_URL=http://127.0.0.1:3999"
call :is_running
if %errorlevel%==1 (
  echo Wayfo service is not running.
  exit /b 1
)
powershell -NoProfile -Command "Invoke-RestMethod -Method Post -Uri '%SERVICE_URL%/stop' | Out-Null"
echo Stop request sent.
goto :eof

::update
set "SERVICE_URL=http://127.0.0.1:3999"
call :is_running
if %errorlevel%==0 (
  echo Wayfo service is running.
  echo Please run: wayfo stop
  exit /b 1
)
git pull
if errorlevel 1 exit /b %errorlevel%
yarn install
goto :eof

::usage
echo Usage: wayfo ^<launch^|stop^|update^> [--dev]
exit /b 1

::is_running
powershell -NoProfile -Command "$ProgressPreference='SilentlyContinue'; try { iwr -UseBasicParsing -TimeoutSec 1 '%SERVICE_URL%/status' | Out-Null; exit 0 } catch { exit 1 }"
exit /b %errorlevel%
@echo off
setlocal
chcp 65001 >nul

REM Change to project root directory (parent of binapp)
cd /d "%~dp0.."

echo(  ==============================================
echo(^|^| ██╗    ██╗ █████╗ ██╗   ██╗███████╗ ██████╗  ^|^|
echo(^|^| ██║    ██║██╔══██╗╚██╗ ██╔╝██╔════╝██╔═══██╗ ^|^|
echo(^|^| ██║ █╗ ██║███████║ ╚████╔╝ █████╗  ██║   ██║ ^|^|
echo(^|^| ██║███╗██║██╔══██║  ╚██╔╝  ██╔══╝  ██║   ██║ ^|^|
echo(^|^| ╚███╔███╔╝██║  ██║   ██║   ██║     ╚██████╔╝ ^|^|
echo(^|^|  ╚══╝╚══╝ ╚═╝  ╚═╝   ╚═╝   ╚═╝      ╚═════╝  ^|^|
echo(^|^| Wayfo by Nomen(https://github.com/helloyork) ^|^|
echo(  ==============================================
echo(

if "%~1"=="" goto :usage
if /I "%~1"=="launch" goto :launch
if /I "%~1"=="update" goto :update
goto :usage

:launch
yarn launch
goto :eof

:update
git pull
if errorlevel 1 exit /b %errorlevel%
yarn install
goto :eof

:usage
echo Usage: wayfo ^<launch^|update^>
exit /b 1
