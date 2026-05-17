@echo off
title Calendario de Produccion - Ferralia v4
color 0A
echo.
echo  ================================================
echo   CALENDARIO DE PRODUCCION - FERRALIA v4
echo   Piera y Viladecans
echo  ================================================
echo.

REM Try portable node first
if exist "node\node.exe" (
    echo  Usando Node.js portable...
    node\node.exe server.js
    goto end
)

REM Try system node
where node >nul 2>&1
if %errorlevel% == 0 (
    echo  Usando Node.js del sistema...
    node server.js
    goto end
)

echo  ERROR: No se encontro Node.js.
echo.
echo  Instala Node.js desde https://nodejs.org
echo  Descarga el instalador Windows (.msi) LTS
echo.
pause
:end
