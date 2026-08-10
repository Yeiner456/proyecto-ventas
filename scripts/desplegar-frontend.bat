@echo off
REM ============================================================
REM  DESPLEGAR FRONTEND - Proyecto Ventas SENA
REM  Ejecutar SOLO cuando haya cambios en el codigo del frontend.
REM  No hace falta correrlo cada vez que se enciende el sistema.
REM ============================================================

REM --- CONFIGURACION: ajustar si las rutas son distintas ---
set FRONTEND_DIR=C:\xampp\htdocs\proyecto-ventas\frontend
set DEPLOY_DIR=C:\xampp\htdocs\proyecto-ventas-front

echo ==========================================
echo   Compilando frontend (npm run build)
echo ==========================================
cd /d "%FRONTEND_DIR%"
call npm run build

if errorlevel 1 (
    echo.
    echo [ERROR] La compilacion fallo. Revisa los mensajes anteriores.
    pause
    exit /b 1
)

echo.
echo ==========================================
echo   Copiando build a htdocs
echo ==========================================

REM Limpia el despliegue anterior y copia el nuevo build
if exist "%DEPLOY_DIR%" (
    rmdir /s /q "%DEPLOY_DIR%"
)
mkdir "%DEPLOY_DIR%"
xcopy "%FRONTEND_DIR%\dist\*" "%DEPLOY_DIR%\" /E /I /Y

echo.
echo ==========================================
echo   Listo. Frontend desplegado en:
echo   %DEPLOY_DIR%
echo ==========================================
pause