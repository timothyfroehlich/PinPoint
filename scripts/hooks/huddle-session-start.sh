#!/usr/bin/env bash
# shellcheck disable=SC2250  # unbraced $vars are consistent throughout this codebase
# huddle-session-start.sh — SessionStart hook: announce session_id and registration state
#
# Harness-agnostic. Fires at session start from any agent harness that supports
# SessionStart-equivalent hooks (Claude Code via .claude/settings.json,
# Antigravity via .agents/hooks/agy-beads-bootstrap.cjs, etc.). Reads stdin JSON
# for `session_id`, looks up the session's registered name in
# <main-worktree>/.agents/huddle/session-names.json (see huddle-lib.sh for the
# state-dir resolver), and emits a brief identity block on stdout which the
# host harness surfaces as system context.
#
# Why this exists: agents can't reliably discover their own session_id when
# multiple parallel sessions are active. The SessionStart hook is the only
# place session_id is guaranteed-correct without an external diagnostic.
#
# Pairs with scripts/hooks/huddle-poll.sh — that's the new-comment injection
# hook; this one is just identity announcement.
#
# Stdin payload schema (Claude Code shape; other harnesses adapt to this via
# their bootstrap shim — see .agents/hooks/agy-beads-bootstrap.cjs for the
# Antigravity adapter):
#   {
#     "session_id":       "<UUID>",
#     "transcript_path":  "<path to .jsonl>",
#     "cwd":              "<current working dir>",
#     "hook_event_name":  "SessionStart",
#     "source":           "startup" | "resume" | "clear" | "compact",
#     "model":            "<model id>",                       (Claude-only, optional)
#     "agent_type":       "<name>"  (optional, when launched with --agent)
#   }
#
# We suppress the announcement on `source=compact` because the agent already
# saw it pre-compaction — re-emitting it is noise. All other source values
# (startup, resume, clear) get the announcement.

set -euo pipefail

# --- State directory resolution ---
# See huddle-lib.sh for why state lives in <main-worktree>/.agents/huddle/.
LIB_SCRIPT="$(dirname "$0")/huddle-lib.sh"
if [[ ! -f "$LIB_SCRIPT" ]]; then
  exit 0
fi
# shellcheck source=huddle-lib.sh disable=SC1091
source "$LIB_SCRIPT"
STATE_DIR=$(huddle_state_dir) || exit 0
NAMES_JSON="$STATE_DIR/session-names.json"
mkdir -p "$STATE_DIR"

# --- Bootstrap check ---
# If config.json is missing, emit the user-visible bootstrap notice and exit.
# This is the only hook that emits the notice; huddle-poll.sh exits silently.
CONFIG_FILE="$STATE_DIR/config.json"
ROOT_ID=""
if [[ ! -f "$CONFIG_FILE" ]]; then
  MAIN_ROOT=$(dirname "$(git rev-parse --git-common-dir 2>/dev/null || echo ".")" 2>/dev/null || echo "<main-worktree>")
  printf '## ⚠️ Huddle not bootstrapped\n\n'
  printf 'The huddle coordination system is not set up yet. It maintains a daily bead\n'
  printf 'for agents to coordinate on, summarizes each day'\''s chatter into ~50-token\n'
  printf 'digests so it stays cheap to read, and rotates at local midnight.\n\n'
  printf 'To bootstrap, run:\n'
  printf '    bash scripts/hooks/huddle-bootstrap.sh\n\n'
  printf 'That creates the root bead, today'\''s daily, this month'\''s monthly, and writes\n'
  printf '%s/.agents/huddle/config.json with the IDs. Re-running is safe.\n' "$MAIN_ROOT"
  exit 0
fi
ROOT_ID=$(jq -r '.root_bead_id // ""' "$CONFIG_FILE" 2>/dev/null)
if [[ -z "$ROOT_ID" ]]; then
  printf '## ⚠️ Huddle not bootstrapped\n\n'
  printf 'config.json exists but has no root_bead_id. Re-run:\n'
  printf '    bash scripts/hooks/huddle-bootstrap.sh\n'
  exit 0
fi
# Verify the root bead is still reachable. If it was deleted/closed/renamed
# under us, hooks would silently stop injecting — surface a specific notice
# so the user knows to re-bootstrap. `bd show` exits non-zero for missing IDs.
if ! bd show "$ROOT_ID" --json >/dev/null 2>&1; then
  printf '## ⚠️ Huddle root bead missing\n\n'
  # shellcheck disable=SC2016  # backticks are literal Markdown, not command substitution
  printf 'config.json points at %s but `bd show %s` failed.\n' "$ROOT_ID" "$ROOT_ID"
  printf 'The bead may have been deleted, archived, or the bd workspace moved.\n\n'
  printf 'To rebuild:\n'
  printf '    bash scripts/hooks/huddle-bootstrap.sh\n'
  exit 0
fi

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
  *) ;;
esac

# --- Rotation check ---
ROTATION_CHECK_SCRIPT="$(dirname "$0")/huddle-rotation-check.sh"
if [[ -f "$ROTATION_CHECK_SCRIPT" ]]; then
  # shellcheck source=huddle-rotation-check.sh disable=SC1091
  source "$ROTATION_CHECK_SCRIPT"
  if huddle_rotation_needed; then
    STORED_DATE=""
    NOTES_STR_ROT=$(bd show "$ROOT_ID" --json 2>/dev/null | jq -r '.[0].notes // ""' 2>/dev/null || echo "")
    if [[ -n "$NOTES_STR_ROT" ]]; then
      STORED_DATE=$(printf '%s' "$NOTES_STR_ROT" | python3 -c "
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
    printf 'defer it, or ask the user whether to run it. It will summarize the\n'
    printf 'previous day, create today'\''s bead, update pointers, and post\n'
    printf '"continued in" markers on closed beads. Safe even if a peer already\n'
    printf 'rotated (the subagent no-ops under a file lock).\n\n'
    printf 'Dispatch template: .agents/skills/pinpoint-huddle/SKILL.md.\n'
    exit 0
  fi
fi

SESSION_ID=""
SOURCE=""
if [[ -n "$INPUT" ]]; then
  # python3 failure is handled by the read's `|| { … }` fallback; ignore masked return.
  # shellcheck disable=SC2312
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

# If we have no session_id, silently exit — huddle participation is optional.
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
  printf 'Registered as: **%s** (self-filter active for your own posts)\n\n' "$NAME"
  printf 'If this scrolls out of context later, recall your name with:\n'
  printf '    bash scripts/hooks/huddle-whoami.sh whoami %s\n\n' "$SESSION_ID"
  # Resolve today_bead_id for the copy-paste command (fail-open: fall back to placeholder)
  _TODAY_ID_REG=$(huddle_today_bead_id 2>/dev/null) || _TODAY_ID_REG="<today-bead-id>"
  [[ -n "$_TODAY_ID_REG" ]] || _TODAY_ID_REG="<today-bead-id>"
  printf 'Once you understand what this session is tackling — and it'\''s real work or an\n'
  printf 'investigation (not a quick question or one-line fix) — post a ONE-LINE kickoff to\n'
  printf 'today'\''s bead, once, so parallel sessions know and anyone with context can chime in:\n'
  printf '    bd comments add %s "Starting: <what> in <area/branch>. Ping me if you have context. —%s"\n\n' "$_TODAY_ID_REG" "$NAME"
  printf 'Also post when you: file a bead for a non-obvious finding ("Filed PP-xxx: <finding>"),\n'
  printf 'or touch an area others may conflict on ("Working on <file/area> in <branch>; flag if conflict").\n'
  printf '  (Merges and PR opens are auto-posted — no manual action needed for those.)\n'
  printf '    bd comments add %s "Your update. —%s"\n\n' "$_TODAY_ID_REG" "$NAME"
  printf 'If a peer'\''s kickoff scrolls by and you have specific relevant context — a conflict,\n'
  printf 'a gotcha, a related in-flight branch/bead — reply with it; don'\''t ack-spam.\n\n'
  # shellcheck disable=SC2016  # backticks are literal Markdown — bd comments command, not substitution
  printf 'Before you post, READ the thread first (`bd comments %s`) and scan for claims on\n' "$_TODAY_ID_REG"
  printf 'files you'\''re about to touch. The poll hook injects new comments on your prompts,\n'
  printf 'NOT before your own posts — so the latest may not be in your context, and you can\n'
  printf 'post into a channel you haven'\''t checked this turn. If a peer flagged a conflict\n'
  printf 'with your area, surface the heads-up and address it BEFORE you merge.\n\n'
  # shellcheck disable=SC2016  # backticks are literal Markdown
  printf 'Full reference: `.agents/skills/pinpoint-huddle/SKILL.md`\n'
else
  printf '## Huddle identity — registration needed\n\n'
  # shellcheck disable=SC2016  # backticks are literal Markdown, not command substitution
  printf 'Your session_id: `%s`\n\n' "$SESSION_ID"
  printf 'You are not yet registered in the huddle self-filter map.\n\n'
  printf 'When you receive your first user prompt, derive a short descriptive name\n'
  printf 'for yourself from what you'\''re being asked to do, prefixed with your\n'
  printf 'harness name so Tim can recognize at a glance which agent stack each\n'
  printf 'parallel session belongs to.\n\n'
  printf 'Examples:\n'
  printf '  Claude-WorktreeHookFix       fixing a worktree hook in Claude Code\n'
  printf '  Antigravity-AgentsMdCleanup  cleaning up AGENTS.md in Antigravity\n'
  printf '  Codex-TestAudit              auditing test coverage in Codex\n'
  printf '  Claude-DesignBible           working on the design bible in Claude Code\n\n'
  printf 'Format: <Harness>-<Topic>, CamelCase, ASCII letters/digits/hyphens/underscores, under ~30 chars.\n'
  printf 'The harness prefix lets Tim see "two Claudes and one Antigravity are running."\n\n'
  printf 'Register with:\n'
  printf '    bash scripts/hooks/huddle-whoami.sh register <YourName> %s\n\n' "$SESSION_ID"
  printf 'If the name is taken, the helper suggests variations.\n\n'
  printf 'After registering, post a one-line kickoff to today'\''s bead describing what this\n'
  printf 'session is tackling (skip it for trivial questions or one-line fixes).\n'
  # shellcheck disable=SC2016  # backticks are literal Markdown
  printf 'Full reference: `.agents/skills/pinpoint-huddle/SKILL.md`\n'
fi

# --- Summary injection (§5.1 step 5) ---
# Inject monthly summary description + N most-recent daily bead descriptions.
# Suppressed on compact (already returned early above via SOURCE check).
# Fails open: any bd error exits silently without noise.
ROOT_JSON=$(bd show "$ROOT_ID" --json 2>/dev/null) || { exit 0; }
NOTES_STR=$(printf '%s' "$ROOT_JSON" | jq -r '.[0].notes // ""' 2>/dev/null) || { exit 0; }
if [[ -z "$NOTES_STR" ]]; then
  exit 0
fi

N_DAILIES=$(printf '%s' "$NOTES_STR" | python3 -c "
import sys, json
try:
    n = json.loads(sys.stdin.read())
    print(n.get('settings', {}).get('n_dailies_to_inject', 5))
except Exception:
    print(5)
" 2>/dev/null || echo "5")
# Sanitize: a non-numeric value ('null', '', 'abc') from the JSON would later
# trip `[[ "$DAILY_COUNT" -ge "$N_DAILIES" ]]` with "integer expression expected"
# on stderr. Default to 5; clamp to [1, 20] so a bad setting can't blow up the
# session-start output budget.
if ! [[ "$N_DAILIES" =~ ^[0-9]+$ ]]; then
  N_DAILIES=5
fi
if (( N_DAILIES < 1 )); then N_DAILIES=1; fi
if (( N_DAILIES > 20 )); then N_DAILIES=20; fi

MONTHLY_BEAD_ID=$(printf '%s' "$NOTES_STR" | python3 -c "
import sys, json
try:
    n = json.loads(sys.stdin.read())
    print(n.get('monthly_bead', {}).get('id', ''))
except Exception:
    print('')
" 2>/dev/null || echo "")

RECENT_DAILIES=$(printf '%s' "$NOTES_STR" | python3 -c "
import sys, json
try:
    n = json.loads(sys.stdin.read())
    items = n.get('recent_dailies', [])
    for item in items:
        print(item.get('id', '') + '\t' + item.get('date', ''))
except Exception:
    pass
" 2>/dev/null || echo "")

# Gather content — only emit the section header if there's something to show
MONTHLY_DESC=""
if [[ -n "$MONTHLY_BEAD_ID" ]]; then
  MONTHLY_DESC=$(bd show "$MONTHLY_BEAD_ID" --json 2>/dev/null | jq -r '.[0].description // ""' 2>/dev/null || echo "")
fi

if [[ -z "$MONTHLY_DESC" && -z "$RECENT_DAILIES" ]]; then
  exit 0
fi

printf '\n## Huddle recent activity\n\n'

if [[ -n "$MONTHLY_BEAD_ID" && -n "$MONTHLY_DESC" && "$MONTHLY_DESC" != "null" ]]; then
  MONTHLY_TITLE=$(bd show "$MONTHLY_BEAD_ID" --json 2>/dev/null | jq -r '.[0].title // "Monthly summary"' 2>/dev/null || echo "Monthly summary")
  printf '### %s\n\n%s\n\n' "$MONTHLY_TITLE" "$MONTHLY_DESC"
fi

if [[ -n "$RECENT_DAILIES" ]]; then
  DAILY_COUNT=0
  while IFS=$'\t' read -r daily_id daily_date; do
    [[ -z "$daily_id" ]] && continue
    [[ "$DAILY_COUNT" -ge "$N_DAILIES" ]] && break
    DAILY_DESC=$(bd show "$daily_id" --json 2>/dev/null | jq -r '.[0].description // ""' 2>/dev/null || echo "")
    if [[ -n "$DAILY_DESC" && "$DAILY_DESC" != "null" ]]; then
      printf '### Daily %s (%s)\n\n%s\n\n' "$daily_date" "$daily_id" "$DAILY_DESC"
    fi
    DAILY_COUNT=$(( DAILY_COUNT + 1 ))
  done <<< "$RECENT_DAILIES"
fi

exit 0
