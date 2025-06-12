#!/bin/bash

# Qodana Cloud Setup Helper Script

echo "🚀 Setting up Qodana Cloud integration..."

# Check if running in a git repository
if [ ! -d ".git" ]; then
    echo "❌ This must be run in a Git repository"
    echo "Initialize with: git init"
    exit 1
fi

# Check if GitHub Actions workflow exists
if [ -f ".github/workflows/qodana.yml" ]; then
    echo "✅ GitHub Actions workflow configured"
else
    echo "❌ GitHub Actions workflow missing"
    exit 1
fi

# Check if qodana.yaml exists
if [ -f "qodana.yaml" ]; then
    echo "✅ Qodana configuration file found"
else
    echo "❌ qodana.yaml configuration missing"
    exit 1
fi

echo ""
echo "📋 Next steps to complete setup:"
echo ""
echo "1. Push this repository to GitHub"
echo "2. Visit https://qodana.cloud and sign in"
echo "3. Connect your GitHub repository"
echo "4. Get your Qodana token from project settings"
echo "5. Add QODANA_TOKEN to GitHub repository secrets"
echo "6. Push a commit to trigger the first analysis"
echo ""
echo "For local analysis, run: ./scripts/qodana-local.sh"
echo ""
echo "✅ Qodana Cloud integration is ready!"