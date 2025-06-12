# Qodana Cloud Integration Setup

This document provides step-by-step instructions to connect your project to Qodana Cloud for automated code quality analysis.

## Prerequisites

- GitHub repository (public or private)
- JetBrains account
- Access to Qodana Cloud

## Setup Steps

### 1. Connect to Qodana Cloud

1. Visit [Qodana Cloud](https://qodana.cloud)
2. Sign in with your JetBrains account
3. Click "Add Project" or "Connect Repository"
4. Select your GitHub repository from the list
5. Authorize Qodana to access your repository

### 2. Get Your Qodana Token

1. In Qodana Cloud, go to your project settings
2. Navigate to "Tokens" or "API Keys" section
3. Generate a new token for CI/CD integration
4. Copy the token (you'll need it for GitHub Secrets)

### 3. Configure GitHub Secrets

1. Go to your GitHub repository
2. Navigate to Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Name: `QODANA_TOKEN`
5. Value: Paste the token from Qodana Cloud
6. Click "Add secret"

### 4. Enable GitHub Actions

The workflow file is already created at `.github/workflows/qodana.yml`. It will automatically:
- Run on every push to main/master branch
- Run on pull requests
- Can be triggered manually

### 5. Project Configuration

The project is configured with:
- `qodana.yaml` - Main configuration file
- `.qodana/profiles/default.xml` - Analysis profile
- Exclusions for generated files and dependencies
- TypeScript/Node.js specific settings

## Local Analysis

To run Qodana analysis locally:

```bash
# Make sure Docker is installed
./scripts/qodana-local.sh
```

This will:
- Pull the latest Qodana JS analyzer
- Analyze your code
- Generate a report in `qodana-results/`
- Open the HTML report in your browser

## Configuration Files

### qodana.yaml
Main configuration file that specifies:
- Linter type (JavaScript/TypeScript)
- Include/exclude paths
- Analysis thresholds
- Report settings

### Analysis Profile
Custom inspection profile that:
- Enables TypeScript validation
- Configures code quality rules
- Disables irrelevant inspections for this project

## Viewing Results

### In Qodana Cloud
1. Visit your project in Qodana Cloud
2. View analysis results, trends, and quality gates
3. Set up notifications and quality thresholds

### In GitHub
- Check status on pull requests
- View SARIF reports in Security tab
- See analysis comments on code changes

### Locally
- Run `./scripts/qodana-local.sh`
- Open `qodana-results/report/index.html`

## Quality Gates

The project is configured with:
- Fail threshold: 100 issues maximum
- Focuses on critical TypeScript errors
- Excludes UI component libraries
- Includes custom business logic analysis

## Troubleshooting

### Common Issues

1. **Token Error**: Ensure QODANA_TOKEN is correctly set in GitHub Secrets
2. **Analysis Fails**: Check if all dependencies are properly installed
3. **No Results**: Verify include/exclude paths in qodana.yaml

### Getting Help

- Check Qodana Cloud documentation
- Review GitHub Actions logs
- Contact JetBrains support for Qodana issues

## Benefits

With Qodana Cloud integration, you get:
- Automated code quality analysis on every commit
- Trend analysis and quality metrics
- Integration with pull request workflows
- Consistent code quality standards
- Early detection of potential issues