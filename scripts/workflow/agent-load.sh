#!/usr/bin/env bash
# agent-load.sh — `pnpm run agent-load`: who holds the host-wide heavy-run.sh
# slots, and who is waiting for one (PP-p2ts.5).
#
# GNU sem keeps each holder as a file named <pid>@<host> under
# $PARALLEL_HOME/semaphores/id-<name>/; the PID is the holder's `sem` process,
# whose working directory is the checkout it was started from.

set -euo pipefail

if [ -n "${CI:-}" ] || [ "${PINPOINT_HOST_SLOTS:-}" = "off" ] \
   || { [ "$(uname)" != "Darwin" ] && [ "${PINPOINT_HOST_SLOTS:-}" != "on" ]; }; then
  echo "host slots: off on this host; heavy-run.sh runs commands directly."
  exit 0
fi

PARALLEL_HOME="${XDG_STATE_HOME:-${HOME}/.local/state}/pinpoint/parallel"
home_prefix="${HOME%/}/"
tilde="~"

describe() { # <pid> → "pid  age  worktree  command"
  local pid="$1" age cwd cmd
  age="$(ps -o etime= -p "$pid" 2>/dev/null | tr -d ' ')" || return 1
  [ -n "$age" ] || return 1
  cwd="$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1)"
  case "$cwd" in "$home_prefix"*) cwd="$tilde/${cwd#"$home_prefix"}" ;; esac
  # The holder is `perl …/sem --id … --fg <command>`; show only the command.
  cmd="$(ps -o command= -p "$pid" 2>/dev/null | sed -E 's/.*--fg (: > [^;]*; )?//')"
  printf '  pid %-7s %8s  %s\n    %s\n' "$pid" "$age" "${cwd:-?}" "${cmd:0:160}"
}

for class in heavy dev; do
  if [ "$class" = heavy ]; then slots="${PINPOINT_HEAVY_SLOTS:-1}"; else slots="${PINPOINT_DEV_SLOTS:-2}"; fi
  dir="$PARALLEL_HOME/semaphores/id-pinpoint-$class"
  holders=()
  if [ -d "$dir" ]; then
    for entry in "$dir"/*@*; do
      [ -e "$entry" ] || continue
      pid="${entry##*/}"
      pid="${pid%%@*}"
      kill -0 "$pid" 2>/dev/null && holders+=("$pid")
    done
  fi
  echo "$class: ${#holders[@]} of $slots slot(s) in use"
  for pid in ${holders[@]+"${holders[@]}"}; do describe "$pid" || true; done
  waiting=()
  while read -r pid; do
    [ -n "$pid" ] || continue
    case " ${holders[*]-} " in *" $pid "*) continue ;; esac
    waiting+=("$pid")
  done < <(pgrep -f -- "--id pinpoint-$class " 2>/dev/null || true)
  if [ "${#waiting[@]}" -gt 0 ]; then
    echo "  waiting: ${#waiting[@]}"
    for pid in ${waiting[@]+"${waiting[@]}"}; do describe "$pid" || true; done
  fi
done
