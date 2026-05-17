#!/usr/bin/env bash
# cvh-poll.sh — UserPromptSubmit hook: inject new PP-cvh coordination comments
#
# Fires at the start of each agent turn. Outputs new comments as a system-reminder
# block, or nothing if nothing is new (zero stdout = no injection).
#
# Stdin payload schema (per https://code.claude.com/docs/en/hooks):
#   {
#     "session_id":       "<UUID>",
#     "transcript_path":  "<path to .jsonl>",
#     "cwd":              "<current working dir>",
#     "hook_event_name":  "UserPromptSubmit",
#     "permission_mode":  "default" | "plan" | "acceptEdits" | "auto" | "dontAsk" | "bypassPermissions",
#     "prompt":           "<the user's message text>"
#   }
# We only read session_id; the rest is ignored.
#
# State file: ~/.config/pinpoint/cvh-last-seen-<cwd-basename>
#   Per-checkout isolation: each worktree/session tracks independently.
#
# Self-filter (auto, no env config required): the UserPromptSubmit stdin payload
# carries a `session_id` field. The hook reads it and looks up the agent's name
# from `~/.config/pinpoint/cvh-session-names.json`, a JSON map of
# `{session_id: name}`. Comments ending with `—Claude-<that name>` are excluded
# from the injection so an agent never re-injects its own coordination posts.
#
# Why a single JSON map instead of one file per session: agents who restart
# (different transcript file, same logical "session") need a stable lookup their
# resumed turn can perform. The map persists across restarts; the helper
# `scripts/hooks/cvh-whoami.sh` lets an agent recall its own name at any time.
#
# To register a session-to-name mapping (Tim, or the agent itself, runs once):
#   bash scripts/hooks/cvh-whoami.sh register Slingshot
# Or edit ~/.config/pinpoint/cvh-session-names.json directly.
#
# Backward compat: also accepts legacy per-session files at
# `~/.config/pinpoint/cvh-self-<session_id>` (deprecated) and the
# `$CLAUDE_AGENT_NAME` env var (the original activation scheme).
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

# Resolve self agent name. Priority order:
#   1. ~/.config/pinpoint/cvh-session-names.json[session_id] (canonical)
#   2. ~/.config/pinpoint/cvh-self-<session_id> file (legacy, deprecated)
#   3. $CLAUDE_AGENT_NAME env var (back-compat with original activation)
#   4. unset → no self-filter applied
AGENT_NAME=""
NAMES_JSON="$STATE_DIR/cvh-session-names.json"
if [[ -n "$SESSION_ID" ]]; then
  if [[ -f "$NAMES_JSON" ]]; then
    AGENT_NAME=$(jq -r --arg sid "$SESSION_ID" '.[$sid] // ""' "$NAMES_JSON" 2>/dev/null || echo "")
  fi
  if [[ -z "$AGENT_NAME" ]]; then
    SELF_FILE="$STATE_DIR/cvh-self-$SESSION_ID"
    if [[ -f "$SELF_FILE" ]]; then
      AGENT_NAME=$(cat "$SELF_FILE")
    fi
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
