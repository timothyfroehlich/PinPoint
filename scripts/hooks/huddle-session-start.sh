#!/usr/bin/env bash
# huddle-session-start.sh — SessionStart hook: announce session_id and registration state
#
# Fires once at session start. Reads stdin JSON for `session_id`, looks up the
# session's registered name in <main-worktree>/.claude/huddle/session-names.json
# (see huddle-lib.sh for the state-dir resolver), and emits a brief block via
# stdout (which Claude Code surfaces as system context).
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

# --- State directory resolution ---
# See huddle-lib.sh for why state lives in <main-worktree>/.claude/huddle/.
LIB_SCRIPT="$(dirname "$0")/huddle-lib.sh"
if [[ ! -f "$LIB_SCRIPT" ]]; then
  exit 0
fi
# shellcheck source=huddle-lib.sh disable=SC1091
source "$LIB_SCRIPT"
STATE_DIR=$(huddle_state_dir) || exit 0
NAMES_JSON="$STATE_DIR/session-names.json"
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

# --- Rotation check (stub in PR #1357; real check in follow-up rotation PR) ---
ROTATION_CHECK_SCRIPT="$(dirname "$0")/huddle-rotation-check.sh"
if [[ -f "$ROTATION_CHECK_SCRIPT" ]]; then
  # shellcheck source=huddle-rotation-check.sh disable=SC1091
  source "$ROTATION_CHECK_SCRIPT"
  if huddle_rotation_needed; then
    # Real "rotation needed" output lands in the follow-up PR. For now this
    # branch is unreachable (stub returns 1).
    printf '## ⚠️ Huddle rotation needed\n\n'
    printf 'See docs/superpowers/specs/2026-05-17-huddle-system-design.md §7.2\n'
    exit 0
  fi
fi

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
  printf '## Huddle identity\n\n'
  # shellcheck disable=SC2016  # backticks are literal Markdown, not command substitution
  printf 'Your session_id: `%s`\n' "$SESSION_ID"
  printf 'Registered as: **Claude-%s** (self-filter active for your own posts)\n\n' "$NAME"
  printf 'If this scrolls out of context later, recall your name with:\n'
  printf '    bash scripts/hooks/huddle-whoami.sh whoami %s\n\n' "$SESSION_ID"
  # shellcheck disable=SC2016  # backticks are literal Markdown
  printf 'Full reference: `.agent/skills/pinpoint-huddle/SKILL.md`\n'
else
  printf '## Huddle identity — registration needed\n\n'
  # shellcheck disable=SC2016  # backticks are literal Markdown, not command substitution
  printf 'Your session_id: `%s`\n\n' "$SESSION_ID"
  printf 'You are not yet registered in the huddle self-filter map.\n\n'
  printf 'When you receive your first user prompt, derive a short descriptive name\n'
  printf 'for yourself from what you'\''re being asked to do. The name should help Tim\n'
  printf 'recognize at a glance what each parallel Claude is working on.\n\n'
  printf 'Examples:\n'
  printf '  WorktreeHookFix  fixing a worktree hook\n'
  printf '  TestAudit        auditing test coverage\n'
  printf '  DesignBible      working on the design bible\n'
  printf '  DocsSync         keeping docs aligned\n\n'
  printf 'Format: CamelCase, ASCII letters only, under ~20 chars.\n\n'
  printf 'Register with:\n'
  printf '    bash scripts/hooks/huddle-whoami.sh register <YourName> %s\n\n' "$SESSION_ID"
  printf 'If the name is taken, the helper suggests variations.\n'
  # shellcheck disable=SC2016  # backticks are literal Markdown
  printf 'Full reference: `.agent/skills/pinpoint-huddle/SKILL.md`\n'
fi

exit 0
