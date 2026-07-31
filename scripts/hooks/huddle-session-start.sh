#!/usr/bin/env bash
# shellcheck disable=SC2250  # unbraced $vars are consistent throughout this codebase
# huddle-session-start.sh — SessionStart hook: announce session_id and registration state
#
# Harness-agnostic. Fires at session start from any agent harness that supports
# SessionStart-equivalent hooks (Claude Code via .claude/settings.json,
# Antigravity via .agents/hooks/antigravity-bootstrap.cjs, etc.). Reads stdin JSON
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
# their bootstrap shim — see .agents/hooks/antigravity-bootstrap.cjs for the
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
# On `source=compact` we emit a condensed block instead of the full one: the
# agent saw the verbose registration/etiquette text pre-compaction, but the
# compaction summary is not guaranteed to carry its huddle name, today's bead
# id, or any sense of what the project has been working on — and a compacted
# session is exactly the one most likely to post nothing for the rest of its
# life. So compact gets: identity one-liner, posting reminder, work digest.
# (PP-llkj. Before that, compact got nothing at all.)

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

# --- Work digest (PP-llkj) ---
# "What has this project been doing lately", derived from git alone — see
# huddle-digest.sh. Printed on every announced session start, including after
# compaction. Fail-open: any error prints nothing and the block is skipped.
emit_work_digest() {
  local digest_script digest_out
  digest_script="$(dirname "$0")/huddle-digest.sh"
  [[ -f "$digest_script" ]] || return 0
  digest_out=$(bash "$digest_script" --days 7 2>/dev/null) || return 0
  [[ -n "$digest_out" ]] || return 0
  printf '\n## What we have been working on (last 7 days)\n\n'
  printf '%s\n' "$digest_out"
}

# --- Per-machine Dolt sync (throttled, fail-open) ---
# Pull peer machines' huddle updates (and push ours) before reading root notes,
# so this session opens with the freshest cross-machine state. Throttled
# per-machine; never blocks session start.
huddle_sync

# --- Bootstrap check ---
# If config.json is missing, emit the user-visible bootstrap notice and exit.
# This is the only hook that emits the notice; huddle-poll.sh exits silently.
CONFIG_FILE="$STATE_DIR/config.json"
ROOT_ID=""
if [[ ! -f "$CONFIG_FILE" ]]; then
  # Fresh-machine auto-adopt: before nagging to bootstrap, look for an existing
  # "Huddle coordination root" epic in the synced beads DB. On a machine that
  # cloned + synced the beads but never ran bootstrap locally, this finds the
  # shared root and adopts it (writes config.json) instead of forking a
  # duplicate — the multi-machine "just works" path. Only fall through to the
  # bootstrap notice when discovery genuinely finds nothing (true first init).
  ADOPTED_ROOT=$(huddle_discover_root 2>/dev/null) || ADOPTED_ROOT=""
  if [[ -n "$ADOPTED_ROOT" ]]; then
    printf '{"schema_version": 1, "root_bead_id": "%s"}\n' "$ADOPTED_ROOT" > "$CONFIG_FILE" 2>/dev/null || true
    ROOT_ID="$ADOPTED_ROOT"
  fi
fi
if [[ -z "$ROOT_ID" && ! -f "$CONFIG_FILE" ]]; then
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
# In server mode a failure here may just mean the shared server is unreachable —
# emit the throttled "degraded" signal so it isn't mistaken for a missing bead.
if ! bd show "$ROOT_ID" --json >/dev/null 2>&1; then
  huddle_warn_degraded
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
# Emits the "rotation needed" notice and then FALLS THROUGH: rotation and
# identity/registration are independent concerns, and a session that starts on a
# new day before rotation has run still needs its session_id and its
# registration prompt.
#
# PP-2m3l: this block used to `exit 0` right after the notice, so the identity /
# registration block below was unreachable on the first sessions of every day.
# Those sessions never registered, which broke the huddle self-filter (they saw
# their own posts injected back as if from a peer) and degraded post attribution.
# SessionStart fires once per session, so there was no second chance to re-prompt.
ROTATION_PENDING=""
ROTATION_CHECK_SCRIPT="$(dirname "$0")/huddle-rotation-check.sh"
if [[ -f "$ROTATION_CHECK_SCRIPT" ]]; then
  # shellcheck source=huddle-rotation-check.sh disable=SC1091
  source "$ROTATION_CHECK_SCRIPT"
  if huddle_rotation_needed; then
    ROTATION_PENDING=1
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
    printf 'Dispatch template: .agents/skills/pinpoint-huddle/SKILL.md.\n\n'
  fi
fi

# --- Cross-machine dedup safety-net (once per session, up-to-date path only) ---
# huddle_sync above already pulled, so the local DB is fresh. If the rare
# midnight race left two open dailies for today (two machines rotated before
# either pushed), collapse them to the canonical here. No-op in the common case
# (two cheap local reads); silent + fail-open.
#
# Skipped while rotation is pending — preserving the pre-PP-2m3l behaviour, where
# this only ever ran on the up-to-date path. The function keys off root notes'
# `today_bead.date`, which is still YESTERDAY's date until rotation runs, so
# calling it now would reconcile (and close dupes of) a stale day.
#
# Note this net never collapses stale-day duplicates at all: it only ever targets
# the date root notes point at, and rotation moves that pointer to today. That
# gap is pre-existing (this call was unreachable on the rotation-pending path
# before PP-2m3l too) and out of scope here — do NOT read the skip as "the next
# session start will catch it".
if [[ -z "$ROTATION_PENDING" ]]; then
  huddle_reconcile_today || true
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

# Look up registered name
NAME=""
if [[ -f "$NAMES_JSON" ]]; then
  NAME=$(jq -r --arg sid "$SESSION_ID" '.[$sid] // ""' "$NAMES_JSON" 2>/dev/null || echo "")
fi

# Compact restart: condensed identity + posting reminder, then fall through to
# the digest. The full registration/etiquette text is deliberately skipped —
# what a compacted session actually lost is its own name, the bead id, and the
# project's recent shape.
if [[ "$SOURCE" == "compact" ]]; then
  _TODAY_ID_COMPACT=$(huddle_today_bead_id 2>/dev/null) || _TODAY_ID_COMPACT="<today-bead-id>"
  [[ -n "$_TODAY_ID_COMPACT" ]] || _TODAY_ID_COMPACT="<today-bead-id>"
  printf '## Huddle identity (post-compaction)\n\n'
  if [[ -n "$NAME" ]]; then
    # shellcheck disable=SC2016  # backticks are literal Markdown
    printf 'You are **%s**. Today'\''s coordination bead is `%s`.\n\n' "$NAME" "$_TODAY_ID_COMPACT"
    printf 'Compaction is a good moment to post: if your scope grew, you changed\n'
    printf 'direction, or you picked up something new since your last huddle post,\n'
    printf 'say so in one line — peers only see what you write down.\n'
    printf '    bd comments add %s "Your update. —%s"\n\n' "$_TODAY_ID_COMPACT" "$NAME"
    # Same caveat as the startup path: with rotation pending there is no daily
    # for today yet, so the id above is a literal placeholder rather than a
    # command you can paste.
    if [[ -n "$ROTATION_PENDING" ]]; then
      printf 'NOTE: rotation is pending, so the bead id above is a placeholder. Dispatch the\n'
      printf 'rotation subagent first — it reports the new id — then substitute it.\n\n'
    fi
  else
    # shellcheck disable=SC2016  # backticks are literal Markdown
    printf 'This session (`%s`) is not registered in the huddle. Register with:\n' "$SESSION_ID"
    printf '    bash scripts/hooks/huddle-whoami.sh register <Harness>-<Topic> %s\n\n' "$SESSION_ID"
  fi
  emit_work_digest
  exit 0
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
  # With rotation pending, today's daily does not exist yet, so the resolver
  # always misses and every command below renders the literal placeholder. Say so
  # — otherwise the first session of each day pastes `<today-bead-id>` into bash
  # and gets a redirect error instead of a clear failure.
  if [[ -n "$ROTATION_PENDING" ]]; then
    printf 'NOTE: rotation is still pending, so today'\''s bead does not exist yet and the id\n'
    printf 'in the commands below is a literal placeholder. Dispatch the rotation subagent\n'
    printf 'first — it reports the new bead id — then substitute it before posting.\n\n'
  fi
  printf 'Once you understand what this session is tackling — and it'\''s real work or an\n'
  printf 'investigation (not a quick question or one-line fix) — post a ONE-LINE kickoff to\n'
  printf 'today'\''s bead, once, so parallel sessions know and anyone with context can chime in:\n'
  printf '    bd comments add %s "Starting: <what> in <area/branch>. Ping me if you have context. —%s"\n\n' "$_TODAY_ID_REG" "$NAME"
  printf 'THE KICKOFF IS NOT THE LAST POST. Keep the channel current — peers only know what\n'
  printf 'you write down, and the most common failure is a session that announces a plan and\n'
  printf 'then silently works on something else for hours. Post again when:\n'
  printf '  - **scope gets ADDED to what you'\''re already doing** — Tim tacks a second ask onto\n'
  printf '    this session, review feedback grows the change, or a "quick fix" turns into a\n'
  printf '    refactor. Say what got added, not just that something did.\n'
  printf '  - you CHANGE DIRECTION or abandon the approach you announced\n'
  printf '  - you start touching a NEW file/area others may conflict on\n'
  printf '  - you file a bead for a non-obvious finding ("Filed PP-xxx: <finding>")\n'
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

# --- Work digest (PP-llkj) ---
# Printed before the daily summaries on purpose. The dailies are written in a
# "Merged / In-flight / Discoveries / Blockers" shape, and read cold they land as
# a list of everything that recently broke. The digest answers "what kind of work
# is this project doing right now" first; the dailies then add day-scale detail.
emit_work_digest

# --- Summary injection (§5.1 step 5) ---
# Inject monthly summary description + N most-recent daily bead descriptions.
# Fails open: any bd error exits silently without noise.
ROOT_JSON=$(bd show "$ROOT_ID" --json 2>/dev/null) || { exit 0; }
NOTES_STR=$(printf '%s' "$ROOT_JSON" | jq -r '.[0].notes // ""' 2>/dev/null) || { exit 0; }
if [[ -z "$NOTES_STR" ]]; then
  exit 0
fi

# Default 2, not the original 5 (PP-llkj): the work digest above now carries the
# week-scale picture in a denser and more useful form, so five days of
# blocker-shaped daily summaries is duplicated budget. Two keeps yesterday and
# the day before — the window where a peer's discovery is still actionable.
N_DAILIES=$(printf '%s' "$NOTES_STR" | python3 -c "
import sys, json
try:
    n = json.loads(sys.stdin.read())
    print(n.get('settings', {}).get('n_dailies_to_inject', 2))
except Exception:
    print(2)
" 2>/dev/null || echo "2")
# Sanitize: a non-numeric value ('null', '', 'abc') from the JSON would later
# trip `[[ "$DAILY_COUNT" -ge "$N_DAILIES" ]]` with "integer expression expected"
# on stderr. Default to 2; clamp to [1, 20] so a bad setting can't blow up the
# session-start output budget.
if ! [[ "$N_DAILIES" =~ ^[0-9]+$ ]]; then
  N_DAILIES=2
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

# Recent dailies: query the live children by title (id + date parsed from the
# "Huddle daily <date>" title), newest first — NOT a cached notes array. The old
# recent_dailies cache was the source of the PP-9lq5 dangling pointers; reading
# the DB directly means a purged/renamed daily simply drops out instead of
# lingering as a broken reference.
RECENT_DAILIES=$(bd children "$ROOT_ID" --json 2>/dev/null | python3 -c "
import sys, json, re
try:
    children = json.load(sys.stdin)
except Exception:
    children = []
rows = []
for c in children:
    m = re.match(r'^Huddle daily (\d{4}-\d{2}-\d{2})\$', c.get('title', ''))
    if not m:
        continue
    cid = c.get('id', '')
    if cid:
        rows.append((m.group(1), cid))
rows.sort(reverse=True)  # newest date first
for date, cid in rows:
    print(cid + '\t' + date)
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
