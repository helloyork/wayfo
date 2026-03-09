@echo off
setlocal
chcp 65001 >nul
node "%~dp0wayfo.js" %*
