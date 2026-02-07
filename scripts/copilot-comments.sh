#!/bin/bash
# scripts/copilot-comments.sh
# Fetches and formats UNRESOLVED Copilot review comments for a PR.
# Output is ready to paste into agent prompts.
#
# Uses GraphQL to distinguish resolved vs unresolved threads, so only
# actionable comments are shown. Resolved threads are hidden.
#
# Usage:
#   ./scripts/copilot-comments.sh 918          # Show unresolved Copilot comments
#   ./scripts/copilot-comments.sh 918 --raw    # JSON output
#   ./scripts/copilot-comments.sh 918 --all    # Include resolved threads too

set -euo pipefail

OWNER="timothyfroehlich"
REPO="PinPoint"

if [ $# -lt 1 ]; then
    echo "Usage: $0 <PR_NUMBER> [--raw|--all]"
    exit 1
fi

PR=$1
MODE="${2:-}"

# Fetch all review threads via GraphQL
threads_json=$(gh api graphql -f query="
{
  repository(owner: \"$OWNER\", name: \"$REPO\") {
    pullRequest(number: $PR) {
      reviewThreads(first: 100) {
        nodes {
          isResolved
          comments(first: 1) {
            nodes {
              author { login }
              body
              path
              line
            }
          }
        }
      }
    }
  }
}")

# Build jq filter based on mode
if [ "$MODE" = "--all" ]; then
    resolved_filter=""
else
    resolved_filter='| select(.isResolved == false)'
fi

# Extract Copilot comments
comments=$(echo "$threads_json" | jq -r "
  [.data.repository.pullRequest.reviewThreads.nodes[]
   $resolved_filter
   | select(.comments.nodes[0].author.login == \"copilot-pull-request-reviewer[bot]\")
   | {
       path: .comments.nodes[0].path,
       line: .comments.nodes[0].line,
       body: .comments.nodes[0].body,
       resolved: .isResolved
     }]")

count=$(echo "$comments" | jq 'length')

if [ "$count" -eq 0 ]; then
    if [ "$MODE" = "--all" ]; then
        echo "No Copilot comments on PR #${PR}."
    else
        echo "No unresolved Copilot comments on PR #${PR}."
    fi
    exit 0
fi

if [ "$MODE" = "--raw" ]; then
    echo "$comments" | jq -c '.[]'
    exit 0
fi

label="unresolved "
if [ "$MODE" = "--all" ]; then
    label=""
fi

echo "## Copilot Comments on PR #${PR} (${count} ${label}comments)"
echo ""

echo "$comments" | jq -r '.[] | "### \(.path):\(.line // "N/A")\n\(.body)\n\n---\n"'
