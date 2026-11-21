#!/usr/bin/env bash
# heavy-run.sh — run an expensive command inside the host-wide agent memory
# budget (scripts/workflow/agent-budget.py, PP-p2ts.5).
#
# <kind> names the command's measured footprint (check, dev, unit, coverage,
# integration, integration-supabase, build, smoke). The command starts once
# that much of the budget is free, waits in a FIFO queue otherwise, and exits
# 75 after 5 minutes with a pointer to crabbox or CI. The reservation lasts
# exactly as long as the command: agent-budget.py execs it in place.
#
# Transparent passthrough in CI, on non-macOS hosts, with
# PINPOINT_AGENT_BUDGET=off, and inside a command that already holds a
# reservation. `pnpm run agent-load` shows who holds what.
#
# Usage (invoke via `bash` so no chmod is needed):
#   bash scripts/workflow/heavy-run.sh <kind> <command> [args…]

set -euo pipefail

if [ "$#" -lt 2 ]; then
  echo "Usage: bash scripts/workflow/heavy-run.sh <kind> <command> [args…]" >&2
  exit 64 # EX_USAGE
fi

kind="$1"
shift
exec python3 "$(dirname "${BASH_SOURCE[0]}")/agent-budget.py" run "$kind" -- "$@"
