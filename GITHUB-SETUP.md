# GitHub + Firebase Auto-Deploy Setup

## Quick Start (5 minutes)

### 1. Create GitHub Repo
```bash
# Go to https://github.com/new
# Create a new repo called: nishar-telecom-pos
# Choose: Public or Private (your choice)
# DO NOT initialize with README (we have files already)
```

### 2. Push Your Code to GitHub
```bash
# Open PowerShell in your POS folder
git init
git add .
git commit -m "Initial commit: Nishar Telecom POS"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/nishar-telecom-pos.git
git push -u origin main
```

### 3. Connect Firebase to GitHub (Auto-Deploy)
1. Open Firebase Console → Your Project → **Hosting** (left sidebar)
2. Click **Connect repository** button
3. Authorize Firebase to access your GitHub account
4. Select repo: `YOUR_USERNAME/nishar-telecom-pos`
5. Select branch: `main`
6. Set publish directory to: `.` (current directory)
7. Click **Save and deploy**

**Done!** Now every `git push` automatically deploys to Firebase.

---

## How It Works

- You edit files locally
- `git add . && git commit -m "message" && git push`
- Firebase automatically deploys within 1-2 minutes
- Your live site updates instantly
- No manual `firebase deploy` needed!

---

## GitHub Actions Alternative

If you prefer **GitHub Actions** for more control:

1. Get your Firebase Service Account key:
   - Firebase Console → Project Settings → Service Accounts
   - Click **Generate new private key**
   - Save the JSON file

2. Add to GitHub Secrets:
   - Repo → Settings → Secrets and variables → Actions
   - Click **New repository secret**
   - Name: `FIREBASE_SERVICE_ACCOUNT`
   - Paste the entire JSON content

3. Workflow is already in `.github/workflows/deploy.yml`
   - Edit `YOUR_FIREBASE_PROJECT_ID` with your real project ID
   - Push to main
   - GitHub Actions will deploy automatically

---

## Common Tasks

### Make Changes
```bash
# Edit files locally
git add .
git commit -m "Fix: update product prices"
git push
# Firebase deploys within 1-2 minutes
```

### Check Deployment Status
- Go to Firebase Console → Hosting
- You'll see all deployments with dates/times
- Click any deployment to see what changed

### Roll Back
- Firebase Console → Hosting → Deployments
- Click the deployment you want to restore
- Click **Restore** button

### View Live Site
- Firebase Console → Hosting
- Your URL is shown at the top

---

## Important Notes

- `.gitignore` excludes sensitive files (`.firebaserc`, `node_modules`, etc.)
- Never commit `js/firebase.js` config publicly — but it's OK here since rules are restrictive
- `.env` files are ignored if you add them later
- Deploy scripts (`deploy.bat`, `deploy.ps1`) are ignored during Firebase deploy
