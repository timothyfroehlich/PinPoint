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

cat <<EOF
<system-reminder>
⚡ Prototype mode is ACTIVE (.prototype-mode present). Rigor is relaxed per the
pinpoint-prototype-mode skill: don't run preflight/tests before showing work,
don't fix every lint/type error, defer coverage and DRY — but log each skip to
the debt ledger in .prototype-mode. Never commit/push, never touch prod, never
delete tests. ${goal}
The user exits with "exit prototype mode" / "make this real" — then repay the
ledger. Read the pinpoint-prototype-mode skill if you need the full rules.
</system-reminder>
EOF
