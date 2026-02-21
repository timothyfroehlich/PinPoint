#!/bin/bash
# Claude Code hook: PostToolUse (Bash)
# Non-blocking reminder to run preflight after pushing.
# Always exits 0 — this is a nudge, not a gate.

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Only trigger on git push commands
if ! echo "$COMMAND" | grep -qE '(^|\s|;|&&)\s*git\s+push'; then
  exit 0
fi

cat >&2 <<'MSG'
📋 Reminder: Did you run `pnpm run preflight` before pushing?
   - For code changes: run preflight before marking the task done.
   - For trivial changes (comments, docs, formatting): carry on — CI will validate.
MSG

exit 0
