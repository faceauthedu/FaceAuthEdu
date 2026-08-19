@echo off
cd /d "%~dp0"
echo.
if not exist node_modules (
  echo  Instalando dependencias por primera vez, un momento...
  call npm install
  echo.
)
echo  FaceAuthEdu se iniciara en http://localhost:8000
echo  Deja esta ventana abierta mientras uses la aplicacion.
echo.
node server.js
pause
