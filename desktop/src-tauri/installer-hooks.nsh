; ccp-observe NSIS installer hooks.
;
; Installing the desktop app puts the whole proxy under
;   $INSTDIR\resources\proxy
; and the `ccp` launcher under
;   $INSTDIR\resources\bin
;
; The only thing left for "type ccp in a terminal and it just works" is a PATH
; entry. It goes into the *user* PATH (HKCU) because the NSIS bundle installs
; per-user by default and must not require elevation.
;
; The PATH edit itself lives in ccp-install-path.cmd so the PowerShell quoting
; stays readable and the same script handles install and uninstall.

!macro NSIS_HOOK_POSTINSTALL
  DetailPrint "Registering ccp on PATH"
  nsExec::ExecToLog 'cmd /C ""$INSTDIR\resources\bin\ccp-install-path.cmd" install"'
  Pop $0
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  DetailPrint "Removing ccp from PATH"
  nsExec::ExecToLog 'cmd /C ""$INSTDIR\resources\bin\ccp-install-path.cmd" uninstall"'
  Pop $0
!macroend
