@echo off
setlocal EnableDelayedExpansion

set "ROOT=%~dp0"
cd /d "%ROOT%"

set "BACKEND_PORT=3000"
set "FRONTEND_PORT=5172"
set "WAIT_SECONDS=120"

:menu
cls
echo ==========================================
echo   ATO Launcher
echo   Root: %ROOT%
echo ==========================================
echo [1] Start app (npm run dev)
echo [2] Stop app
echo [3] Check status
echo [4] Exit
echo.
set /p choice=Select action (1-4): 

if "%choice%"=="1" goto start_app
if "%choice%"=="2" goto stop_app
if "%choice%"=="3" goto status_app
if "%choice%"=="4" goto end
goto menu

:start_app
call :is_port_listening %FRONTEND_PORT%
if "!PORT_LISTENING!"=="1" (
  echo Frontend is already listening on %FRONTEND_PORT%.
  start "" "http://localhost:%FRONTEND_PORT%"
  echo.
  pause
  goto menu
)

echo Starting app in a new terminal...
start "ATO Dev" cmd /k "cd /d ""%ROOT%"" && npm run dev"
echo Waiting for frontend to be ready on %FRONTEND_PORT%...
call :wait_frontend_ready %WAIT_SECONDS%
if errorlevel 1 (
  echo Frontend was not reachable after %WAIT_SECONDS%s.
  echo Please check the "ATO Dev" terminal window for errors.
) else (
  echo Opening browser: http://localhost:%FRONTEND_PORT%
  start "" "http://localhost:%FRONTEND_PORT%"
)
echo.
pause
goto menu

:stop_app
echo Stopping processes listening on ports %BACKEND_PORT% and %FRONTEND_PORT%...
call :kill_by_port %BACKEND_PORT%
call :kill_by_port %FRONTEND_PORT%
echo Done.
echo.
pause
goto menu

:status_app
echo.
call :print_port_status %BACKEND_PORT% Backend
call :print_port_status %FRONTEND_PORT% Frontend
echo.
pause
goto menu

:is_port_listening
set "PORT_LISTENING=0"
set "_PORT=%~1"
for /f "tokens=*" %%L in ('netstat -ano ^| findstr /R /C:":%_PORT% .*LISTENING"') do (
  set "PORT_LISTENING=1"
  goto :eof
)
goto :eof

:wait_frontend_ready
set "_MAX=%~1"
set /a "_COUNT=0"
:wait_loop
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:%FRONTEND_PORT%' -TimeoutSec 2; if ($r.StatusCode -ge 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>nul
if not errorlevel 1 exit /b 0
if !_COUNT! GEQ !_MAX! exit /b 1
set /a "_COUNT+=1"
timeout /t 1 /nobreak >nul
goto wait_loop

:kill_by_port
set "_PORT=%~1"
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%_PORT% .*LISTENING"') do (
  if not "%%P"=="0" (
    taskkill /PID %%P /T /F >nul 2>nul
  )
)
goto :eof

:print_port_status
set "_PORT=%~1"
set "_NAME=%~2"
set "_FOUND=0"
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%_PORT% .*LISTENING"') do (
  set "_FOUND=1"
  echo - !_NAME! port !_PORT!: LISTENING (PID %%P)
)
if "!_FOUND!"=="0" echo - !_NAME! port !_PORT!: NOT LISTENING
goto :eof

:end
endlocal
exit /b 0
