@echo off
rem ---------------------------------------------------------------------------
rem  ccp - run Claude Code or Codex through ccp-observe.
rem
rem  Drop-in for `claude` / `codex`: your existing settings keep working
rem  (same gateway, same key, same models); requests just go through the local
rem  proxy so the panel has data.
rem
rem  The real work is in ccp_launch.py (stdlib only). This wrapper exists so the
rem  command resolves on PATH without needing a shell script association.
rem
rem  Messages are ASCII on purpose: cmd.exe renders UTF-8 batch files in the
rem  console's OEM code page, which turns Chinese into mojibake. The Python
rem  launcher reconfigures its own stdout and prints Chinese correctly.
rem
rem  Usage:  ccp               auto-pick the installed client, then launch
rem          ccp claude        force Claude Code
rem          ccp codex         force Codex
rem          ccp --agent list  show installed clients and the remembered one
rem          ccp --doctor      show what it found, launch nothing
rem          ccp --no-launch   only make sure the proxy is running
rem          (any other argument is passed through to the client unchanged)
rem ---------------------------------------------------------------------------
setlocal
set "PY="

rem Installed layout: <install>\resources\bin\ccp.cmd ->
rem                   <install>\resources\proxy\ccp_launch.py
rem Checkout layout:  <repo>\bin\ccp.cmd -> <repo>\proxy\ccp_launch.py
if exist "%~dp0..\proxy\ccp_launch.py" (
    set "LAUNCHER=%~dp0..\proxy\ccp_launch.py"
) else if exist "%~dp0proxy\ccp_launch.py" (
    set "LAUNCHER=%~dp0proxy\ccp_launch.py"
) else (
    echo [ccp] ccp_launch.py not found - the installation looks incomplete.
    echo       Reinstall ccp-observe, or run bin\ccp.cmd from a source tree.
    exit /b 2
)

if not defined CCP_PYTHON goto :try_py
"%CCP_PYTHON%" -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 9) else 1)" >nul 2>nul
if not errorlevel 1 set "PY=%CCP_PYTHON%"
if defined PY goto :run

:try_py
py -3 -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 9) else 1)" >nul 2>nul
if not errorlevel 1 set "PY=py -3"
if defined PY goto :run

:try_python
python -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 9) else 1)" >nul 2>nul
if not errorlevel 1 set "PY=python"
if defined PY goto :run

echo [ccp] No usable Python 3.9+ found.
echo       Install Python, or set CCP_PYTHON to the full path of python.exe.
exit /b 2

:run
%PY% "%LAUNCHER%" %*
exit /b %errorlevel%
