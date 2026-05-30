Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Nishar Telecom POS - Firebase Deploy" -ForegroundColor Cyan
Write-Host "============================================`n" -ForegroundColor Cyan

Write-Host "Deploying to Firebase Hosting..." -ForegroundColor Green
npx.cmd --yes firebase-tools deploy --only hosting

Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "  Done! Your site is live." -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Read-Host "Press Enter to exit"
