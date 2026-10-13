@echo off
title Criar Atalho no Ambiente de Trabalho
color 0a
cls

set "CURRENT_DIR=%~dp0"
set "CURRENT_DIR=%CURRENT_DIR:~0,-1%"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$WshShell = New-Object -ComObject WScript.Shell; " ^
  "$Desktop = [Environment]::GetFolderPath('Desktop'); " ^
  "$Shortcut = $WshShell.CreateShortcut(\"$Desktop\AC Remote.lnk\"); " ^
  "$Shortcut.TargetPath = '\"%CURRENT_DIR%\run.bat\"'; " ^
  "$Shortcut.WorkingDirectory = '\"%CURRENT_DIR%\"'; " ^
  "$Shortcut.IconLocation = '\"%CURRENT_DIR%\static\icons\ac_remote.ico,0\"'; " ^
  "$Shortcut.Description = 'AC Remote - Assetto Corsa Controller (Keep-Awake)'; " ^
  "$Shortcut.Save();"

echo ========================================================
echo  [SUCESSO] Atalho 'AC Remote' criado no Ambiente de Trabalho!
echo ========================================================
echo.
pause
