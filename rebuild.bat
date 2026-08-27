@echo off
cd /d D:\edunex\android
echo Starting rebuild at %date% %time% > D:\edunex\rebuild.log
set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.20.8-hotspot"
call gradlew.bat assembleRelease --no-daemon >> D:\edunex\rebuild.log 2>&1
echo Finished at %date% %time% Status=%errorlevel% >> D:\edunex\rebuild.log
