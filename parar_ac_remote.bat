@echo off
title AC Remote - Parar Servidor
color 0c
cls

echo ========================================================
echo       A C   R E M O T E   -   P A R A R
echo ========================================================
echo.
echo A encerrar processos do servidor AC Remote...

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Get-CimInstance Win32_Process | Where-Object { ($_.CommandLine -like '*app.py*' -or $_.CommandLine -like '*start_ac_remote*' -or $_.CommandLine -like '*run.bat*') -and $_.ProcessId -ne $PID } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"

echo.
echo [OK] O servidor AC Remote foi encerrado com sucesso!
echo.
timeout /t 3
