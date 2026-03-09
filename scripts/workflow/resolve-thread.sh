#!/bin/bash
# scripts/workflow/resolve-thread.sh
# Resolve one or more GitHub PR review threads by node ID.
# This is a stopgap until github/github-mcp-server merges PR #1919.
#
# Usage:
#   ./scripts/workflow/resolve-thread.sh <thread-node-id> [thread-node-id...]
#
# Thread node IDs look like: PRRT_kwDOLm3Abc5kXyZ123
# Get them from MCP pull_request_read(method: "get_review_comments").

set -euo pipefail

if [ $# -lt 1 ]; then
    echo "Usage: $0 <thread-node-id> [thread-node-id...]"
    echo "  Resolves GitHub PR review threads by their GraphQL node ID."
    exit 1
fi

FAILED=0

for THREAD_ID in "$@"; do
    if ! [[ "$THREAD_ID" =~ ^PRRT_ ]]; then
        echo "WARN: '$THREAD_ID' doesn't look like a thread node ID (expected PRRT_...). Trying anyway."
    fi

    if gh api graphql -f query="
    mutation {
      resolveReviewThread(input: {threadId: \"$THREAD_ID\"}) {
        thread { isResolved }
      }
    }" --silent 2>/dev/null; then
        echo "Resolved: $THREAD_ID"
    else
        echo "FAILED: $THREAD_ID"
        FAILED=$((FAILED + 1))
    fi
done

if [ "$FAILED" -gt 0 ]; then
    echo "$FAILED thread(s) failed to resolve."
    exit 1
fi
