#!/usr/bin/env bash
# heavy-run.sh — run an expensive command in a host-wide GNU parallel `sem` slot
# so parallel agent sessions cannot stack up on a 16 GB Mac (PP-p2ts.5).
#
# Two slot classes, each one named semaphore shared by every checkout:
#   heavy  pinpoint-heavy, 1 slot (PINPOINT_HEAVY_SLOTS): check, the full unit
#          suite, coverage, integration, build, smoke, pr-screenshots.mjs.
#          Largest measured peak: `check`, 5.0 GB.
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
#   - PINPOINT_HOST_SLOT_HELD is set: an ancestor already holds a slot that
#     covers this command (smoke's Playwright starts its own `pnpm run dev`).
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
if [ -n "${CI:-}" ] || [ "${PINPOINT_HOST_SLOTS:-}" = "off" ] \
   || [ -n "${PINPOINT_HOST_SLOT_HELD:-}" ]; then
  passthrough=true
elif [ "$(uname)" != "Darwin" ] && [ "${PINPOINT_HOST_SLOTS:-}" != "on" ]; then
  passthrough=true
elif ! command -v sem >/dev/null 2>&1 \
     || ! sem --version 2>/dev/null | grep -q '^GNU parallel'; then
  passthrough=true
fi

# Everything below this command, held slot or passthrough, is covered: nested
# heavy-run calls (and pr-screenshots.mjs's re-exec check) pass through.
export PINPOINT_HOST_SLOT_HELD="$class"

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

set +e
# --fg blocks synchronously and propagates the exit code; a negative
# --semaphore-timeout gives up instead of taking the slot anyway.
sem --id "pinpoint-$class" --jobs "$slots" --semaphore-timeout "-$timeout_s" \
  --fg ": > $(printf '%q' "$started"); $quoted_cmd"
status=$?
set -e

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
