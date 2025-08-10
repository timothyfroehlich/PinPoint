#!/bin/bash

# CI Status Script - Clean, structured GitHub Actions status output
# Based on existing script patterns for consistent formatting

echo "🔍 SYSTEM: github-actions"

# Try to get recent workflow runs, handle errors gracefully
if ! ci_data=$(gh run list --limit=5 --json=status,conclusion,workflowName 2>/dev/null); then
    echo "STATUS: ❓ unknown"
    echo "DETAILS: Unable to check CI status"
    echo "CONTEXT: Check GitHub CLI authentication"
    echo ""
    exit 0
fi

# Parse the JSON response
total_runs=$(echo "$ci_data" | jq length 2>/dev/null || echo "0")

if [ "$total_runs" -eq 0 ]; then
    echo "STATUS: ℹ️ no-data"
    echo "DETAILS: No recent workflow runs found"
    echo "CONTEXT: No CI activity detected"
    echo ""
    exit 0
fi

# Count successful runs
successful=$(echo "$ci_data" | jq 'map(select(.conclusion == "success")) | length' 2>/dev/null || echo "0")

# Count failed runs  
failed=$(echo "$ci_data" | jq 'map(select(.conclusion == "failure")) | length' 2>/dev/null || echo "0")

# Count in-progress runs
in_progress=$(echo "$ci_data" | jq 'map(select(.status == "in_progress")) | length' 2>/dev/null || echo "0")

if [ "$failed" -gt 0 ]; then
    echo "STATUS: ❌ failing"
    echo "DETAILS: $successful/$total_runs successful, $failed failed"
    echo "CONTEXT: CI failures need investigation"
elif [ "$in_progress" -gt 0 ]; then
    echo "STATUS: ⏳ running"
    echo "DETAILS: $successful/$total_runs completed, $in_progress in progress"
    echo "CONTEXT: Workflows currently executing"
else
    echo "STATUS: ✅ passing"
    echo "DETAILS: $successful/$total_runs recent runs successful"
    echo "CONTEXT: All CI checks healthy"
fi

echo ""