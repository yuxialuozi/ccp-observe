@echo off
rem ---------------------------------------------------------------------------
rem  Add or remove the bundled `ccp` command from the current user's PATH.
rem
rem  Called by the installer hooks (installer-hooks.nsh), once on install and
rem  once before uninstall. Kept as a small file rather than inlined in NSIS so
rem  the PowerShell quoting stays readable.
rem
rem  Usage: ccp-install-path.cmd install|uninstall
rem ---------------------------------------------------------------------------
setlocal
set "TARGET=%~dp0"
set "TARGET=%TARGET:~0,-1%"
set "MODE=%~1"
if "%MODE%"=="" set "MODE=install"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
 "$d = '%TARGET%'; $p = [Environment]::GetEnvironmentVariable('Path', 'User'); if ($null -eq $p) { $p = '' }; $parts = @($p -split ';' | Where-Object { $_ -ne '' }); if ('%MODE%' -eq 'uninstall') { $parts = @($parts | Where-Object { $_ -ne $d }) } elseif ($parts -notcontains $d) { $parts += $d }; [Environment]::SetEnvironmentVariable('Path', ($parts -join ';'), 'User')"
exit /b 0
