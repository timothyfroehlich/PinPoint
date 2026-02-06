#!/bin/bash
# scripts/copilot-comments.sh
# Fetches and formats Copilot review comments for a PR.
# Output is ready to paste into agent prompts.
#
# Usage:
#   ./scripts/copilot-comments.sh 918          # Show Copilot comments
#   ./scripts/copilot-comments.sh 918 --raw    # JSON output

set -euo pipefail

REPO="timothyfroehlich/PinPoint"

if [ $# -lt 1 ]; then
    echo "Usage: $0 <PR_NUMBER> [--raw]"
    exit 1
fi

PR=$1
RAW="${2:-}"

comments=$(gh api "repos/${REPO}/pulls/${PR}/comments" \
    --jq '.[] | select(.user.login == "Copilot") | {path: .path, line: .line, body: .body}' 2>/dev/null)

if [ -z "$comments" ]; then
    echo "No Copilot comments on PR #${PR}."
    exit 0
fi

if [ "$RAW" = "--raw" ]; then
    echo "$comments"
    exit 0
fi

count=$(gh api "repos/${REPO}/pulls/${PR}/comments" \
    --jq '[.[] | select(.user.login == "Copilot")] | length')

echo "## Copilot Comments on PR #${PR} (${count} comments)"
echo ""

gh api "repos/${REPO}/pulls/${PR}/comments" \
    --jq '.[] | select(.user.login == "Copilot") | "### \(.path):\(.line // "N/A")\n\(.body)\n\n---\n"'
