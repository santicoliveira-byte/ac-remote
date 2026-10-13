@echo off
title AC Remote - Criar Atalhos no Ambiente de Trabalho
color 0a
cls

set "CURRENT_DIR=%~dp0"
set "CURRENT_DIR=%CURRENT_DIR:~0,-1%"

echo ========================================================
echo       A C   R E M O T E   -   A T A L H O S
echo ========================================================
echo.
echo A criar atalhos no teu Ambiente de Trabalho...

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$WshShell = New-Object -ComObject WScript.Shell; " ^
  "$Desktop = [Environment]::GetFolderPath('Desktop'); " ^
  "$Shortcut1 = $WshShell.CreateShortcut(\"$Desktop\AC Remote.lnk\"); " ^
  "$Shortcut1.TargetPath = '\"%CURRENT_DIR%\start_ac_remote.bat\"'; " ^
  "$Shortcut1.WorkingDirectory = '\"%CURRENT_DIR%\"'; " ^
  "$Shortcut1.IconLocation = '\"%CURRENT_DIR%\static\icons\ac_remote.ico,0\"'; " ^
  "$Shortcut1.Description = 'AC Remote - Servidor PC com Consola (Keep-Awake)'; " ^
  "$Shortcut1.Save(); " ^
  "$Shortcut2 = $WshShell.CreateShortcut(\"$Desktop\AC Remote (Segundo Plano).lnk\"); " ^
  "$Shortcut2.TargetPath = 'wscript.exe'; " ^
  "$Shortcut2.Arguments = '\"%CURRENT_DIR%\iniciar_em_segundo_plano.vbs\"'; " ^
  "$Shortcut2.WorkingDirectory = '\"%CURRENT_DIR%\"'; " ^
  "$Shortcut2.IconLocation = '\"%CURRENT_DIR%\static\icons\ac_remote.ico,0\"'; " ^
  "$Shortcut2.Description = 'AC Remote - Iniciar em Segundo Plano Silencioso'; " ^
  "$Shortcut2.Save();"

echo.
echo ========================================================
echo  [SUCESSO] Atalhos criados no Ambiente de Trabalho:
echo    1. "AC Remote" -> Abre a consola com o IP e logs
echo    2. "AC Remote (Segundo Plano)" -> Corre silenciosamente
echo ========================================================
echo.
pause
