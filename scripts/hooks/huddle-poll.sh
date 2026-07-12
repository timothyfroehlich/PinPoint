#!/usr/bin/env bash
# shellcheck disable=SC2250  # unbraced $vars are consistent throughout this codebase
# huddle-poll.sh — poll PP-cvh for new coordination comments and inject them
#
# Harness-agnostic. Fires from per-harness hook configurations:
#   - Claude Code:  UserPromptSubmit (no throttle) + PostToolUse (throttled),
#                   registered in .claude/settings.json
#   - Antigravity:  mid-trajectory invocation via .agents/hooks/agy-beads-bootstrap.cjs
#   - Other harnesses: route through their own bootstrap shim
# Outputs new comments as a system-reminder block on stdout, or nothing if
# nothing is new (zero stdout = no injection).
#
# Stdin payload schema (Claude Code shape; other harnesses adapt to this via
# their bootstrap shim):
#   UserPromptSubmit:
#     { session_id, transcript_path, cwd, hook_event_name,
#       permission_mode, prompt }
#   PostToolUse:
#     { session_id, transcript_path, cwd, hook_event_name,
#       permission_mode, tool_name, tool_input, tool_response }
# We only read session_id and transcript_path (the latter for subagent
# detection); other fields are ignored.
#
# Throttle (slow-path harnesses only): set HUDDLE_THROTTLE_SECONDS=N in the
# hook command line to gate the slow path to once per N seconds per worktree.
# When unset/zero, the throttle block is skipped entirely → identical to
# pre-throttle behavior. The fast-path skip is the dominant cost path during
# active tool-call bursts; target wall clock <30ms (one date +%s spawn).
#
# Throttle marker: <project>/.agents/.huddle-last-poll, one line of epoch
# seconds. Written on every slow-path entry (whether or not new comments
# were found) — "I polled and there was nothing" is still a poll. Written
# BEFORE the bd fetch so that bd-broken states still get backoff instead
# of triggering one hammer per tool call.
#
# State file: <main-worktree>/.agents/huddle/last-seen-<sha256-of-worktree-root>
#   Per-checkout cursor advancing only when new comments are injected.
#   Shared across all linked worktrees AND all harnesses via huddle-lib.sh's
#   git-common-dir resolver.
#
# Self-filter (auto, no env config required): the stdin payload carries a
# `session_id` field. The hook looks up the agent's name from
# <main-worktree>/.agents/huddle/session-names.json (a JSON
# `{session_id: name}` map). Comments ending with `—<name>` are excluded
# from injection so an agent never re-sees its own coordination posts.
# Registered names should embed the harness (e.g. `Claude-DesignBible`,
# `Antigravity-AgentsMdCleanup`); the sign-off is `—<full-name>`. For
# backward compat the filter also accepts `—Claude-<name>` for older
# unprefixed registrations.
#
# To register a session→name mapping:
#   bash scripts/hooks/huddle-whoami.sh register <Name> <session_id>
#
# Backward compat: also accepts the $CLAUDE_AGENT_NAME env var (the original
# activation scheme); harnesses other than Claude Code should pass session_id
# explicitly via the stdin payload and register through huddle-whoami.sh.
#
# Naming guidance: pick a short descriptive name prefixed with your harness
# (e.g. Claude-WorktreeHookFix, Antigravity-TestAudit, Codex-DesignBible).
# Full reference: `.agents/skills/pinpoint-huddle/SKILL.md`.

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
# other harnesses fall through to $PWD (their bootstrap shim should cd into
# the project root before invoking, which matches Antigravity's behavior).
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$PWD}"
POLL_FILE="$PROJECT_DIR/.agents/.huddle-last-poll"

# === FAST PATH (PostToolUse only — gated by HUDDLE_THROTTLE_SECONDS) ===
# UserPromptSubmit calls this script without HUDDLE_THROTTLE_SECONDS set, so
# this block is skipped entirely → identical to pre-throttle behavior.
#
# Subagent detection is deliberately NOT in the fast path: a bash glob over
# the entire stdin payload would false-positive on any tool_input/tool_response
# that contains the literal substring `/subagents/`. A top-level session
# working with such paths would have ALL its PostToolUse fires silently
# skipped. Instead, subagent skip happens in the slow path via the precise
# jq-based check on `transcript_path` below — and that check runs BEFORE the
# throttle marker write, so subagents still don't advance the throttle clock.
# The only cost: subagent fires that pass the throttle window pay ~50-100ms
# to reach the precise check. Rare and acceptable.
THROTTLE_SECONDS="${HUDDLE_THROTTLE_SECONDS:-0}"
if (( THROTTLE_SECONDS > 0 )); then
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
  *) ;;
esac

# Mark the throttle now — we're committed to a poll. Writing the marker before
# the bd fetch means that if bd is broken or slow, future PostToolUse fires
# still respect the throttle window instead of hammering a sick bd.
mkdir -p "$(dirname "$POLL_FILE")" 2>/dev/null || true
date +%s > "$POLL_FILE" 2>/dev/null || true

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
# Huddle state lives in <main-worktree>/.agents/huddle/ so it's shared
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

# --- Per-machine Dolt sync (throttled, fail-open) ---
# Push local coordination posts and pull peer machines' updates before reading
# root notes, so this session sees the freshest cross-machine state. Throttled
# per-machine (shared marker in STATE_DIR) so many concurrent sessions trigger
# at most one sync per interval. Never blocks the prompt — fully fail-open.
huddle_sync

# --- Bootstrap check ---
# If config.json is missing, the system hasn't been bootstrapped yet.
# Exit silently — huddle-session-start.sh emits the user-visible bootstrap notice.
CONFIG_FILE="$STATE_DIR/config.json"
if [[ ! -f "$CONFIG_FILE" ]]; then
  exit 0
fi
ROOT_ID=$(jq -r '.root_bead_id // ""' "$CONFIG_FILE" 2>/dev/null)
if [[ -z "$ROOT_ID" ]]; then
  exit 0
fi

# --- Fetch root bead JSON (shared by integrity check, rotation check, and slow path) ---
# Fetch once here and reuse below. If bd is unavailable or the bead is
# inaccessible, fail open silently — we do NOT want to emit a false "notes
# malformed" warning when the real issue is a bd outage.
ROOT_JSON=$(bd show "$ROOT_ID" --json 2>/dev/null) || { huddle_warn_degraded; exit 0; }
[[ -n "$ROOT_JSON" ]] || { huddle_warn_degraded; exit 0; }

# --- Root notes integrity check ---
# config.json exists but root notes may be null/malformed (e.g. 2026-05-20
# incident on PP-lt12 where notes were wiped between 00:41 and 01:08 UTC).
# Emit a visible stderr diagnostic so the user knows polling is degraded;
# still exit 0 so the user prompt is not blocked.
NOTES_STR=$(printf '%s' "$ROOT_JSON" | jq -r '.[0].notes // ""' 2>/dev/null || echo "")
NOTES_OK=true
if [[ -z "$NOTES_STR" ]]; then
  NOTES_OK=false
else
  TODAY_CHECK=$(printf '%s' "$NOTES_STR" | python3 -c "
import sys, json
try:
    n = json.loads(sys.stdin.read())
    print(n.get('today_bead', {}).get('id', ''))
except Exception:
    print('')
" 2>/dev/null || echo "")
  if [[ -z "$TODAY_CHECK" ]]; then
    NOTES_OK=false
  fi
fi
if [[ "$NOTES_OK" == false ]]; then
  printf 'huddle-poll: root notes JSON is null or malformed on %s. Run bash scripts/hooks/huddle-bootstrap.sh to recover. Polling skipped this turn.\n' "$ROOT_ID" >&2
  exit 0
fi

# --- Rotation check ---
ROTATION_CHECK_SCRIPT="$(dirname "$0")/huddle-rotation-check.sh"
if [[ -f "$ROTATION_CHECK_SCRIPT" ]]; then
  # shellcheck source=huddle-rotation-check.sh disable=SC1091
  source "$ROTATION_CHECK_SCRIPT"
  # Pass the already-fetched ROOT_JSON so the check reuses it instead of a second
  # bd show (hot-path budget: root show + comments only).
  if huddle_rotation_needed "$ROOT_JSON"; then
    STORED_DATE=""
    # Reuse ROOT_JSON + NOTES_STR already fetched above (avoids a second bd call).
    if [[ -n "$NOTES_STR" ]]; then
      STORED_DATE=$(printf '%s' "$NOTES_STR" | python3 -c "
import sys, json
try:
    n = json.loads(sys.stdin.read())
    print(n.get('today_bead', {}).get('date', ''))
except Exception:
    print('')
" 2>/dev/null || echo "")
    fi
    NOW_DATE=$(date +%F)
    printf '## ⚠️ Huddle rotation needed — DISPATCH NOW, do not defer\n\n'
    printf 'The active coordination bead points to date %s, but today is %s.\n' "$STORED_DATE" "$NOW_DATE"
    printf 'Dispatch the rotation subagent IMMEDIATELY — before other work or your\n'
    printf 'reply. This is a standing instruction, not optional: do NOT skip it,\n'
    printf 'defer it, or ask the user whether to run it. It is safe even if a peer\n'
    printf 'already rotated (the subagent no-ops under a file lock).\n\n'
    printf 'Dispatch template: .agents/skills/pinpoint-huddle/SKILL.md.\n'
    exit 0
  fi
fi

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

# Resolve today's active daily, then fetch its comments.
#
# Fast path: trust the root-notes hint. The rotation check above already confirmed
# today_bead.date == today, so the hint IS today's daily unless it was
# purged/renamed out from under the notes (the PP-9lq5 dangling-pointer hazard).
# The comments fetch doubles as the liveness probe, so the steady-state stays at
# 2 bd calls (the root show above + this comments fetch — plan item 5 budget).
#
# Self-heal: if the hint is missing or dangles (comments fetch fails, or returns
# a non-array), resolve the REAL open "Huddle daily <today>" through the shared
# verified title-query resolver — reusing ROOT_ID + ROOT_JSON already in hand, so
# it makes NO extra root show — then re-fetch. Costs one extra `bd children`
# (+ retry) only on the rare dangling day, never on the hot path. Without this a
# dangling cached pointer would silently stop comment injection until rotation
# repointed notes (the exact PP-9lq5 failure).
TODAY_BEAD_ID=$(printf '%s' "$ROOT_JSON" \
  | jq -r '.[0].notes // "{}" | (fromjson? // {}) | .today_bead.id // ""' 2>/dev/null) || TODAY_BEAD_ID=""

COMMENTS_JSON=""
if [[ -n "$TODAY_BEAD_ID" ]] \
   && COMMENTS_JSON="$(bd comments "$TODAY_BEAD_ID" --json 2>/dev/null)" \
   && printf '%s' "$COMMENTS_JSON" | jq -e 'type == "array"' >/dev/null 2>&1; then
  : # hint is live — COMMENTS_JSON holds its comment array
else
  TODAY_BEAD_ID=$(huddle_today_bead_id "$ROOT_ID" "$ROOT_JSON" 2>/dev/null) || { exit 0; }
  [[ -n "$TODAY_BEAD_ID" ]] || { exit 0; }
  COMMENTS_JSON="$(bd comments "$TODAY_BEAD_ID" --json 2>/dev/null)" || { exit 0; }
fi

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
printf '## New huddle coordination comments (%d)\n\n' "$COUNT"
printf '%s' "$NEW_COMMENTS" | jq -r '.[] | "**\(.author)** (\(.created_at)):\n\(.text)\n"'

exit 0
