#!/usr/bin/env bash
# shellcheck disable=SC2250  # unbraced $vars are consistent throughout this codebase
# huddle-lib.sh — shared helpers for the huddle coordination scripts.
#
# Sourced by huddle-poll.sh, huddle-session-start.sh, huddle-whoami.sh.
# Not invoked directly. Harness-agnostic — used by any agent harness whose
# bootstrap shim routes through these scripts.
#
# Why a shared lib: huddle state lives in `<main-worktree>/.agents/huddle/`
# so it's shared across all linked worktrees of the same clone AND across
# every agent harness using the worktree (Claude Code, Antigravity, etc.).
# Each script needs to resolve that path the same way; this lib is the
# single source of truth.

# huddle_state_dir — print the absolute path to the huddle state directory.
# Returns 0 on success (and prints the path), 1 if we can't locate a git
# common dir (caller should fail open: skip the hook silently).
#
# The huddle state dir is `<main-worktree-root>/.agents/huddle/`. The main
# worktree is the original clone — the worktree where `.git/` is a real
# directory (not a `.git` file pointing into `.git/worktrees/`). Linked
# worktrees share state with the main worktree via this resolver.
#
# Resolution uses `git rev-parse --git-common-dir`:
#   - Main worktree:   returns ".git" (relative)
#   - Linked worktree: returns absolute path to <main>/.git
# `dirname` of the resolved-to-absolute git-common-dir is the main worktree.
#
# shellcheck disable=SC2317  # function is sourced and called by callers
huddle_state_dir() {
  local common_dir abs_common main_root
  common_dir=$(git rev-parse --git-common-dir 2>/dev/null) || return 1
  if [[ "$common_dir" = /* ]]; then
    abs_common="$common_dir"
  else
    # Relative path (main worktree case) — resolve via the current pwd.
    abs_common=$(cd "$common_dir" 2>/dev/null && pwd) || return 1
  fi
  main_root=$(dirname "$abs_common")
  printf '%s/.agents/huddle' "$main_root"
}

# huddle_today_bead_id — print the ID of today's active coordination bead.
# Returns 0 on success (and prints the ID), non-zero + empty on any failure.
# Fail-open: callers MUST treat a non-zero return as "skip quietly".
#
# Resolution path:
#   huddle_state_dir → config.json → root_bead_id → `bd show` root notes JSON
#   → .today_bead.id
#
# shellcheck disable=SC2317  # function is sourced and called by callers
huddle_today_bead_id() {
  local state_dir config_file root_id notes_str today_id
  state_dir=$(huddle_state_dir) || return 1
  config_file="$state_dir/config.json"
  [[ -f "$config_file" ]] || return 1
  root_id=$(jq -r '.root_bead_id // ""' "$config_file" 2>/dev/null) || return 1
  [[ -n "$root_id" ]] || return 1
  notes_str=$(bd show "$root_id" --json 2>/dev/null | jq -r '.[0].notes // ""' 2>/dev/null) || return 1
  [[ -n "$notes_str" ]] || return 1
  today_id=$(printf '%s' "$notes_str" | python3 -c "
import sys, json
try:
    n = json.loads(sys.stdin.read())
    print(n.get('today_bead', {}).get('id', ''))
except Exception:
    print('')
" 2>/dev/null) || return 1
  [[ -n "$today_id" ]] || return 1
  printf '%s' "$today_id"
}

# huddle_sync — throttled, per-machine Dolt push+pull to keep the huddle beads
# fresh across Tim's machines (Mac + Bazzite). Fail-open: any error (offline,
# no remote, bd missing, lock held) returns 0 silently and never stalls a hook
# for more than the bounded network timeout.
#
# Bounded blocking: the push/pull are synchronous, so the one session that wins
# the lock does wait on the network — but each call is wrapped in `timeout`
# (GNU `timeout`, or `gtimeout` from coreutils on macOS) capped at
# $HUDDLE_SYNC_TIMEOUT seconds (default 15). A hung remote is killed at the cap
# instead of stalling the prompt indefinitely. If neither timeout binary exists
# the calls run unwrapped (bd/dolt still apply their own network deadlines).
#
# Per-machine throttle: the marker lives in the shared huddle state dir
# (<main-worktree>/.agents/huddle/last-pull), which every worktree/session of
# this clone resolves to identically via huddle_state_dir — so one sync per
# interval serves ALL sessions on the machine, not one-per-session. A
# non-blocking lock ensures exactly one session syncs when many fire at once;
# the rest skip and simply read the freshly-pulled local Dolt DB.
#
# Interval: $HUDDLE_SYNC_SECONDS (default 180 — matches the poll throttle).
# Push-before-pull: local coordination posts propagate first, then peers ingest.
# The marker is written INSIDE the lock BEFORE the network calls (same backoff
# discipline as huddle-poll.sh's poll throttle) so a broken remote can't cause a
# hammer loop across sessions.
#
# shellcheck disable=SC2317  # function is sourced and called by callers
huddle_sync() {
  command -v bd >/dev/null 2>&1 || return 0
  local state_dir marker lockfile interval now last
  state_dir=$(huddle_state_dir) || return 0
  mkdir -p "$state_dir" 2>/dev/null || return 0
  marker="$state_dir/last-pull"
  lockfile="$state_dir/pull.lock"
  interval="${HUDDLE_SYNC_SECONDS:-180}"
  [[ "$interval" =~ ^[0-9]+$ ]] || interval=180
  local sync_timeout="${HUDDLE_SYNC_TIMEOUT:-15}"
  [[ "$sync_timeout" =~ ^[0-9]+$ ]] || sync_timeout=15
  # Resolve a timeout binary once (GNU `timeout`, or `gtimeout` on macOS via
  # coreutils). Empty → run the network calls unwrapped.
  local timeout_bin=""
  if command -v timeout >/dev/null 2>&1; then
    timeout_bin="timeout"
  elif command -v gtimeout >/dev/null 2>&1; then
    timeout_bin="gtimeout"
  fi

  # Fast throttle check (no lock): skip if the marker is fresh.
  if [[ -f "$marker" ]]; then
    # `read` returns non-zero on a marker with no trailing newline but still
    # assigns the partial value — keep it (|| true), then validate numeric.
    last=0
    read -r last < "$marker" 2>/dev/null || true
    [[ "$last" =~ ^[0-9]+$ ]] || last=0
    if [[ "$last" -gt 0 ]]; then
      now=$(date +%s)
      (( now - last < interval )) && return 0
    fi
  fi

  # The locked body re-checks the marker (a peer may have synced between our
  # fast check and acquiring the lock), writes the marker, then push+pulls.
  # It reads the marker path + interval from exported env vars (not positional
  # args) so the `bash -c` string needs no single-quote expansion — same
  # exported-function + exported-vars pattern as huddle-rotate.sh's do_rotation.
  export _HS_MARKER="$marker" _HS_INTERVAL="$interval"
  export _HS_TIMEOUT_BIN="$timeout_bin" _HS_TIMEOUT="$sync_timeout"
  _huddle_sync_body() {
    local m="$_HS_MARKER" iv="$_HS_INTERVAL" l n
    if [[ -f "$m" ]]; then
      l=0
      read -r l < "$m" 2>/dev/null || true
      [[ "$l" =~ ^[0-9]+$ ]] || l=0
      if [[ "$l" -gt 0 ]]; then
        n=$(date +%s)
        (( n - l < iv )) && return 0
      fi
    fi
    date +%s > "$m" 2>/dev/null || true
    # Wrap each network call in the resolved timeout binary (if any) so a hung
    # remote is killed at the cap rather than stalling the hook.
    if [[ -n "$_HS_TIMEOUT_BIN" ]]; then
      "$_HS_TIMEOUT_BIN" "$_HS_TIMEOUT" bd dolt push --quiet >/dev/null 2>&1 || true
      "$_HS_TIMEOUT_BIN" "$_HS_TIMEOUT" bd dolt pull --quiet >/dev/null 2>&1 || true
    else
      bd dolt push --quiet >/dev/null 2>&1 || true
      bd dolt pull --quiet >/dev/null 2>&1 || true
    fi
  }
  export -f _huddle_sync_body

  # Non-blocking lock — same lockf(macOS)/flock(Linux) split as huddle-rotate.sh.
  # If another session holds it, skip immediately (it is doing the sync for us).
  if command -v flock >/dev/null 2>&1; then
    flock -n "$lockfile" bash -c '_huddle_sync_body' 2>/dev/null || true
  elif command -v lockf >/dev/null 2>&1; then
    lockf -t 0 "$lockfile" bash -c '_huddle_sync_body' 2>/dev/null || true
  else
    _huddle_sync_body
  fi
  unset -f _huddle_sync_body 2>/dev/null || true
  unset _HS_MARKER _HS_INTERVAL _HS_TIMEOUT_BIN _HS_TIMEOUT 2>/dev/null || true
  return 0
}

# huddle_discover_root — find an existing "Huddle coordination root" epic in the
# (synced) beads DB and print its id; empty + non-zero if none. Pulls first so a
# freshly-cloned machine sees the remote's root instead of forking a duplicate.
# Fail-open: prints nothing and returns non-zero on any error.
#
# Used by huddle-bootstrap.sh (adopt-not-create) and huddle-session-start.sh
# (fresh-machine auto-adopt when config.json is missing).
#
# shellcheck disable=SC2317  # function is sourced and called by callers
huddle_discover_root() {
  command -v bd >/dev/null 2>&1 || return 1
  command -v jq >/dev/null 2>&1 || return 1
  bd dolt pull --quiet >/dev/null 2>&1 || true
  local id
  # Lowest id wins if (pathologically) more than one root exists — deterministic
  # so every machine picks the same canonical root.
  id=$(bd list --type=epic --json 2>/dev/null \
    | jq -r '[ .[] | select(.title=="Huddle coordination root" and .status!="closed") ]
             | sort_by(.id) | (.[0].id // "")' 2>/dev/null) || return 1
  [[ -n "$id" ]] || return 1
  printf '%s' "$id"
}

# huddle_reconcile_today — safety-net dedup for the rare cross-machine rotation
# race. If two machines both created a "Huddle daily <date>" for the current
# today_bead date before either pushed, this collapses them to a deterministic
# canonical (lowest id), re-points root notes at it, closes the loser(s) with a
# merge marker, and pushes. Idempotent no-op when there is 0 or 1 daily (the
# common case → two cheap local reads, no writes). Every machine picks the same
# canonical, so all converge. Fail-open; silent (no stdout). Returns 0 always.
#
# Assumes the CALLER already did a recent `bd dolt pull` (session-start's
# huddle_sync, or huddle-rotate.sh's pull) so the local DB is fresh.
#
# shellcheck disable=SC2317  # function is sourced and called by callers
huddle_reconcile_today() {
  command -v bd >/dev/null 2>&1 || return 0
  command -v jq >/dev/null 2>&1 || return 0
  local state_dir config_file root_id root_json notes_str today dailies count canon cur_today_id new_notes d
  state_dir=$(huddle_state_dir) || return 0
  config_file="$state_dir/config.json"
  [[ -f "$config_file" ]] || return 0
  root_id=$(jq -r '.root_bead_id // ""' "$config_file" 2>/dev/null) || return 0
  [[ -n "$root_id" ]] || return 0
  root_json=$(bd show "$root_id" --json 2>/dev/null) || return 0
  notes_str=$(printf '%s' "$root_json" | jq -r '.[0].notes // ""' 2>/dev/null) || return 0
  [[ -n "$notes_str" ]] || return 0
  today=$(printf '%s' "$notes_str" | jq -r '.today_bead.date // ""' 2>/dev/null) || return 0
  [[ -n "$today" ]] || return 0

  # All open dailies for today's date, sorted by id (ascending → canonical first).
  dailies=$(bd children "$root_id" --json 2>/dev/null \
    | jq -r --arg t "Huddle daily $today" \
      '[ .[] | select(.title==$t and .status!="closed") ] | sort_by(.id) | .[].id' 2>/dev/null) || return 0
  count=$(printf '%s\n' "$dailies" | grep -c . 2>/dev/null || true)
  [[ "${count:-0}" -gt 1 ]] || return 0   # 0 or 1 daily → nothing to reconcile

  canon=$(printf '%s\n' "$dailies" | head -n1)
  [[ -n "$canon" ]] || return 0

  # Repoint FIRST, close SECOND. If we closed losers first and the repoint then
  # failed, root notes could be left pointing at a now-closed daily. Repointing
  # up front means the worst case is a still-open duplicate (harmless, caught on
  # the next reconcile) rather than a dangling pointer. Only close duplicates
  # once root is confirmed pointing at the canonical id.
  cur_today_id=$(printf '%s' "$notes_str" | jq -r '.today_bead.id // ""' 2>/dev/null) || cur_today_id=""
  if [[ "$cur_today_id" != "$canon" ]]; then
    new_notes=$(printf '%s' "$notes_str" | jq -c --arg id "$canon" '.today_bead.id = $id' 2>/dev/null) || new_notes=""
    if [[ -z "$new_notes" ]]; then
      return 0   # couldn't build the repoint → leave dups open for next reconcile
    fi
    # `bd update` is transactional — a zero exit means the notes were written, so
    # it confirms root now points at the canonical id. On any failure, skip the
    # closes and leave the duplicate open for the next reconcile to collapse.
    bd update "$root_id" --notes "$new_notes" >/dev/null 2>&1 || return 0
  fi

  # Root now points at the canonical → safe to close every non-canonical dup.
  while IFS= read -r d; do
    [[ -z "$d" ]] && continue
    [[ "$d" == "$canon" ]] && continue
    bd comments add "$d" "→ merged into $canon (duplicate daily reconciled across machines)" >/dev/null 2>&1 || true
    bd close "$d" >/dev/null 2>&1 || true
  done <<< "$dailies"

  bd dolt push --quiet >/dev/null 2>&1 || true
  return 0
}
