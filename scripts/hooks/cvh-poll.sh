#!/usr/bin/env bash
# cvh-poll.sh — UserPromptSubmit hook: inject new PP-cvh coordination comments
#
# Fires at the start of each agent turn. Outputs new comments as a system-reminder
# block, or nothing if nothing is new (zero stdout = no injection).
#
# State file: ~/.config/pinpoint/cvh-last-seen-<cwd-basename>
#   Per-checkout isolation: each worktree/session tracks independently.
#
# Self-filter: set CLAUDE_AGENT_NAME in your environment to suppress re-injection of
#   your own comments. Comments ending with "—Claude-$CLAUDE_AGENT_NAME" are skipped.
#
# Activation options:
#   Shell rc:           export CLAUDE_AGENT_NAME=Plunger
#   .claude/launch.json: add "env": {"CLAUDE_AGENT_NAME": "Plunger"} under the session entry
#
# Agent name suggestions: Plunger, Spinner, Slingshot, Kicker, Bumper, Flipper

set -euo pipefail

STATE_DIR="$HOME/.config/pinpoint"
BASENAME="$(basename "$PWD")"
STATE_FILE="$STATE_DIR/cvh-last-seen-$BASENAME"

mkdir -p "$STATE_DIR"

# Read last-seen timestamp (default "0" → older than any real ISO 8601 date)
if [[ -f "$STATE_FILE" ]]; then
  LAST_SEEN="$(cat "$STATE_FILE")"
else
  LAST_SEEN="0"
fi

# Fetch all PP-cvh comments as JSON
COMMENTS_JSON="$(bd comments PP-cvh --json 2>/dev/null)" || { exit 0; }

# Build jq self-filter expression
AGENT_NAME="${CLAUDE_AGENT_NAME:-}"
if [[ -n "$AGENT_NAME" ]]; then
  SELF_FILTER="| select(.text | endswith(\"—Claude-$AGENT_NAME\") | not)"
else
  SELF_FILTER=""
fi

# Filter to comments newer than last-seen, excluding self
NEW_COMMENTS="$(
  printf '%s' "$COMMENTS_JSON" | jq -r \
    --arg last "$LAST_SEEN" \
    "[.[] | select(.created_at > \$last) $SELF_FILTER] | sort_by(.created_at)"
)"

COUNT="$(printf '%s' "$NEW_COMMENTS" | jq 'length')"

if [[ "$COUNT" -eq 0 ]]; then
  exit 0
fi

# Update last-seen to newest comment's created_at
NEWEST="$(printf '%s' "$NEW_COMMENTS" | jq -r '.[-1].created_at')"
printf '%s' "$NEWEST" > "$STATE_FILE"

# Emit formatted block — becomes <system-reminder> content
printf '## New PP-cvh coordination comments (%d)\n\n' "$COUNT"
printf '%s' "$NEW_COMMENTS" | jq -r '.[] | "**\(.author)** (\(.created_at)):\n\(.text)\n"'

exit 0
