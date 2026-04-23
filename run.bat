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
echo [1] Start BOTH (npm run dev)
echo [2] Start BACKEND only
echo [3] Start FRONTEND only
echo [4] Stop BOTH
echo [5] Stop BACKEND only
echo [6] Stop FRONTEND only
echo [7] Check status
echo [8] Exit
echo.
set /p choice=Select action (1-8): 

if "%choice%"=="1" goto start_both
if "%choice%"=="2" goto start_backend
if "%choice%"=="3" goto start_frontend
if "%choice%"=="4" goto stop_both
if "%choice%"=="5" goto stop_backend
if "%choice%"=="6" goto stop_frontend
if "%choice%"=="7" goto status_app
if "%choice%"=="8" goto end
goto menu

:start_both
call :is_port_listening %FRONTEND_PORT%
if "!PORT_LISTENING!"=="1" (
  echo Frontend is already listening on %FRONTEND_PORT%.
  start "" "http://localhost:%FRONTEND_PORT%"
  echo.
  pause
  goto menu
)
echo Starting BOTH in a new terminal: npm run dev
start "ATO Dev" cmd /k "cd /d ""%ROOT%"" && npm run dev"
echo Waiting for backend (%BACKEND_PORT%) and frontend (%FRONTEND_PORT%)...
call :wait_backend_ready %WAIT_SECONDS%
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

:start_backend
call :is_port_listening %BACKEND_PORT%
if "!PORT_LISTENING!"=="1" (
  echo Backend is already listening on %BACKEND_PORT%.
  echo.
  pause
  goto menu
)
echo Starting BACKEND in a new terminal: npm run dev -w backend
start "ATO Backend Dev" cmd /k "cd /d ""%ROOT%"" && npm run dev -w backend"
echo Waiting for backend on %BACKEND_PORT%...
call :wait_backend_ready %WAIT_SECONDS%
if errorlevel 1 (
  echo Backend was not reachable after %WAIT_SECONDS%s.
  echo Please check the "ATO Backend Dev" terminal window for errors.
) else (
  echo Backend is ready on %BACKEND_PORT%.
)
echo.
pause
goto menu

:start_frontend
call :is_port_listening %FRONTEND_PORT%
if "!PORT_LISTENING!"=="1" (
  echo Frontend is already listening on %FRONTEND_PORT%.
  start "" "http://localhost:%FRONTEND_PORT%"
  echo.
  pause
  goto menu
)
echo Starting FRONTEND in a new terminal: npm run dev -w frontend
start "ATO Frontend Dev" cmd /k "cd /d ""%ROOT%"" && npm run dev -w frontend"
echo Waiting for frontend on %FRONTEND_PORT%...
call :wait_frontend_ready %WAIT_SECONDS%
if errorlevel 1 (
  echo Frontend was not reachable after %WAIT_SECONDS%s.
  echo Please check the "ATO Frontend Dev" terminal window for errors.
) else (
  echo Opening browser: http://localhost:%FRONTEND_PORT%
  start "" "http://localhost:%FRONTEND_PORT%"
)
echo.
pause
goto menu

:stop_both
call :stop_backend
call :stop_frontend
echo.
pause
goto menu

:stop_backend
echo Stopping backend on port %BACKEND_PORT%...
call :kill_by_port %BACKEND_PORT%
goto :eof

:stop_frontend
echo Stopping frontend on port %FRONTEND_PORT%...
call :kill_by_port %FRONTEND_PORT%
goto :eof

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

:wait_backend_ready
set "_MAX=%~1"
set /a "_COUNT=0"
:wait_backend_loop
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:%BACKEND_PORT%/api/health' -TimeoutSec 2; if ($r.StatusCode -ge 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>nul
if not errorlevel 1 exit /b 0
if !_COUNT! GEQ !_MAX! exit /b 1
set /a "_COUNT+=1"
timeout /t 1 /nobreak >nul
goto wait_backend_loop

:wait_frontend_ready
set "_MAX=%~1"
set /a "_COUNT=0"
:wait_frontend_loop
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:%FRONTEND_PORT%' -TimeoutSec 2; if ($r.StatusCode -ge 200) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>nul
if not errorlevel 1 exit /b 0
if !_COUNT! GEQ !_MAX! exit /b 1
set /a "_COUNT+=1"
timeout /t 1 /nobreak >nul
goto wait_frontend_loop

:kill_by_port
set "_PORT=%~1"
set "_KILLED=0"
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%_PORT% .*LISTENING"') do (
  if not "%%P"=="0" (
    set "_KILLED=1"
    taskkill /PID %%P /T /F >nul 2>nul
  )
)
if "!_KILLED!"=="1" (
  echo - Stopped processes on port %_PORT%.
) else (
  echo - No listening process found on port %_PORT%.
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
