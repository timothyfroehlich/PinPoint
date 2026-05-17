#!/usr/bin/env bash
# cvh-poll.sh — UserPromptSubmit hook: inject new PP-cvh coordination comments
#
# Fires at the start of each agent turn. Outputs new comments as a system-reminder
# block, or nothing if nothing is new (zero stdout = no injection).
#
# State file: ~/.config/pinpoint/cvh-last-seen-<cwd-basename>
#   Per-checkout isolation: each worktree/session tracks independently.
#
# Self-filter (auto, no env config required): the UserPromptSubmit stdin payload
# carries a `session_id` field. Each Claude session writes its own agent name to
# `~/.config/pinpoint/cvh-self-<session_id>` once at startup. The hook reads that
# file via the session_id from stdin and filters out comments ending with
# `—Claude-<that name>` so an agent never re-injects its own coordination posts.
#
# To register your session's name (run once per session, ideally early):
#   echo "Slingshot" > ~/.config/pinpoint/cvh-self-"$CLAUDE_SESSION_ID"
# Or have the agent run the equivalent inline (any session_id source it can reach).
#
# Backward compat: if no session-keyed file exists, falls back to $CLAUDE_AGENT_NAME
# from the environment (the previous activation scheme).
#
# Agent name suggestions: Plunger, Spinner, Slingshot, Kicker, Bumper, Flipper

set -euo pipefail

# --- Read UserPromptSubmit hook JSON from stdin (best-effort) ---
# Reads stdin if present so we can extract session_id for self-filter lookup.
# Falls through silently if payload is empty or malformed — the hook MUST NOT
# fail user prompts on parse errors.
INPUT=""
if [[ ! -t 0 ]]; then
  INPUT=$(cat)
fi

SESSION_ID=""
if [[ -n "$INPUT" ]]; then
  SESSION_ID=$(
    printf '%s' "$INPUT" | python3 -c "
import sys, json
try:
    print(json.load(sys.stdin).get('session_id') or '')
except Exception:
    print('')
" 2>/dev/null
  ) || SESSION_ID=""
fi

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

# Resolve self agent name. Priority: session-keyed file > env var > unset (no filter).
AGENT_NAME=""
if [[ -n "$SESSION_ID" ]]; then
  SELF_FILE="$STATE_DIR/cvh-self-$SESSION_ID"
  if [[ -f "$SELF_FILE" ]]; then
    AGENT_NAME=$(cat "$SELF_FILE")
  fi
fi
if [[ -z "$AGENT_NAME" ]]; then
  AGENT_NAME="${CLAUDE_AGENT_NAME:-}"
fi

# Build jq self-filter expression. AGENT_NAME is treated as a literal string —
# jq's --arg already shell-quotes it, but we go through string concat for the
# select() body so the filter expression remains simple. Agent names should be
# alphanumeric (Plunger, Spinner, etc.); anything weirder is on the user.
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
