@echo off
REM Create the test directory
mkdir test

REM Define source directories
set "sourcePeerDir=PeerApp\Peer"
set "sourceFrontendDir=PeerApp\front-end"
set "testDir=test"

REM Create peer directories and copy files
for %%i in (1 2 3 4) do (
    REM Create peer folder inside test for each peer
    mkdir "%testDir%\peer%%i\Peer"
    mkdir "%testDir%\peer%%i\front-end"
    
    REM Copy Peer folder content to peer%%i\Peer
    xcopy /E /I "%sourcePeerDir%" "%testDir%\peer%%i\Peer" >nul
    
    REM Copy front-end folder content to peer%%i\front-end
    xcopy /E /I "%sourceFrontendDir%" "%testDir%\peer%%i\front-end" >nul
)

echo All peer directories created and files copied successfully.
pause
