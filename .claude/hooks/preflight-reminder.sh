#!/bin/bash
# Claude Code hook: PostToolUse (Bash)
# Non-blocking reminder after `git push`. Always exits 0 — a nudge, not a gate.
# PostToolUse stderr is never shown to the model, so the reminder goes out as
# JSON additionalContext on stdout.

if ! command -v jq >/dev/null 2>&1; then
  exit 0
fi

COMMAND=$(jq -r '.tool_input.command // empty')

if ! grep -qE '(^|[[:space:]]|;|&&)[[:space:]]*git[[:space:]]+push' <<<"$COMMAND"; then
  exit 0
fi

jq -n '{hookSpecificOutput: {hookEventName: "PostToolUse", additionalContext: "Pushed. If this change touches migrations, auth, server actions, middleware or the DB schema, run `pnpm run preflight` before handing off; otherwise CI covers it (AGENTS.md §2.2)."}}'
