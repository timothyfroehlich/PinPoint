#!/bin/bash
# Claude Code hook: PostToolUse (Bash)
# Non-blocking reminder to run preflight after pushing.
# Always exits 0 — this is a nudge, not a gate.

# If jq is not available, exit successfully to keep this hook non-blocking.
if ! command -v jq >/dev/null 2>&1; then
  exit 0
fi

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Only trigger on git push commands
if ! echo "$COMMAND" | grep -qE '(^|[[:space:]]|;|&&)[[:space:]]*git[[:space:]]+push'; then
  exit 0
fi

cat >&2 <<'MSG'
📋 Reminder: Did you run `pnpm run preflight` before pushing?
   - For code changes: run preflight before marking the task done.
   - For trivial changes (comments, docs, formatting): carry on — CI will validate.
MSG

exit 0
