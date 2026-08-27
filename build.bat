@echo off
cd /d D:\edunex
echo Starting prebuild + build at %date% %time% > D:\edunex\build_output.log
npx expo prebuild --platform android --clean >> D:\edunex\build_output.log 2>&1
cd android
call gradlew.bat assembleRelease --no-daemon >> D:\edunex\build_output.log 2>&1
echo Build finished at %date% %time% >> D:\edunex\build_output.log
