@echo off
echo ============================================
echo   Nishar Telecom POS - Firebase Deploy
echo ============================================
echo.

echo Deploying to Firebase Hosting...
call npx.cmd --yes firebase-tools deploy --only hosting

echo.
echo ============================================
echo   Done! Your site is live.
echo ============================================
pause
