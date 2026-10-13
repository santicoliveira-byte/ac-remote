@echo off
title AC Remote - Assetto Corsa Controller (Keep-Awake Ativo)
color 0a
cls

:: Mudar imediatamente para a pasta onde este ficheiro .bat esta localizado
cd /d "%~dp0"

echo ========================================================
echo    A C   R E M O T E   -   A S S E T T O   C O R S A  
echo ========================================================
echo.

:: 1. Procurar executavel real do Python no PC (evitando o stub WindowsApps)
set "PY_CMD="

:: Prioridade 1: Instalacao padrao de utilizador (Python 3.11 / 3.12 / etc.)
for /d %%D in ("%LOCALAPPDATA%\Programs\Python\Python3*") do (
    if exist "%%D\python.exe" set "PY_CMD=%%D\python.exe"
)

:: Prioridade 2: Instalacao em Program Files
if not defined PY_CMD (
    for /d %%D in ("C:\Program Files\Python3*") do (
        if exist "%%D\python.exe" set "PY_CMD=%%D\python.exe"
    )
)

:: Prioridade 3: Python Launcher (py.exe)
if not defined PY_CMD (
    where py >nul 2>&1
    if %errorlevel% equ 0 (
        py -3 --version >nul 2>&1
        if %errorlevel% equ 0 set "PY_CMD=py -3"
    )
)

:: Prioridade 4: python no PATH (apenas se nao for o stub da Microsoft Store)
if not defined PY_CMD (
    where python >nul 2>&1
    if %errorlevel% equ 0 (
        python --version >nul 2>&1
        if %errorlevel% equ 0 set "PY_CMD=python"
    )
)

if not defined PY_CMD (
    echo [ERRO] O Python nao foi encontrado neste computador!
    echo.
    echo Por favor instala o Python a partir de https://python.org
    echo e marca a opcao "Add Python to PATH" durante a instalacao.
    echo.
    pause
    exit /b 1
)

echo [+] Python detetado: %PY_CMD%

:: 2. Verificar e instalar dependencias silenciosamente
echo [+] A verificar dependencias do AC Remote...
%PY_CMD% -m pip install -q -r requirements.txt >nul 2>&1

:: 3. Iniciar o servidor AC Remote
echo.
echo ========================================================
echo  [+] MODO KEEP-AWAKE ATIVADO:
echo      O Windows nao ira suspender nem desconectar o iPhone!
echo ========================================================
echo.

%PY_CMD% app.py

pause
