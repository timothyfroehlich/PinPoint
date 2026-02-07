#!/bin/bash
# scripts/respond-to-copilot.sh
# Reply to and resolve a single Copilot review thread on a PR.
#
# Agents call this after addressing (or deciding to skip) each Copilot comment.
# The reply is visible on GitHub and the thread is resolved.
#
# Usage:
#   bash scripts/respond-to-copilot.sh <PR> <path:line> <message>
#
# Examples:
#   bash scripts/respond-to-copilot.sh 945 "src/lib/blob/config.ts:N/A" "Fixed: extracted pathname before passing to deleteFromBlob. —Claude"
#   bash scripts/respond-to-copilot.sh 945 "src/lib/blob/config.ts:N/A" "Ignored: these fields ARE used by compression.ts. —Claude"
#
# The <path:line> must match a Copilot comment's file path and line number.
# Use "N/A" for line when the comment has no specific line.
# Sign your replies with your agent name (e.g., "—Claude") in the message itself.

set -euo pipefail

OWNER="timothyfroehlich"
REPO="PinPoint"

if [ $# -lt 3 ]; then
    echo "Usage: $0 <PR_NUMBER> <path:line> <message>"
    echo ""
    echo "  path:line   File path and line from copilot-comments.sh output (e.g. 'src/foo.ts:42' or 'src/foo.ts:N/A')"
    echo "  message     Brief reply (1 sentence). Sign with agent name (e.g., '—Claude')."
    exit 1
fi

PR=$1
PATH_LINE=$2
MESSAGE=$3

# Parse path and line
TARGET_PATH="${PATH_LINE%%:*}"
TARGET_LINE="${PATH_LINE##*:}"
if [ "$TARGET_LINE" = "N/A" ] || [ "$TARGET_LINE" = "null" ]; then
    TARGET_LINE="null"
fi

# Find the matching unresolved Copilot thread
thread_data=$(gh api graphql -f query="
{
  repository(owner: \"$OWNER\", name: \"$REPO\") {
    pullRequest(number: $PR) {
      reviewThreads(first: 100) {
        nodes {
          id
          isResolved
          comments(first: 1) {
            nodes {
              author { login }
              databaseId
              path
              line
              body
            }
          }
        }
      }
    }
  }
}")

# Find matching thread (match on path, optionally line)
if [ "$TARGET_LINE" = "null" ]; then
    match=$(echo "$thread_data" | jq -r --arg path "$TARGET_PATH" '
      .data.repository.pullRequest.reviewThreads.nodes[]
      | select(.isResolved == false)
      | select(.comments.nodes[0].author.login == "copilot-pull-request-reviewer[bot]")
      | select(.comments.nodes[0].path == $path)
      | select(.comments.nodes[0].line == null)
      | {threadId: .id, commentDbId: .comments.nodes[0].databaseId, body: (.comments.nodes[0].body | split("\n")[0] | .[0:60])}' | head -1)
else
    match=$(echo "$thread_data" | jq -r --arg path "$TARGET_PATH" --argjson line "$TARGET_LINE" '
      .data.repository.pullRequest.reviewThreads.nodes[]
      | select(.isResolved == false)
      | select(.comments.nodes[0].author.login == "copilot-pull-request-reviewer[bot]")
      | select(.comments.nodes[0].path == $path)
      | select(.comments.nodes[0].line == $line)
      | {threadId: .id, commentDbId: .comments.nodes[0].databaseId, body: (.comments.nodes[0].body | split("\n")[0] | .[0:60])}' | head -1)
fi

if [ -z "$match" ] || [ "$match" = "" ]; then
    echo "No unresolved Copilot thread found at ${PATH_LINE}. It may already be resolved."
    exit 0
fi

THREAD_ID=$(echo "$match" | jq -r '.threadId')
COMMENT_DB_ID=$(echo "$match" | jq -r '.commentDbId')
BODY_PREVIEW=$(echo "$match" | jq -r '.body')

echo "Thread: ${TARGET_PATH}:${TARGET_LINE}"
echo "Comment: ${BODY_PREVIEW}..."

# Reply via REST (no review ID needed)
gh api "repos/${OWNER}/${REPO}/pulls/${PR}/comments" \
    -f body="${MESSAGE}" \
    -F in_reply_to="$COMMENT_DB_ID" --silent 2>/dev/null

echo "Replied: ${MESSAGE}"

# Resolve thread via GraphQL
gh api graphql -f query="
mutation {
  resolveReviewThread(input: {threadId: \"$THREAD_ID\"}) {
    thread { isResolved }
  }
}" --silent 2>/dev/null

echo "Resolved ✓"
