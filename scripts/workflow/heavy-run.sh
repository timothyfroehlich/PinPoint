#!/usr/bin/env bash
# heavy-run.sh — run an expensive command in a host-wide GNU parallel `sem` slot
# so parallel agent sessions cannot stack up on a 16 GB Mac (PP-p2ts.5).
#
# Two slot classes, each one named semaphore shared by every checkout:
#   heavy  pinpoint-heavy, 1 slot (PINPOINT_HEAVY_SLOTS): check, the full unit
#          suite, coverage, integration, build, smoke, e2e:full, e2e:all,
#          pr-screenshots.mjs.
#          `check` peaked at 5.0 GB when its typechecks ran in parallel; they
#          now run one after another (PP-p2ts.6): ~2.5 GB.
#   dev    pinpoint-dev, 2 slots (PINPOINT_DEV_SLOTS): `pnpm run dev`, held
#          for the server's whole life. Measured: 2.5 GB after 19 routes.
# Footprints were measured on 2026-11-20 with `footprint` (phys_footprint, not
# RSS) summed over each command's process tree on Tim's 16 GB M5 Air.
#
# A command that finds its class full waits. After PINPOINT_HOST_SLOT_TIMEOUT_S
# seconds (default 300) it gives up without running and exits 75 with the
# crabbox or CI route to take instead. sem reclaims the slot of a holder that
# died, and `pnpm run agent-load` shows who holds what.
#
# Transparent passthrough (the command runs at once, no slot taken) when:
#   - $CI is set, or PINPOINT_HOST_SLOTS=off;
#   - the host is not macOS, unless PINPOINT_HOST_SLOTS=on (the Bazzite runner
#     and CI have their own isolation);
#   - GNU parallel's `sem` is missing (or is the moreutils variant);
#   - an ancestor already holds a slot that covers this command
#     (PINPOINT_HOST_SLOT_HELD): a held heavy slot covers everything under it
#     (smoke's Playwright starts its own `pnpm run dev`); a held dev slot
#     covers only nested dev calls, so a build run from a dev server's
#     environment still waits for the heavy slot.
#
# Usage (invoke via `bash` so no chmod is needed):
#   bash scripts/workflow/heavy-run.sh <heavy|dev> <command> [args…]

set -euo pipefail

usage() {
  echo "Usage: bash scripts/workflow/heavy-run.sh <heavy|dev> <command> [args…]" >&2
  exit 64 # EX_USAGE
}

[ "$#" -ge 2 ] || usage
class="$1"
shift
case "$class" in
  heavy) slots="${PINPOINT_HEAVY_SLOTS:-1}" ;;
  dev) slots="${PINPOINT_DEV_SLOTS:-2}" ;;
  *) usage ;;
esac

passthrough=false
held="${PINPOINT_HOST_SLOT_HELD:-}"
if [ -n "${CI:-}" ] || [ "${PINPOINT_HOST_SLOTS:-}" = "off" ] \
   || [ "$held" = heavy ] || [ "$held" = "$class" ]; then
  passthrough=true
elif [ "$(uname)" != "Darwin" ] && [ "${PINPOINT_HOST_SLOTS:-}" != "on" ]; then
  passthrough=true
elif ! command -v sem >/dev/null 2>&1 \
     || ! sem --version 2>/dev/null | grep -q '^GNU parallel'; then
  passthrough=true
fi

# Tell nested heavy-run calls (and pr-screenshots.mjs's re-exec check) which
# slot covers them; an outer heavy slot stays the one in force.
[ "$held" = heavy ] || export PINPOINT_HOST_SLOT_HELD="$class"

if [ "$passthrough" = true ]; then
  exec "$@"
fi

# GNU Parallel defaults to ~/.parallel, which is not writable in every agent
# sandbox. Every checkout on the host resolves this same state path instead;
# `agent-load.sh` reads the semaphores from it.
export PARALLEL_HOME="${XDG_STATE_HOME:-${HOME}/.local/state}/pinpoint/parallel"
mkdir -p "$PARALLEL_HOME"
# sem re-parses its command string through a shell; pin bash so the printf %q
# quoting below is read by the shell that wrote it.
export PARALLEL_SHELL=/bin/bash

# sem exits 1 both when the command fails with 1 and when it times out without
# running anything. The command touches this marker first, so a missing marker
# means "never started".
started="$(mktemp "${TMPDIR:-/tmp}/pinpoint-heavy-run.XXXXXX")"
rm -f "$started"
trap 'rm -f "$started"' EXIT

# sem would word-split an argument that contains a space (--project='Mobile
# Chrome' in `smoke`), so pre-quote each argument and hand sem one string.
# See PP-yso5.
quoted_cmd="$(printf '%q ' "$@")"
timeout_s="${PINPOINT_HOST_SLOT_TIMEOUT_S:-300}"

# --fg blocks until the command ends and propagates its exit code; a negative
# --semaphore-timeout gives up instead of taking the slot anyway. sem runs in
# the background (stdin kept) so a SIGTERM/SIGHUP aimed at this wrapper alone
# is forwarded: sem stops the command and frees the slot.
began=$SECONDS
# The trap goes in before sem starts, so no signal can leave an orphaned sem
# holding the slot. Bash runs a trap between commands, so a signal landing
# after `sem … &` but before `sem_pid=$!` still finds sem in $! (this script
# starts no other background job). Before the launch both are empty and the
# wrapper just exits.
sem_pid=""
# shellcheck disable=SC2329 # invoked by the trap below
on_signal() {
  local pid="${sem_pid:-${!:-}}"
  if [ -z "$pid" ]; then exit 143; fi
  kill -TERM "$pid" 2>/dev/null || true
}
trap on_signal TERM HUP INT
sem --id "pinpoint-$class" --jobs "$slots" --semaphore-timeout "-$timeout_s" \
  --fg ": > $(printf '%q' "$started"); $quoted_cmd" <&0 &
sem_pid=$!
set +e
wait "$sem_pid"
status=$?
# A trapped signal interrupts `wait`; keep waiting for sem to finish.
while kill -0 "$sem_pid" 2>/dev/null; do
  wait "$sem_pid"
  status=$?
done
set -e

if [ "$status" -ne 0 ] && [ ! -e "$started" ] \
   && [ $((SECONDS - began)) -lt "$timeout_s" ]; then
  echo "heavy-run: sem failed (exit $status) before starting the command; see its message above." >&2
  exit "$status"
fi
if [ "$status" -ne 0 ] && [ ! -e "$started" ]; then
  {
    echo "heavy-run: every $class slot ($slots) stayed busy for ${timeout_s}s; nothing was run."
    echo "This Mac is at its agent memory limit. Do not retry in a loop."
    if [ "$class" = dev ]; then
      echo "Instead: stop a dev server nobody is using (\`pnpm run dev:stop\` in its worktree)."
    else
      echo "Instead: run suites on crabbox (\`crabbox-slot job run check|unit|integration|integration-supabase|smoke\`),"
      echo "or push and let CI give the verdict."
    fi
    echo "Current holders: pnpm run agent-load"
  } >&2
  exit 75 # EX_TEMPFAIL
fi
exit "$status"
