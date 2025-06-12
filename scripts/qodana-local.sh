#!/bin/bash

# Local Qodana analysis script
# Run this to analyze code quality locally before pushing

echo "🔍 Running Qodana code quality analysis locally..."

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ Error: Docker is required to run Qodana locally"
    echo "Please install Docker and try again"
    exit 1
fi

# Clean previous results
rm -rf qodana-results/

# Run Qodana analysis
docker run --rm -it \
    -v $(pwd):/data/project \
    -v $(pwd)/qodana-results:/data/results \
    jetbrains/qodana-js:latest \
    --show-report

echo "✅ Analysis complete! Results saved to qodana-results/"
echo "📊 Open qodana-results/report/index.html in your browser to view the report"