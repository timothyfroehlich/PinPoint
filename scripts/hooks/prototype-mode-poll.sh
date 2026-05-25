#!/usr/bin/env bash
# shellcheck disable=SC2250  # unbraced $vars are consistent throughout this codebase
# prototype-mode-poll.sh — remind the agent that prototype mode is active.
#
# Fires from UserPromptSubmit and SessionStart (registered in
# .claude/settings.json). If a `.prototype-mode` marker file exists at the
# worktree root, emit a system-reminder so the relaxed-rigor mode survives
# context compaction and session restarts. Zero stdout = no injection (mode
# inactive).
#
# The marker is created/deleted by the `pinpoint-prototype-mode` skill, not by
# this hook. This hook only reads.
set -euo pipefail

marker="${CLAUDE_PROJECT_DIR:-.}/.prototype-mode"
[ -f "$marker" ] || exit 0

goal=$(grep -m1 '^Goal:' "$marker" 2>/dev/null || true)

# Emit plain markdown — the harness presents UserPromptSubmit/SessionStart
# stdout as a reminder. Match the convention in huddle-poll.sh (no literal
# wrapper tags).
printf '## ⚡ Prototype mode is ACTIVE\n\n'
printf 'Rigor is relaxed per the pinpoint-prototype-mode skill: do not run '
printf 'preflight/tests before showing work, do not fix every lint/type '
printf 'error, defer coverage and DRY — but log each skip to the debt ledger '
printf 'in .prototype-mode. Never commit/push, never touch prod, never delete '
printf 'tests.\n'
[ -n "$goal" ] && printf '%s\n' "$goal"
printf 'Exit with "exit prototype mode" / "make this real", then repay the '
printf 'ledger. Read the pinpoint-prototype-mode skill for the full rules.\n'
