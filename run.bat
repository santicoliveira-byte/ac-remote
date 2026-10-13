@echo off
title AC Remote - Assetto Corsa Controller (Keep-Awake Ativo)
color 0c
cls

cd /d "%~dp0"

echo ========================================================
echo    A C   R E M O T E   -   A S S E T T O   C O R S A
echo ========================================================
echo.

:: 1. Procurar executavel real do Python no PC
set "PY_CMD="

for /d %%D in ("%LOCALAPPDATA%\Programs\Python\Python3*") do (
    if exist "%%D\python.exe" set "PY_CMD=%%D\python.exe"
)

if not defined PY_CMD (
    for /d %%D in ("C:\Program Files\Python3*") do (
        if exist "%%D\python.exe" set "PY_CMD=%%D\python.exe"
    )
)

if not defined PY_CMD (
    where py >nul 2>&1
    if %errorlevel% equ 0 (
        py -3 --version >nul 2>&1
        if %errorlevel% equ 0 set "PY_CMD=py -3"
    )
)

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

:: 2. Garantir que as dependencias estao instaladas
echo [+] A verificar dependencias (Flask, requests, pillow, psutil, pydirectinput, keyboard)...
%PY_CMD% -m pip install -q -r requirements.txt >nul 2>&1

:: 3. Iniciar o servidor
echo.
echo ========================================================
echo  [+] MODO KEEP-AWAKE ATIVADO:
echo      O Windows nao vai suspender nem desligar a ligacao!
echo ========================================================
echo.

%PY_CMD% app.py

pause
