# GitHub Repository Setup Instructions

## Quick Setup Commands

### If you haven't created a GitHub repository yet:

1. **Create a new repository on GitHub:**
   - Go to https://github.com/new
   - Enter repository name (e.g., "data-analytics-platform")
   - Choose public or private
   - DO NOT initialize with README, .gitignore, or license (we already have these)
   - Click "Create repository"

2. **Connect your local repository to GitHub:**
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git branch -M main
   git push -u origin main
   ```

### If you already have a GitHub repository:

```bash
git add .
git commit -m "Add Qodana Cloud integration and code quality setup"
git push origin main
```

## Complete Setup Process

### Step 1: Prepare the repository
```bash
# Check current status
git status

# Add all files including Qodana configuration
git add .

# Commit the changes
git commit -m "Add Qodana Cloud integration with comprehensive code quality analysis"
```

### Step 2: Connect to GitHub (if not already connected)
```bash
# Add your GitHub repository as origin
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# Set main branch as default
git branch -M main

# Push with upstream tracking
git push -u origin main
```

### Step 3: Verify the push
```bash
# Check remote connection
git remote -v

# Verify latest commit
git log --oneline -1
```

## After Pushing to GitHub

1. **Set up Qodana Cloud:**
   - Visit https://qodana.cloud
   - Sign in with your JetBrains account
   - Click "Add Project" or "Connect Repository"
   - Select your GitHub repository
   - Authorize Qodana to access your repository

2. **Configure GitHub Secrets:**
   - Go to your repository settings on GitHub
   - Navigate to "Secrets and variables" → "Actions"
   - Add a new secret:
     - Name: `QODANA_TOKEN`
     - Value: Your token from Qodana Cloud project settings

3. **Trigger first analysis:**
   ```bash
   # Make a small change and push to trigger workflow
   echo "# Data Analytics Platform" > README.md
   git add README.md
   git commit -m "Add project README"
   git push
   ```

## Files Ready for GitHub

The repository includes:
- ✅ Qodana configuration (`qodana.yaml`)
- ✅ GitHub Actions workflow (`.github/workflows/qodana.yml`)
- ✅ Analysis profile (`.qodana/profiles/default.xml`)
- ✅ Setup scripts (`scripts/`)
- ✅ Documentation (`QODANA_SETUP.md`)
- ✅ Updated `.gitignore`

## Troubleshooting

**Authentication issues:**
```bash
# Use personal access token for HTTPS
git remote set-url origin https://YOUR_TOKEN@github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# Or use SSH (if configured)
git remote set-url origin git@github.com:YOUR_USERNAME/YOUR_REPO_NAME.git
```

**Force push (use carefully):**
```bash
git push --force-with-lease origin main
```

Your repository is fully prepared for GitHub and Qodana Cloud integration!