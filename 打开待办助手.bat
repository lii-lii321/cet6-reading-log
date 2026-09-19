@echo off
rem Launch the reading log in Edge app mode (standalone window)
set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" (
  start "" "%~dp0index.html"
  exit /b
)
set "URL=%~dp0index.html"
set "URL=%URL:\=/%"
start "" "%EDGE%" --app="file:///%URL%" --window-size=1080,800
