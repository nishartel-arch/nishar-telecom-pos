# GitHub Desktop — Push to GitHub from Windows (Easy Way)

This guide uses **GitHub Desktop** — the simplest way to upload your code without touching PowerShell.

---

## **Step 1: Install GitHub Desktop**

1. Download from [https://desktop.github.com](https://desktop.github.com)
2. Install it (follow default options)
3. Open GitHub Desktop
4. Sign in with your GitHub account

---

## **Step 2: Create a GitHub Repository**

1. Go to [https://github.com/new](https://github.com/new)
2. **Repository name:** `nishar-telecom-pos`
3. **Description:** Point of Sale System for Nishar Telecom
4. Choose **Public** or **Private** (your choice)
5. **DO NOT** check "Initialize this repository with a README"
6. Click **Create repository**

You'll see a page with quick setup instructions. **Copy the repository URL** (it looks like `https://github.com/YOUR_USERNAME/nishar-telecom-pos.git`)

---

## **Step 3: Clone Repository to Your Computer**

1. In GitHub Desktop, click **File** → **Clone Repository**
2. Paste the URL you copied above
3. Choose where to save it (e.g., `C:\Users\YourName\Projects\nishar-telecom-pos`)
4. Click **Clone**

GitHub Desktop will download the empty repo to your computer.

---

## **Step 4: Copy POS Files into the Cloned Folder**

1. Open File Explorer
2. Go to the folder you just cloned (e.g., `C:\Users\YourName\Projects\nishar-telecom-pos`)
3. Copy ALL the POS files here:
   - `index.html`, `login.html`, `billing.html`, etc.
   - `css/` folder
   - `js/` folder
   - `assets/` folder (with logos)
   - `firebase.json`, `.gitignore`, `package.json`
   - etc.

Do **NOT** copy `.git` or `.github` folders (they're already in the cloned repo).

---

## **Step 5: Commit & Push via GitHub Desktop**

1. Go back to GitHub Desktop
2. You'll see all your new files listed on the left
3. Bottom-left corner, write a **Commit message:**
   ```
   Initial commit: Nishar Telecom POS
   ```
4. Click **Commit to main**
5. Click **Publish branch** (or **Push** if it says that)

**That's it!** Your code is now on GitHub.

---

## **How to Make Updates (Going Forward)**

Every time you change files:

1. Edit files in your POS folder (e.g., fix a bug, add a feature)
2. Open GitHub Desktop
3. You'll see the changed files listed
4. Write a commit message (e.g., "Fix: update product prices")
5. Click **Commit to main**
6. Click **Push origin** (top right)

**Your changes are now on GitHub!** Firebase will auto-deploy within 1-2 minutes.

---

## **If You Need to Pull Latest Changes**

If someone else updated the repo (or you're on another computer):

1. Open GitHub Desktop
2. Click **Fetch origin** (top)
3. If there are new changes, click **Pull origin**
4. Your files update automatically

---

## **Common Buttons Explained**

| Button | What it does |
|--------|-------------|
| **Fetch origin** | Check if repo has new changes (doesn't download yet) |
| **Pull origin** | Download new changes from GitHub |
| **Push origin** | Upload your changes to GitHub |
| **Publish branch** | First time pushing a branch to GitHub |

---

## **Troubleshooting**

**Q: "Failed to push — authentication failed"**
A: GitHub Desktop needs to be re-authorized. Click **File** → **Options** → **Accounts** → **Sign out** → Sign back in.

**Q: "There are conflicting changes"**
A: This happens if two people edit the same file. GitHub Desktop will show you the conflicts — choose which version to keep, then commit.

**Q: "My files disappeared!"**
A: Did you accidentally delete from GitHub Desktop? Look at the **History** tab to see what happened, or use **Repository** → **Open in Explorer** to manually check your computer folder.

---

## **You're All Set!**

Now every `Commit → Push` automatically deploys to Firebase Hosting. Your site updates live in 1-2 minutes.

**Happy coding!** 🚀
