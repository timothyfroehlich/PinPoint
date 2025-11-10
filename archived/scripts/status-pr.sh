#!/bin/bash

# PR Status Script - Check PR status for current branch only
# Based on existing script patterns for consistent formatting

echo "🔍 SYSTEM: pull-requests"

# Get current branch name
current_branch=$(git branch --show-current 2>/dev/null)
if [ -z "$current_branch" ]; then
    echo "STATUS: ❓ unknown"
    echo "DETAILS: Unable to determine current branch"
    echo "CONTEXT: Check git repository status"
    echo ""
    exit 0
fi

# Try to get PR for current branch
if ! pr_data=$(gh pr view --json=number,title,mergeable 2>/dev/null); then
    # No PR found for current branch
    echo "STATUS: ✅ clean"
    echo "DETAILS: No PR for branch '$current_branch'"
    echo "CONTEXT: Branch ready for development"
    echo ""
    exit 0
fi

# Parse PR data
pr_number=$(echo "$pr_data" | jq -r '.number' 2>/dev/null || echo "unknown")
pr_title=$(echo "$pr_data" | jq -r '.title' 2>/dev/null || echo "unknown")
mergeable=$(echo "$pr_data" | jq -r '.mergeable' 2>/dev/null || echo "UNKNOWN")

case "$mergeable" in
    "MERGEABLE")
        echo "STATUS: ✅ ready"
        echo "DETAILS: PR #$pr_number is mergeable"
        echo "CONTEXT: Ready for review and merge"
        ;;
    "CONFLICTING")
        echo "STATUS: ⚠️ conflicts"
        echo "DETAILS: PR #$pr_number has merge conflicts"
        echo "CONTEXT: Resolve conflicts before merging"
        ;;
    *)
        echo "STATUS: ℹ️ pending"
        echo "DETAILS: PR #$pr_number status: $mergeable"
        echo "CONTEXT: Check PR for details"
        ;;
esac

echo ""