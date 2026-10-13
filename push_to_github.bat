@echo off
title AC Remote - Publicar no GitHub
color 0b
cls
echo ========================================================
echo       A C   R E M O T E   -   G I T H U B   P U S H
echo ========================================================
echo.

set "GIT_CMD=%LOCALAPPDATA%\Programs\Git\cmd\git.exe"

"%GIT_CMD%" remote get-url origin >nul 2>&1
if %errorlevel% neq 0 (
    echo Nenhum repositorio remoto configurado ainda.
    echo.
    echo 1. Vai a https://github.com/new e cria um repositorio
    echo    (ex: ac-remote). Nao marques README nem .gitignore.
    echo.
    set /p REPO_URL="2. Cola aqui o link do repositorio (ex: https://github.com/user/ac-remote.git): "
    
    if "%REPO_URL%"=="" (
        echo [ERRO] Nenhum link introduzido.
        pause
        exit /b 1
    )
    
    "%GIT_CMD%" remote add origin %REPO_URL%
    echo [+] Remoto 'origin' adicionado com sucesso!
)

echo.
echo A enviar ficheiros para o GitHub (branch main)...
"%GIT_CMD%" branch -M main
"%GIT_CMD%" push -u origin main

if %errorlevel% equ 0 (
    echo.
    echo ========================================================
    echo  [SUCESSO] O teu projeto esta agora no GitHub!
    echo  Agora podes ir a vercel.com e importar com 1 clique!
    echo ========================================================
) else (
    echo.
    echo [AVISO] Se o GitHub pedir autenticacao, podes iniciar
    echo sessao na janela do navegador que se abriu.
)

pause
