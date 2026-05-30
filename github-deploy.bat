@echo off
echo ============================================
echo   Nishar Telecom POS - Push to GitHub
echo ============================================
echo.

REM --- 1. Make sure Git is installed ---
git --version >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Git is not installed or not on your PATH.
  echo Download it from https://git-scm.com/download/win  then run this again.
  echo.
  pause
  exit /b 1
)

REM --- 2. First run: turn this folder into a Git repo ---
if not exist ".git" (
  echo First run - setting up this folder as a Git repository...
  git init
  git branch -M main
  echo.
)

REM --- 3. Make sure Git knows who you are (needed to commit) ---
git config user.email >nul 2>&1
if not errorlevel 1 goto have_identity
echo Git needs your name and email for commits ^(one-time^).
set /p GITNAME=Your name:
set /p GITEMAIL=Your email:
git config user.name "%GITNAME%"
git config user.email "%GITEMAIL%"
echo.
:have_identity

REM --- 4. Make sure a GitHub repository is linked ---
git remote get-url origin >nul 2>&1
if not errorlevel 1 goto have_remote
echo No GitHub repository is linked yet.
echo Create an EMPTY repo at https://github.com/new  ^(do NOT add a README^)
echo then paste its URL below.
echo Example: https://github.com/yourname/nishar-telecom-pos.git
echo.
set /p REPOURL=Paste GitHub repo URL:
if not defined REPOURL (
  echo [ERROR] No URL entered. Aborting.
  echo.
  pause
  exit /b 1
)
git remote add origin "%REPOURL%"
echo.
:have_remote

REM --- 5. Stage every change ---
echo Staging changes...
git add -A

REM --- 6. Ask for a commit message (press Enter for an automatic one) ---
set "MSG="
set /p MSG=Commit message (press Enter for default):
if "%MSG%"=="" set "MSG=Update %date% %time%"

REM --- 7. Commit (fine if there is nothing new) ---
git commit -m "%MSG%"
if errorlevel 1 echo No new changes to commit - will still push any pending commits.
echo.

REM --- 8. Push to GitHub ---
echo Pushing to GitHub...
git push -u origin HEAD
if not errorlevel 1 goto push_ok

REM --- 8a. Rejected because GitHub is ahead: sync once and retry ---
echo.
echo GitHub has changes your PC doesn't have yet. Trying to sync automatically...
git pull --rebase origin main
if errorlevel 1 (
  echo.
  echo [ERROR] Automatic sync could not finish ^(same file changed in both places^).
  echo To undo the half-done sync, run this once in this folder:
  echo     git rebase --abort
  echo then ask for help merging the two versions.
  echo.
  pause
  exit /b 1
)
echo Synced. Pushing again...
git push -u origin HEAD
if errorlevel 1 (
  echo.
  echo [ERROR] Push still failed. Check your internet and GitHub sign-in, then retry.
  echo   - Not signed in: a browser/login window may have opened - finish it, then retry
  echo   - Wrong repo URL: clear it with  git remote remove origin  then run again
  echo.
  pause
  exit /b 1
)

:push_ok
echo.
echo ============================================
echo   Done! Your code is on GitHub.
echo ============================================
pause
