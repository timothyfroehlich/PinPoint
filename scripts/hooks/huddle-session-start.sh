#!/usr/bin/env bash
# huddle-session-start.sh — SessionStart hook: announce session_id and registration state
#
# Fires once at session start. Reads stdin JSON for `session_id`, looks up the
# session's registered name in ~/.config/pinpoint/huddle-session-names.json, and
# emits a brief block via stdout (which Claude Code surfaces as system context).
#
# Why this exists: agents can't reliably discover their own session_id when
# multiple parallel sessions are active (transcripts share a directory keyed by
# project root, and `ls -t` is racy). The SessionStart hook is the only place
# session_id is guaranteed-correct without an external diagnostic.
#
# Pairs with scripts/hooks/huddle-poll.sh (UserPromptSubmit) — that's the
# new-comment injection hook; this one is just identity announcement.
#
# Stdin payload schema (per https://code.claude.com/docs/en/hooks):
#   {
#     "session_id":       "<UUID>",
#     "transcript_path":  "<path to .jsonl>",
#     "cwd":              "<current working dir>",
#     "hook_event_name":  "SessionStart",
#     "source":           "startup" | "resume" | "clear" | "compact",
#     "model":            "<model id>",
#     "agent_type":       "<name>"  (optional, when launched with --agent)
#   }
#
# We suppress the announcement on `source=compact` because the agent already
# saw it pre-compaction — re-emitting it is noise. All other source values
# (startup, resume, clear) get the announcement.

set -euo pipefail

STATE_DIR="$HOME/.config/pinpoint"
NAMES_JSON="$STATE_DIR/huddle-session-names.json"
mkdir -p "$STATE_DIR"

# Read stdin JSON (best-effort; never fail SessionStart on parse errors)
INPUT=""
if [[ ! -t 0 ]]; then
  INPUT=$(cat)
fi

# Skip subagent sessions (see huddle-poll.sh for rationale).
TRANSCRIPT_PATH=""
if [[ -n "$INPUT" ]]; then
  TRANSCRIPT_PATH=$(
    printf '%s' "$INPUT" | python3 -c "
import sys, json
try:
    print(json.load(sys.stdin).get('transcript_path') or '')
except Exception:
    print('')
" 2>/dev/null
  ) || TRANSCRIPT_PATH=""
fi
case "$TRANSCRIPT_PATH" in
  */subagents/*) exit 0 ;;
esac

SESSION_ID=""
SOURCE=""
if [[ -n "$INPUT" ]]; then
  read -r SESSION_ID SOURCE <<<"$(
    printf '%s' "$INPUT" | python3 -c "
import sys, json
try:
    p = json.load(sys.stdin)
    print((p.get('session_id') or '') + ' ' + (p.get('source') or ''))
except Exception:
    print(' ')
" 2>/dev/null
  )" || { SESSION_ID=""; SOURCE=""; }
fi

# If we have no session_id, silently exit — the user's PP-cvh participation is optional.
if [[ -z "$SESSION_ID" ]]; then
  exit 0
fi

# Suppress announcement on compact — agent already saw it pre-compaction.
if [[ "$SOURCE" == "compact" ]]; then
  exit 0
fi

# Look up registered name
NAME=""
if [[ -f "$NAMES_JSON" ]]; then
  NAME=$(jq -r --arg sid "$SESSION_ID" '.[$sid] // ""' "$NAMES_JSON" 2>/dev/null || echo "")
fi

if [[ -n "$NAME" ]]; then
  printf '## PP-cvh identity\n\n'
  # shellcheck disable=SC2016  # backticks are literal Markdown, not command substitution
  printf 'Your session_id: `%s`\n' "$SESSION_ID"
  printf 'Registered as: **Claude-%s** (self-filter active for your own posts)\n\n' "$NAME"
  printf 'If this scrolls out of context later, recall your name with:\n\n'
  printf '    bash scripts/hooks/huddle-whoami.sh whoami %s\n' "$SESSION_ID"
else
  printf '## PP-cvh identity — registration needed\n\n'
  # shellcheck disable=SC2016  # backticks are literal Markdown, not command substitution
  printf 'Your session_id: `%s`\n\n' "$SESSION_ID"
  printf 'You are not yet registered in the PP-cvh self-filter map.\n'
  printf 'Ask the user what name to use, then run:\n\n'
  printf '    bash scripts/hooks/huddle-whoami.sh register <YourName> %s\n\n' "$SESSION_ID"
  printf 'Until registered, your own comments on PP-cvh will re-inject into your context on every turn.\n'
fi

exit 0
