#!/bin/bash
# scripts/workflow/respond-to-copilot.sh
# Reply to and resolve a single Copilot review thread on a PR.
#
# Agents call this after addressing (or deciding to skip) each Copilot comment.
# The reply is visible on GitHub and the thread is resolved.
#
# Usage:
#   bash scripts/workflow/respond-to-copilot.sh <PR> <path:line> <message>
#
# Examples:
#   bash scripts/workflow/respond-to-copilot.sh 945 "src/lib/blob/config.ts:N/A" "Fixed: extracted pathname before passing to deleteFromBlob. —Claude"
#   bash scripts/workflow/respond-to-copilot.sh 945 "src/lib/blob/config.ts:N/A" "Ignored: these fields ARE used by compression.ts. —Claude"
#
# The <path:line> must match a Copilot comment's file path and line number.
# Use "N/A" for line when the comment has no specific line.
# Sign your replies with your agent name (e.g., "—Claude") in the message itself.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/workflow/_review-config.sh
source "$SCRIPT_DIR/_review-config.sh"

if [ $# -lt 3 ]; then
    echo "Usage: $0 <PR_NUMBER> <path:line> <message>"
    echo ""
    echo "  path:line   File path and line from copilot-comments.sh output (e.g. 'src/foo.ts:42' or 'src/foo.ts:N/A')"
    echo "  message     Brief reply (1 sentence). Sign with agent name (e.g., '—Claude')."
    exit 1
fi

PR=$1
if ! [[ "$PR" =~ ^[0-9]+$ ]]; then
    echo "Error: PR number must be numeric (e.g. '945'); received '$PR'."
    exit 1
fi
PATH_LINE=$2
MESSAGE="${*:3}"

if [[ "$PATH_LINE" != *:* ]]; then
    echo "Error: path:line must include ':' (received '$PATH_LINE')."
    exit 1
fi

# Parse path and line
TARGET_PATH="${PATH_LINE%%:*}"
TARGET_LINE="${PATH_LINE##*:}"
if [ "$TARGET_LINE" = "N/A" ] || [ "$TARGET_LINE" = "null" ]; then
    TARGET_LINE="null"
fi
if [ "$TARGET_LINE" != "null" ] && ! [[ "$TARGET_LINE" =~ ^[0-9]+$ ]]; then
    echo "Error: line must be a number or N/A (received '$TARGET_LINE')."
    exit 1
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
    match=$(echo "$thread_data" | jq -r --arg path "$TARGET_PATH" --argjson bots "$REVIEWER_BOTS_JSON" '
      [.data.repository.pullRequest.reviewThreads.nodes[]
      | select(.isResolved == false)
      | select(.comments.nodes | length > 0)
      | .comments.nodes[0] as $comment
      | select($comment.author.login as $login | $bots | any(. == $login))
      | select($comment.path == $path)
      | select($comment.line == null)
      | {threadId: .id, commentDbId: $comment.databaseId, body: ($comment.body | split("\n")[0] | .[0:60])}]
      | first // empty')
else
    match=$(echo "$thread_data" | jq -r --arg path "$TARGET_PATH" --argjson line "$TARGET_LINE" --argjson bots "$REVIEWER_BOTS_JSON" '
      [.data.repository.pullRequest.reviewThreads.nodes[]
      | select(.isResolved == false)
      | select(.comments.nodes | length > 0)
      | .comments.nodes[0] as $comment
      | select($comment.author.login as $login | $bots | any(. == $login))
      | select($comment.path == $path)
      | select($comment.line == $line)
      | {threadId: .id, commentDbId: $comment.databaseId, body: ($comment.body | split("\n")[0] | .[0:60])}]
      | first // empty')
fi

if [ -z "$match" ] || [ "$match" = "" ]; then
    echo "No unresolved review thread found at ${PATH_LINE}. It may already be resolved."
    exit 1
fi

THREAD_ID=$(echo "$match" | jq -r '.threadId')
COMMENT_DB_ID=$(echo "$match" | jq -r '.commentDbId')
BODY_PREVIEW=$(echo "$match" | jq -r '.body')
DISPLAY_LINE=$TARGET_LINE
if [ "$DISPLAY_LINE" = "null" ]; then
    DISPLAY_LINE="N/A"
fi

echo "Thread: ${TARGET_PATH}:${DISPLAY_LINE}"
echo "Comment: ${BODY_PREVIEW}..."

# Reply via REST using the dedicated replies endpoint
gh api "repos/${OWNER}/${REPO}/pulls/${PR}/comments/${COMMENT_DB_ID}/replies" \
    -f body="${MESSAGE}" --silent || { echo "FAILED to reply"; exit 1; }

echo "Replied: ${MESSAGE}"

# Resolve thread via GraphQL
gh api graphql -f query="
mutation {
  resolveReviewThread(input: {threadId: \"$THREAD_ID\"}) {
    thread { isResolved }
  }
}" --silent || { echo "FAILED to resolve thread"; exit 1; }

echo "Resolved ✓"
