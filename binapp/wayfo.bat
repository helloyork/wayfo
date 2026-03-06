@echo off
setlocal
chcp 65001 >nul

REM Change to project root directory (parent of binapp)
cd /d "%~dp0.."
set "LOG_FILE=%TEMP%\wayfo-service.log"
set "LOG_ERR_FILE=%TEMP%\wayfo-service.err.log"

if "%~1"=="" goto :usage
if /I "%~1"=="launch" goto :launch
if /I "%~1"=="stop" goto :stop
if /I "%~1"=="update" goto :update
if /I "%~1"=="status" goto :status
goto :usage

:launch
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
set "SERVICE_URL=http://127.0.0.1:3999"
call :is_running
if %errorlevel%==0 (
  echo Wayfo service already running. Attaching logs...
  goto :logs
)

echo Starting Wayfo service...
call :ensure_log_files
call :ensure_yarn
if %errorlevel% NEQ 0 exit /b %errorlevel%
call :ensure_service_build
if %errorlevel% NEQ 0 exit /b %errorlevel%
call :start_service "%~2"
echo Service log: %LOG_FILE%
echo Service error log: %LOG_ERR_FILE%

call :wait_for_service
if %errorlevel% NEQ 0 exit /b %errorlevel%
:logs
curl -N %SERVICE_URL%/logs/stream
goto :eof

:stop
set "SERVICE_URL=http://127.0.0.1:3999"
call :is_running
if %errorlevel%==1 (
  echo Wayfo service is not running.
  exit /b 1
)
powershell -NoProfile -Command "$null = Invoke-RestMethod -Method Post -Uri '%SERVICE_URL%/stop'"
echo Stop request sent.
goto :eof

:update
set "SERVICE_URL=http://127.0.0.1:3999"
call :is_running
if %errorlevel%==0 (
  echo Stopping Wayfo service...
  powershell -NoProfile -Command "$null = Invoke-RestMethod -Method Post -Uri '%SERVICE_URL%/stop'"
  timeout /t 1 /nobreak >nul
)
git pull
if errorlevel 1 exit /b %errorlevel%
call yarn install
echo Restarting Wayfo service...
call :ensure_log_files
call :ensure_yarn
if %errorlevel% NEQ 0 exit /b %errorlevel%
call :ensure_service_build_always
if %errorlevel% NEQ 0 exit /b %errorlevel%
call :start_service
goto :eof

:status
set "SERVICE_URL=http://127.0.0.1:3999"
call :is_running
if %errorlevel%==0 (
  echo Wayfo service is running.
) else (
  echo Wayfo service is not running.
)
goto :eof

:usage
echo Usage: wayfo ^<launch^|stop^|update^|status^> [--dev]
exit /b 1

:is_running
powershell -NoProfile -Command "$ProgressPreference='SilentlyContinue'; try { $null = iwr -UseBasicParsing -TimeoutSec 1 '%SERVICE_URL%/status'; exit 0 } catch { exit 1 }"
exit /b %errorlevel%

:wait_for_service
set "WAIT_COUNT=0"
:wait_for_service_loop
call :is_running
if %errorlevel%==0 exit /b 0
set /a WAIT_COUNT+=1
if %WAIT_COUNT% GEQ 30 (
  echo Wayfo service did not start within 30 seconds.
  call :show_start_error
  exit /b 1
)
timeout /t 1 /nobreak >nul
goto :wait_for_service_loop

:show_start_error
if not exist "%LOG_FILE%" if not exist "%LOG_ERR_FILE%" exit /b 0
echo Last logs:
if exist "%LOG_FILE%" powershell -NoProfile -Command "Get-Content -Path '%LOG_FILE%' -Tail 200"
if exist "%LOG_ERR_FILE%" powershell -NoProfile -Command "Get-Content -Path '%LOG_ERR_FILE%' -Tail 200"
exit /b 0

:ensure_log_files
type nul > "%LOG_FILE%"
type nul > "%LOG_ERR_FILE%"
exit /b 0

:ensure_yarn
where yarn >nul 2>nul
if %errorlevel% NEQ 0 (
  echo Yarn not found in PATH.
  exit /b 1
)
exit /b 0

:ensure_service_build
REM Ensure service build exists before starting.
if exist "apps\service\dist\index.js" exit /b 0
echo Service build not found. Building...
call yarn workspace @wayfo/service build
if errorlevel 1 exit /b %errorlevel%
exit /b 0

:ensure_service_build_always
REM Always build service during update.
echo Building service...
call yarn workspace @wayfo/service build
if errorlevel 1 exit /b %errorlevel%
exit /b 0

:start_service
if /I "%~1"=="--dev" (
  powershell -NoProfile -Command "$outPath = '%LOG_FILE%'; $errPath = '%LOG_ERR_FILE%'; Start-Process -WindowStyle Hidden -FilePath 'cmd.exe' -ArgumentList '/c','yarn','workspace','@wayfo/service','dev' -WorkingDirectory '%cd%' -RedirectStandardOutput $outPath -RedirectStandardError $errPath"
) else (
  powershell -NoProfile -Command "$outPath = '%LOG_FILE%'; $errPath = '%LOG_ERR_FILE%'; Start-Process -WindowStyle Hidden -FilePath 'cmd.exe' -ArgumentList '/c','yarn','workspace','@wayfo/service','start' -WorkingDirectory '%cd%' -RedirectStandardOutput $outPath -RedirectStandardError $errPath"
)
exit /b 0
