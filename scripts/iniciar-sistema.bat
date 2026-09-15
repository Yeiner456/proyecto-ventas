@echo off
REM ============================================================
REM  INICIAR SISTEMA - Proyecto Ventas SENA
REM  Un clic para encender MySQL + Apache + Backend Laravel
REM ============================================================

REM --- CONFIGURACION: ajustar segun el equipo servidor ---
set XAMPP_DIR=C:\xampp
set BACKEND_DIR=C:\xampp\htdocs\proyecto-ventas\backend
set SERVER_IP=26.208.121.116
REM ^ IP del adaptador "Radmin VPN" (NO la de la LAN fisica del SENA).
REM   Esta es la IP por la que se conectan las sedes en otros municipios.
REM   Queda ligada a este equipo mientras siga siendo el servidor.

title Proyecto Ventas - Encendiendo servicios
echo ==========================================
echo   Iniciando Proyecto Ventas SENA
echo ==========================================

REM mysql_start.bat y apache_start.bat usan rutas relativas internamente,
REM por eso hay que "pararse" dentro de C:\xampp antes de llamarlos.
cd /d "%XAMPP_DIR%"

echo.
echo [1/3] Iniciando MySQL (en su propia ventana)...
start "MySQL - XAMPP" mysql_start.bat
timeout /t 6 /nobreak >nul

echo.
echo [2/3] Iniciando Apache (en su propia ventana)...
start "Apache - XAMPP" apache_start.bat
timeout /t 4 /nobreak >nul

echo.
echo [3/3] Iniciando backend Laravel (accesible en red)...
start "Backend Laravel - Proyecto Ventas" cmd /k "cd /d "%BACKEND_DIR%" && "%XAMPP_DIR%\php\php.exe" artisan serve --host=0.0.0.0 --port=8000"

echo.
echo ==========================================
echo   Sistema listo. Deberian quedar abiertas
echo   3 ventanas: MySQL, Apache y Backend Laravel.
echo   NO las cierres, solo minimizalas.
echo.
echo   Frontend:  http://%SERVER_IP%/proyecto-ventas-front
echo   Backend:   http://%SERVER_IP%:8000/api
echo ==========================================
echo.
pause