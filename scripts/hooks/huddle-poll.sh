#!/usr/bin/env bash
# huddle-poll.sh — poll PP-cvh for new coordination comments and inject them
#
# Fires from two registered hook events (see .claude/settings.json):
#   - UserPromptSubmit  → always polls (no throttle env var set)
#   - PostToolUse       → polls at most once per HUDDLE_THROTTLE_SECONDS
# Outputs new comments as a system-reminder block on stdout, or nothing if
# nothing is new (zero stdout = no injection).
#
# Stdin payload schema (per https://code.claude.com/docs/en/hooks):
#   UserPromptSubmit:
#     { session_id, transcript_path, cwd, hook_event_name,
#       permission_mode, prompt }
#   PostToolUse:
#     { session_id, transcript_path, cwd, hook_event_name,
#       permission_mode, tool_name, tool_input, tool_response }
# We only read session_id and transcript_path (the latter for subagent
# detection); other fields are ignored.
#
# Throttle (PostToolUse only): set HUDDLE_THROTTLE_SECONDS=N in the hook
# command line to gate the slow path to once per N seconds per worktree.
# When unset/zero, the throttle block is skipped entirely → identical to
# pre-throttle behavior. The fast-path skip is the dominant cost path during
# active tool-call bursts; target wall clock <30ms (one date +%s spawn).
#
# Throttle marker: $CLAUDE_PROJECT_DIR/.claude/.huddle-last-poll, one line
# of epoch seconds. Written on every slow-path entry (whether or not new
# comments were found) — "I polled and there was nothing" is still a poll.
# Written BEFORE the bd fetch so that bd-broken states still get backoff
# instead of triggering one hammer per tool call.
#
# State file: <main-worktree>/.claude/huddle/last-seen-<sha256-of-worktree-root>
#   Per-checkout cursor advancing only when new comments are injected.
#   Shared across all linked worktrees via huddle-lib.sh's git-common-dir
#   resolver.
#
# Self-filter (auto, no env config required): the stdin payload carries a
# `session_id` field. The hook looks up the agent's name from
# <main-worktree>/.claude/huddle/session-names.json (a JSON
# `{session_id: name}` map). Comments ending with `—Claude-<name>` or
# `—<name>` are excluded from injection so an agent never re-sees its own
# coordination posts. To register a session→name mapping:
#   bash scripts/hooks/huddle-whoami.sh register <Name> <session_id>
#
# Backward compat: also accepts the $CLAUDE_AGENT_NAME env var (the original
# activation scheme).
#
# Naming guidance: pick a short descriptive name based on your current work
# (e.g. WorktreeHookFix, TestAudit, DesignBible). Full reference:
# `.agent/skills/pinpoint-huddle/SKILL.md`.

set -euo pipefail

# Fail-open on missing dependencies — this hook runs on every UserPromptSubmit
# and PostToolUse and MUST NOT block a user prompt or tool call because jq or
# python3 aren't installed. (bd is also required but its absence is handled
# inline at the call site.)
for dep in jq python3; do
  command -v "$dep" >/dev/null 2>&1 || exit 0
done

# --- Read hook JSON from stdin (best-effort, spawn-free) ---
# Use the bash `read` builtin with -d '' (read until NUL → effectively until
# EOF for JSON payloads) instead of $(cat) to avoid a subshell+fork on the
# fast path. Read failure on EOF is expected; `|| true` keeps `set -e` happy.
INPUT=""
if [[ ! -t 0 ]]; then
  IFS= read -r -d '' INPUT || true
fi

# Throttle marker path (used by fast-path check and slow-path write).
# CLAUDE_PROJECT_DIR is set by the Claude Code harness for hook invocations;
# the fallback to $PWD is defensive (and matches the settings.json pattern
# `bash "${CLAUDE_PROJECT_DIR:-.}"/...`).
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$PWD}"
POLL_FILE="$PROJECT_DIR/.claude/.huddle-last-poll"

# === FAST PATH (PostToolUse only — gated by HUDDLE_THROTTLE_SECONDS) ===
# UserPromptSubmit calls this script without HUDDLE_THROTTLE_SECONDS set, so
# this block is skipped entirely → identical to pre-throttle behavior.
THROTTLE_SECONDS="${HUDDLE_THROTTLE_SECONDS:-0}"
if (( THROTTLE_SECONDS > 0 )); then
  # Subagent skip via pure-bash glob match — no spawn. A false positive is
  # benign (just an extra throttle skip); the slow path keeps its own precise
  # jq-based check on `transcript_path` as defense in depth.
  case "$INPUT" in *'/subagents/'*) exit 0 ;; esac

  if [[ -f "$POLL_FILE" ]]; then
    LAST_POLL=0
    read -r LAST_POLL < "$POLL_FILE" 2>/dev/null || LAST_POLL=0
    if [[ "$LAST_POLL" =~ ^[0-9]+$ ]]; then
      NOW=$(date +%s)
      if (( NOW - LAST_POLL < THROTTLE_SECONDS )); then
        exit 0  # throttled — skip this fire
      fi
    fi
  fi
fi

# === SLOW PATH ===

# Skip subagent sessions. Subagent transcripts live at
# <project>/<session>/subagents/<agent>.jsonl, while top-level sessions land
# at <project>/<session>.jsonl. Subagents are ephemeral and must not
# participate in huddle coordination — they neither poll nor inject.
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

# Mark the throttle now — we're committed to a poll. Writing the marker before
# the bd fetch means that if bd is broken or slow, future PostToolUse fires
# still respect the throttle window instead of hammering a sick bd.
mkdir -p "$(dirname "$POLL_FILE")" 2>/dev/null || true
date +%s > "$POLL_FILE" 2>/dev/null || true

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

# --- State directory resolution ---
# Huddle state lives in <main-worktree>/.claude/huddle/ so it's shared
# across all linked worktrees of the same clone. huddle-lib.sh provides
# the resolver. If we can't find a git common-dir (e.g., hook fired outside
# any PinPoint checkout), fail open silently — coordination is optional.
LIB_SCRIPT="$(dirname "$0")/huddle-lib.sh"
if [[ ! -f "$LIB_SCRIPT" ]]; then
  exit 0
fi
# shellcheck source=huddle-lib.sh disable=SC1091
source "$LIB_SCRIPT"
STATE_DIR=$(huddle_state_dir) || exit 0
mkdir -p "$STATE_DIR"

# Derive a per-checkout key from the worktree root (not the hook's CWD).
# Earlier versions hashed `pwd -P`, but that varied if the hook fired from a
# subdirectory of the checkout (e.g. `cd src/` then triggering a UserPromptSubmit
# would land on a different cursor and replay already-seen comments).
# `git rev-parse --show-toplevel` returns the current worktree's root path
# (main or linked); same key regardless of where the hook fired within it.
# We hash that path with SHA-256 for a collision-resistant, filename-safe key.
WORKTREE_ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
CWD_KEY=$(printf '%s' "$WORKTREE_ROOT" | python3 -c 'import sys,hashlib; print(hashlib.sha256(sys.stdin.read().encode()).hexdigest()[:16])')
STATE_FILE="$STATE_DIR/last-seen-$CWD_KEY"

# Read last-seen timestamp (default "0" → older than any real ISO 8601 date)
if [[ -f "$STATE_FILE" ]]; then
  LAST_SEEN="$(cat "$STATE_FILE")"
else
  LAST_SEEN="0"
fi

# Fetch all PP-cvh comments as JSON
COMMENTS_JSON="$(bd comments PP-cvh --json 2>/dev/null)" || { exit 0; }

# Resolve self agent name. Priority order:
#   1. <STATE_DIR>/session-names.json[session_id] (canonical)
#   2. $CLAUDE_AGENT_NAME env var (back-compat with original activation)
#   3. unset → no self-filter applied
AGENT_NAME=""
NAMES_JSON="$STATE_DIR/session-names.json"
if [[ -n "$SESSION_ID" ]] && [[ -f "$NAMES_JSON" ]]; then
  AGENT_NAME=$(jq -r --arg sid "$SESSION_ID" '.[$sid] // ""' "$NAMES_JSON" 2>/dev/null || echo "")
fi
if [[ -z "$AGENT_NAME" ]]; then
  AGENT_NAME="${CLAUDE_AGENT_NAME:-}"
fi

# Build the self-filter as a jq script that takes the agent name as --arg
# (NOT interpolated into the jq source string), so a name containing quotes,
# backslashes, or jq syntax can't break the filter. We accept both forms of
# sign-off to be forgiving of typos and convention drift:
#   --Claude-<Name>   (canonical — 44 of 45 PP-cvh sign-offs use this form)
#   --<Name>          (shorthand — observed in the wild, e.g. "—Spinner")
# When $name is empty, the filter is a no-op (all comments pass).
# shellcheck disable=SC2016  # $last and $name are jq variables, NOT shell vars
JQ_SCRIPT='[
  .[]
  | select(.created_at > $last)
  | select($name == ""
           or (((.text | endswith("—Claude-" + $name))
                or (.text | endswith("—" + $name))) | not))
] | sort_by(.created_at)'

# Filter to comments newer than last-seen, excluding self.
# Both jq calls below could fail in pathological cases (e.g. malformed JSON);
# treat any failure as "no comments to inject" and exit silently.
NEW_COMMENTS=$(
  printf '%s' "$COMMENTS_JSON" | jq -r \
    --arg last "$LAST_SEEN" \
    --arg name "$AGENT_NAME" \
    "$JQ_SCRIPT" 2>/dev/null
) || exit 0

COUNT=$(printf '%s' "$NEW_COMMENTS" | jq 'length' 2>/dev/null) || exit 0

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
