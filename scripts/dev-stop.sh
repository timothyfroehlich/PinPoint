#!/bin/bash
set -euo pipefail

# Stop this worktree's Next.js dev server and every process under it.
#
# Safe by construction: the only process it will signal is the one listening on
# this worktree's own PORT (from .env.local), and only when that listener is a
# Next.js process whose working directory is exactly this worktree. A nested
# worktree, a sibling worktree, or anything that is not Next.js makes it refuse
# without sending a signal. From that listener it walks up through the dev
# launcher chain (next dev, pnpm run dev, mise exec) while each ancestor still
# belongs to this worktree, snapshots the whole tree beneath, then sends SIGTERM
# and escalates survivors to SIGKILL. The tree is captured before any signal so
# children cannot escape by being reparented when their parent dies.
#
# Exit codes: 0 stopped, or nothing to stop; 1 refused or failed; 2 usage.

DRY_RUN=false
TIMEOUT=10

usage() {
  cat >&2 <<'EOF'
Usage: bash scripts/dev-stop.sh [--dry-run] [--timeout=SECONDS]
EOF
  exit 2
}

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --timeout=*)
      TIMEOUT="${arg#--timeout=}"
      [[ "$TIMEOUT" =~ ^[0-9]+$ ]] || usage
      ;;
    *) usage ;;
  esac
done

fail() {
  printf 'FAIL: dev stop — %s\n' "$1"
  exit 1
}

# Linux: lsof skips a process whose name holds spaces and parentheses, which is
# exactly how Next.js titles its server (`next-server (vX.Y.Z)`), so use ss.
if [ -d /proc/self ] && command -v ss >/dev/null 2>&1; then
  LISTENER_TOOL=ss
elif command -v lsof >/dev/null 2>&1; then
  LISTENER_TOOL=lsof
else
  fail "neither ss nor lsof is installed"
fi

toplevel="$(git rev-parse --show-toplevel 2>/dev/null)" || fail "not inside a git worktree"
ROOT="$(cd "$toplevel" && pwd -P)"

[ -f "$ROOT/.env.local" ] || fail "no .env.local in $ROOT (run the worktree setup first)"
# Read PORT alone; sourcing the whole file would let any variable in it steer us.
PORT="$(sed -n -E 's/^(export[[:space:]]+)?PORT=["'\'']?([0-9]+)["'\'']?[[:space:]]*$/\2/p' "$ROOT/.env.local" | tail -n 1)"
[[ "$PORT" =~ ^[0-9]+$ ]] || fail "no numeric PORT in $ROOT/.env.local"

# Patterns are anchored to the start of the command line so a shell that merely
# mentions `next dev` or `pnpm run dev` in a longer command never matches.
# The listener: Next.js titles its forked server `next-server (vX.Y.Z)`, and the
# `next dev` CLI itself can hold the port during startup.
NEXT_SERVER_RE='^next-server( |$)'
NEXT_CLI_RE='^([^ ]*/)?node [^ ]*next/dist/bin/next dev( |$)'
# The launchers that may sit above `next dev` when started with `pnpm run dev`.
PNPM_RE='^([^ ]*/)?(node [^ ]*/)?pnpm(\.c?js)? (run )?dev( |$)'
MISE_RE='^([^ ]*/)?mise exec( [^ ]+)* -- pnpm (run )?dev( |$)'

proc_cwd() {
  local pid="$1"
  if [ -e "/proc/$pid/cwd" ]; then
    readlink "/proc/$pid/cwd" 2>/dev/null || true
    return 0
  fi
  lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -n 1
}

proc_cmd() {
  ps -o command= -p "$1" 2>/dev/null || true
}

proc_start() {
  ps -o lstart= -p "$1" 2>/dev/null || true
}

proc_stat() {
  ps -o stat= -p "$1" 2>/dev/null | tr -d ' ' || true
}

proc_ppid() {
  ps -o ppid= -p "$1" 2>/dev/null | tr -d ' ' || true
}

owned_by_worktree() {
  [ "$(proc_cwd "$1")" = "$ROOT" ]
}

listener_pids() {
  if [ "$LISTENER_TOOL" = ss ]; then
    ss -Hltnp "sport = :$PORT" 2>/dev/null | grep -oE 'pid=[0-9]+' | cut -d= -f2
  else
    lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null
  fi
}

listeners="$(listener_pids | sort -u || true)"
if [ -z "$listeners" ]; then
  printf 'PASS: dev stop — nothing listening on :%s for %s\n' "$PORT" "$ROOT"
  exit 0
fi

# Verify every listener before signaling any of them.
for pid in $listeners; do
  cmd="$(proc_cmd "$pid")"
  cwd="$(proc_cwd "$pid")"
  if [ "$cwd" != "$ROOT" ]; then
    fail "refusing: :$PORT is held by PID $pid in ${cwd:-<unknown cwd>}, not this worktree ($ROOT) — $cmd"
  fi
  if ! [[ "$cmd" =~ $NEXT_SERVER_RE || "$cmd" =~ $NEXT_CLI_RE ]]; then
    fail "refusing: :$PORT is held by PID $pid, which is not a Next.js server — $cmd"
  fi
done

# Climb from each listener through the dev launcher chain this worktree owns.
roots=()
for pid in $listeners; do
  top="$pid"
  while true; do
    parent="$(proc_ppid "$top")"
    [[ "$parent" =~ ^[0-9]+$ ]] && [ "$parent" -gt 1 ] || break
    parent_cmd="$(proc_cmd "$parent")"
    if [[ "$parent_cmd" =~ $NEXT_CLI_RE || "$parent_cmd" =~ $PNPM_RE || "$parent_cmd" =~ $MISE_RE ]] &&
      owned_by_worktree "$parent"; then
      top="$parent"
    else
      break
    fi
  done
  roots+=("$top")
done

# Snapshot the full tree under each root before any signal is sent.
snapshot="$(ps -A -o pid= -o ppid=)"
targets=()
queue=("${roots[@]}")
while [ "${#queue[@]}" -gt 0 ]; do
  pid="${queue[0]}"
  queue=("${queue[@]:1}")
  case " ${targets[*]-} " in *" $pid "*) continue ;; esac
  targets+=("$pid")
  while read -r child child_parent; do
    [ "$child_parent" = "$pid" ] && queue+=("$child")
  done <<<"$snapshot"
done

# Record each target's start time so a recycled PID is never signaled.
starts=()
for pid in "${targets[@]}"; do
  starts+=("$(proc_start "$pid")")
done

# True while target i is the same live process: same start time, not a zombie
# (an exited child waiting for its parent to reap it holds nothing open).
same_process() {
  local i="$1"
  local now
  now="$(proc_start "${targets[$i]}")"
  [ -n "$now" ] && [ "$now" = "${starts[$i]}" ] && [[ "$(proc_stat "${targets[$i]}")" != Z* ]]
}

if [ "$DRY_RUN" = true ]; then
  printf 'DRY RUN: dev stop would signal %s process(es) for :%s in %s\n' "${#targets[@]}" "$PORT" "$ROOT"
  for pid in "${targets[@]}"; do
    printf '  %s  %s\n' "$pid" "$(proc_cmd "$pid")"
  done
  exit 0
fi

for i in "${!targets[@]}"; do
  same_process "$i" && kill -TERM "${targets[$i]}" 2>/dev/null || true
done

alive() {
  local i
  for i in "${!targets[@]}"; do
    same_process "$i" && return 0
  done
  return 1
}

deadline=$((SECONDS + TIMEOUT))
while alive && [ "$SECONDS" -lt "$deadline" ]; do
  sleep 0.2
done

killed=0
for i in "${!targets[@]}"; do
  if same_process "$i"; then
    kill -KILL "${targets[$i]}" 2>/dev/null || true
    killed=$((killed + 1))
  fi
done

if [ "$killed" -gt 0 ]; then
  sleep 0.5
  if alive; then
    fail "processes for :$PORT survived SIGKILL: ${targets[*]}"
  fi
  printf 'PASS: dev stop — stopped %s process(es) on :%s (%s needed SIGKILL after %ss)\n' "${#targets[@]}" "$PORT" "$killed" "$TIMEOUT"
else
  printf 'PASS: dev stop — stopped %s process(es) on :%s\n' "${#targets[@]}" "$PORT"
fi
