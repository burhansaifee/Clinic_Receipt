!macro customInstall
  DetailPrint "Adding Windows Firewall Rule for Buvora Clinic Suite..."
  ; Allow incoming traffic on port 49152 specifically or allow the Buvora executable generally
  ExecWait 'netsh advfirewall firewall add rule name="Buvora Clinic Suite" dir=in action=allow program="$INSTDIR\Buvora.exe" enable=yes profile=public,private'
!macroend

!macro customUnInstall
  DetailPrint "Removing Windows Firewall Rule for Buvora Clinic Suite..."
  ExecWait 'netsh advfirewall firewall delete rule name="Buvora Clinic Suite"'
!macroend
