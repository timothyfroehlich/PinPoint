#!/usr/bin/env bash
# shellcheck disable=SC2250  # unbraced $vars are consistent throughout this codebase
# huddle-rotate.sh — daily coordination bead rotation, phase A (shell atomic).
#
# Phase A (this script) performs the atomic shell work:
#   1. Acquire exclusive lock on <STATE_DIR>/rotation.lock (60s timeout)
#   2. Re-check date inside the lock (exit 0 if peer already rotated)
#   3. Create new daily bead (+ monthly if month rolled) under root
#   4. Atomically update root notes JSON with new pointers
#   5. Post "→ continued in <new-bead>" comments on old beads (best-effort)
#   6. Print phase-B handoff variables to stdout
#
# Phase B (LLM summarization, old-bead archiving, closing, name-prune) is
# performed by the dispatching subagent after reading phase A stdout.
# Dispatch template: .agents/skills/pinpoint-huddle/SKILL.md §rotation.
#
# Crash-safety: steps 1-4 are the "make consistent" path. If the process dies
# between step 4 and step 5, root notes already point to the new beads — the
# system is consistent. Old bead has no summary, but the next rotation subagent
# can back-fill it before proceeding with the current rotation.
#
# Usage:
#   output=$(bash scripts/hooks/huddle-rotate.sh)
#   # parse key=value lines:
#   OLD_TODAY_ID=$(printf '%s\n' "$output" | grep '^OLD_TODAY=' | cut -d= -f2-)
#   OLD_MONTHLY_ID=$(printf '%s\n' "$output" | grep '^OLD_MONTHLY=' | cut -d= -f2-)
#   NEW_TODAY_ID=$(printf '%s\n' "$output" | grep '^NEW_TODAY=' | cut -d= -f2-)
#   NEW_MONTHLY_ID=$(printf '%s\n' "$output" | grep '^NEW_MONTHLY=' | cut -d= -f2-)
#
# Exits 0 with no output if rotation is not needed (peer already rotated).

set -euo pipefail

for dep in jq bd python3; do
  command -v "$dep" >/dev/null 2>&1 || {
    printf 'huddle-rotate.sh: %s not found\n' "$dep" >&2
    exit 1
  }
done

LIB_SCRIPT="$(dirname "$0")/huddle-lib.sh"
[[ -f "$LIB_SCRIPT" ]] || { printf 'huddle-rotate.sh: huddle-lib.sh not found\n' >&2; exit 1; }
# shellcheck source=huddle-lib.sh disable=SC1091
source "$LIB_SCRIPT"
STATE_DIR=$(huddle_state_dir) || { printf 'huddle-rotate.sh: not in a git checkout\n' >&2; exit 1; }

CONFIG_FILE="$STATE_DIR/config.json"
[[ -f "$CONFIG_FILE" ]] || {
  printf 'huddle-rotate.sh: not bootstrapped — run huddle-bootstrap.sh first\n' >&2
  exit 1
}

ROOT_ID=$(jq -r '.root_bead_id // ""' "$CONFIG_FILE" 2>/dev/null)
[[ -n "$ROOT_ID" ]] || { printf 'huddle-rotate.sh: config.json missing root_bead_id\n' >&2; exit 1; }

LOCK_FILE="$STATE_DIR/rotation.lock"

# Platform-detected locking — same pattern as .claude/hooks/worktree-create.sh (PP-bg45).
# lockf(1) on macOS (ships with the OS), flock(1) on Linux (util-linux).
LOCK_TOOL=""
if command -v lockf >/dev/null 2>&1; then
  LOCK_TOOL="macos"
elif command -v flock >/dev/null 2>&1; then
  LOCK_TOOL="linux"
else
  printf 'huddle-rotate.sh: neither lockf nor flock found — cannot safely rotate\n' >&2
  exit 1
fi

# The rotation body runs as an exported function so the lock covers the entire
# atomic operation. Variables needed inside are exported below.
do_rotation() {
  set -euo pipefail

  # Pull peer state before allocating any child id. A stale local child counter
  # (this machine behind the remote) would mint a colliding daily id → an
  # unmergeable Dolt conflict across machines (PP-1d51). So this pull is VERIFIED,
  # not fail-open: if it FAILS on a merge conflict, refuse to rotate rather than
  # mint the daily bead off a possibly-stale counter. Offline/unreachable stays
  # fail-open — a single active machine cannot collide, and rotation must still
  # work without a network.
  #
  # If another machine already rotated and pushed cleanly, this pull surfaces
  # today's date and we no-op below — the cross-machine equivalent of the
  # local-lock peer check.
  #
  # Note: --quiet is dropped deliberately so the conflict message is captured in
  # pull_out for the conflict check below.
  local pull_rc=0 pull_out
  pull_out=$(bd dolt pull 2>&1) || pull_rc=$?
  if [[ "$pull_rc" -ne 0 ]] && printf '%s' "$pull_out" | grep -qiE 'conflict|operator resolution'; then
    printf 'huddle-rotate.sh: beads sync has unresolved merge conflicts — refusing to rotate.\n' >&2
    printf 'Rotating now would allocate the daily bead off a possibly-stale child counter and collide across machines (see PP-1d51).\n' >&2
    printf 'Resolve the beads Dolt conflict first (bd dolt pull), then re-run rotation.\n' >&2
    exit 1
  fi

  # Re-check date inside the lock (idempotency: a peer may have rotated first).
  # Reserve `exit 0` for the explicit "already up to date" case below. Anything
  # else (bd unreachable, root bead unreadable, notes corrupted) is a hard error
  # — silently `exit 0` here would make a caller treat a broken state as
  # "successful no-op" and skip a required rotation.
  local root_json notes_str today_bead_date today
  if ! root_json=$(bd show "$ROOT_ID" --json 2>&1); then
    printf 'huddle-rotate.sh: failed to fetch root bead %s: %s\n' "$ROOT_ID" "$root_json" >&2
    exit 1
  fi
  if ! notes_str=$(printf '%s' "$root_json" | jq -r '.[0].notes // ""' 2>&1); then
    printf 'huddle-rotate.sh: failed to parse root bead JSON: %s\n' "$notes_str" >&2
    exit 1
  fi
  [[ -n "$notes_str" ]] || {
    printf 'huddle-rotate.sh: root bead has no notes — was huddle-bootstrap.sh run?\n' >&2
    exit 1
  }

  today=$(date +%F)
  # today_bead.date is a required field; if it's missing or parse fails, the
  # notes JSON is corrupted and proceeding would overwrite root pointers based
  # on an empty-string compare. Fail clearly instead.
  if ! today_bead_date=$(printf '%s' "$notes_str" | python3 -c "
import sys, json
n = json.loads(sys.stdin.read())
d = n.get('today_bead', {}).get('date', '')
if not d:
    raise SystemExit('today_bead.date missing or empty in root notes')
print(d)
" 2>&1); then
    printf 'huddle-rotate.sh: %s\n' "$today_bead_date" >&2
    exit 1
  fi

  if [[ "$today_bead_date" == "$today" ]]; then
    # Peer already rotated — no-op, exit silently
    exit 0
  fi

  # Parse current pointers from notes
  local old_today_id old_monthly_id old_month recent_dailies settings current_month
  old_today_id=$(printf '%s' "$notes_str" | python3 -c "
import sys, json
try:
    n = json.loads(sys.stdin.read())
    print(n.get('today_bead', {}).get('id', ''))
except Exception:
    print('')
" 2>/dev/null || echo "")
  old_monthly_id=$(printf '%s' "$notes_str" | python3 -c "
import sys, json
try:
    n = json.loads(sys.stdin.read())
    print(n.get('monthly_bead', {}).get('id', ''))
except Exception:
    print('')
" 2>/dev/null || echo "")
  old_month=$(printf '%s' "$notes_str" | python3 -c "
import sys, json
try:
    n = json.loads(sys.stdin.read())
    print(n.get('monthly_bead', {}).get('month', ''))
except Exception:
    print('')
" 2>/dev/null || echo "")
  recent_dailies=$(printf '%s' "$notes_str" | python3 -c "
import sys, json
try:
    n = json.loads(sys.stdin.read())
    print(json.dumps(n.get('recent_dailies', [])))
except Exception:
    print('[]')
" 2>/dev/null || echo "[]")
  settings=$(printf '%s' "$notes_str" | python3 -c "
import sys, json
try:
    n = json.loads(sys.stdin.read())
    default = {'n_dailies_to_inject': 5, 'day_boundary_tz': 'local', 'stale_name_cutoff_days': 14}
    print(json.dumps(n.get('settings', default)))
except Exception:
    print('{\"n_dailies_to_inject\":5,\"day_boundary_tz\":\"local\",\"stale_name_cutoff_days\":14}')
" 2>/dev/null || echo '{"n_dailies_to_inject":5,"day_boundary_tz":"local","stale_name_cutoff_days":14}')

  current_month=$(date +%Y-%m)
  local month_rolled=0
  if [[ "$old_month" != "$current_month" ]]; then
    month_rolled=1
  fi

  # Create new daily bead (orphan until root notes are updated), OR adopt one a
  # peer machine already created for today — idempotent across machines. We
  # queried after the pull above, so a peer's pushed daily is visible here.
  local new_today_id
  new_today_id=$(bd children "$ROOT_ID" --json 2>/dev/null \
    | jq -r --arg t "Huddle daily $today" \
      '[ .[] | select(.title==$t and .status!="closed") ] | sort_by(.id) | (.[0].id // "")' 2>/dev/null || echo "")
  if [[ -z "$new_today_id" ]]; then
    new_today_id=$(bd create -t task \
      --parent "$ROOT_ID" \
      --title "Huddle daily $today" \
      --description "Active coordination bead for $today. Agents post updates here. At midnight rotation this bead gets a categorized summary and closes." \
      --silent)
  fi

  local new_monthly_id="$old_monthly_id"
  if [[ "$month_rolled" -eq 1 ]]; then
    new_monthly_id=$(bd children "$ROOT_ID" --json 2>/dev/null \
      | jq -r --arg t "Huddle monthly $current_month" \
        '[ .[] | select(.title==$t and .status!="closed") ] | sort_by(.id) | (.[0].id // "")' 2>/dev/null || echo "")
    if [[ -z "$new_monthly_id" ]]; then
      new_monthly_id=$(bd create -t task \
        --parent "$ROOT_ID" \
        --title "Huddle monthly $current_month" \
        --description "Monthly coordination summary for $current_month. Receives aggregated summaries of daily beads when they close." \
        --silent)
    fi
  fi

  local now
  now=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  # Build new recent_dailies: prepend today's entry, cap at 20
  local new_recent
  new_recent=$(python3 -c "
import sys, json
existing = json.loads(sys.argv[1])
new_entry = {'id': sys.argv[2], 'date': sys.argv[3]}
combined = [new_entry] + existing
print(json.dumps(combined[:20]))
" "$recent_dailies" "$new_today_id" "$today")

  # Build new notes JSON
  local new_notes
  new_notes=$(python3 -c "
import sys, json
notes = {
    'schema_version': 1,
    'today_bead': {'id': sys.argv[1], 'date': sys.argv[2]},
    'monthly_bead': {'id': sys.argv[3], 'month': sys.argv[4]},
    'recent_dailies': json.loads(sys.argv[5]),
    'settings': json.loads(sys.argv[6]),
    'last_rotation': sys.argv[7]
}
print(json.dumps(notes))
" "$new_today_id" "$today" "$new_monthly_id" "$current_month" "$new_recent" "$settings" "$now")

  # ATOMIC: update root notes — after this the system is consistent
  bd update "$ROOT_ID" --notes "$new_notes"

  # Push the new pointers so peer machines converge fast and don't double-rotate.
  # Fail-open: a transient push failure doesn't abort (pre-push + next sync catch up).
  bd dolt push --quiet >/dev/null 2>&1 || true

  # Post continuation comments on old beads (best-effort: failures do not abort)
  if [[ -n "$old_today_id" ]]; then
    bd comments add "$old_today_id" "→ continued in $new_today_id (rotation $today)" 2>/dev/null || true
  fi
  if [[ "$month_rolled" -eq 1 ]] && [[ -n "$old_monthly_id" ]]; then
    bd comments add "$old_monthly_id" "→ continued in $new_monthly_id (month rolled to $current_month)" 2>/dev/null || true
  fi

  # Output phase-B handoff on stdout (key=value format, one per line)
  printf 'OLD_TODAY=%s\n' "$old_today_id"
  if [[ "$month_rolled" -eq 1 ]]; then
    printf 'OLD_MONTHLY=%s\n' "$old_monthly_id"
    printf 'OLD_MONTH=%s\n' "$old_month"
  fi
  printf 'NEW_TODAY=%s\n' "$new_today_id"
  printf 'NEW_MONTHLY=%s\n' "$new_monthly_id"
  printf 'ROTATION_DATE=%s\n' "$today"
}

export -f do_rotation
export ROOT_ID STATE_DIR CONFIG_FILE

# Acquire exclusive lock and run the rotation body
case "$LOCK_TOOL" in
  macos)
    # lockf -k: keep lock file (prevents delete/recreate races).
    # -t 60: wait up to 60s (longer than PP-bg45's 30s because rotation
    # includes bd creates, not just git worktree add).
    lockf -k -t 60 "$LOCK_FILE" bash -c 'do_rotation'
    ;;
  linux)
    # flock -x: exclusive lock; -w 60: wait up to 60s.
    flock -x -w 60 "$LOCK_FILE" bash -c 'do_rotation'
    ;;
esac

# Safety-net dedup (runs in the parent shell, where huddle-lib.sh is sourced and
# huddle_reconcile_today is defined). If a peer machine created a duplicate daily
# for today inside the race window — both rotated before either pushed — collapse
# to the deterministic canonical. Silent + fail-open; no-op in the common case.
#
# Pull once more first: in the "both machines created before either pushed" race,
# the peer's duplicate may not be in our local DB yet, so without a fresh pull the
# reconcile would just no-op. Rotation is rare, so the extra pull is cheap and
# makes the safety-net materially more effective. Fail-open (offline → skip).
bd dolt pull --quiet >/dev/null 2>&1 || true
huddle_reconcile_today || true
