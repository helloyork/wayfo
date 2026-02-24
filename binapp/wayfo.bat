@echo off
setlocal
chcp 65001 >nul

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
