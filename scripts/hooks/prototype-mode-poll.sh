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

# Emit a compact plain-markdown reminder — the harness presents
# UserPromptSubmit/SessionStart stdout as a reminder, and this fires every
# turn while the marker exists, so keep it bounded. Match huddle-poll.sh's
# convention (no literal wrapper tags). Full rules live in the skill.
printf '⚡ **Prototype mode ACTIVE — UI/UX only.** Relax test/lint/type rigor '
printf 'on presentation; keep full rigor on backend/data/auth (stub data, do '
printf 'not build it). Log skips to the .prototype-mode ledger; never '
printf 'commit/push, touch prod, or delete tests. '
[ -n "$goal" ] && printf '%s ' "$goal"
printf 'Exit: "exit prototype mode" / "make this real" → repay the ledger. '
printf 'Full rules: pinpoint-prototype-mode skill.\n'
