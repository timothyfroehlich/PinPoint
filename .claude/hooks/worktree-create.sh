#!/bin/bash
# worktree-create.sh — WorktreeCreate hook: create the worktree off a freshly
# fetched origin/main and print its path on stdout (the hook contract).
#
# No lock or retry: the worktree branches off a commit SHA, and
# `git worktree add -b <new> <sha>` writes no branch.* config, so parallel
# dispatches never contend on .git/config.lock. Slot allocation in the
# post-checkout hook has its own lock (worktree_setup.allocate_slot).
#
# Invocation: Claude Code calls this hook as a WorktreeCreate hook. The hook contract is
#   JSON via stdin (not positional args). Registration in .claude/settings.json:
#     "command": "bash \"${CLAUDE_PROJECT_DIR:-.}\"/.claude/hooks/worktree-create.sh"
#   No positional args are passed; all input comes from the JSON payload on stdin.
#
# Stdin payload fields (supports both empirical and documented shapes):
#   Documented:
#   {
#     "session_id":        "<uuid>",
#     "transcript_path":   "<path to .jsonl>",
#     "cwd":               "<repo root absolute path>",   ← used as BASE_PATH
#     "hook_event_name":   "WorktreeCreate",
#     "worktree_id":       "<id>",                         ← used as NAME if present
#     "worktree_path":     "<path>"                        ← used as WORKTREE_PATH if present
#   }
#   Empirical (current Claude Code version fallback):
#   {
#     "session_id":        "<uuid>",
#     "transcript_path":   "<path to .jsonl>",
#     "cwd":               "<repo root absolute path>",
#     "hook_event_name":   "WorktreeCreate",
#     "name":              "agent-<hex>"                   ← fallback for NAME
#   }
#   The hook derives `BRANCH = worktree-${NAME}` to match Claude Code's native
#   pre-hook naming convention.

set -euo pipefail

# --- Parse Claude Code WorktreeCreate hook JSON from stdin ---
INPUT=$(cat)

# Use `or ''` to normalize explicit JSON null → empty string (otherwise
# .get('key', '') still returns None when the key is present with a null value,
# and Python prints "None" — bypassing the -z check below).
parse_field() {
  echo "$INPUT" | python3 -c "
import sys, json
try:
    payload = json.load(sys.stdin)
except json.JSONDecodeError as exc:
    sys.stderr.write(f'worktree-create.sh: invalid JSON on stdin: {exc}\n')
    sys.exit(2)
print(payload.get('$1') or '')
" || exit $?
}

BASE_PATH=$(parse_field cwd)
WORKTREE_ID=$(parse_field worktree_id)
NAME_FIELD=$(parse_field name)
WORKTREE_PATH_FIELD=$(parse_field worktree_path)

if [ -z "$BASE_PATH" ] || { [ -z "$WORKTREE_ID" ] && [ -z "$NAME_FIELD" ]; }; then
  echo "worktree-create.sh: missing cwd, worktree_id, or name in hook input" >&2
  exit 1
fi

if [ -n "$WORKTREE_ID" ]; then
  NAME="$WORKTREE_ID"
else
  NAME="$NAME_FIELD"
fi

# Match Claude Code's native naming so existing tooling (the cleanup hook, the
# slot manifest) keeps recognizing the worktree.
BRANCH="worktree-${NAME}"

if [ -n "$WORKTREE_PATH_FIELD" ]; then
  WORKTREE_PATH="$WORKTREE_PATH_FIELD"
else
  WORKTREE_PATH="${BASE_PATH}/.claude/worktrees/${NAME}"
fi

# Ensure the parent directory exists before `git worktree add` tries to write.
# (Claude Code's `name` is currently a flat `agent-<hex>` slug with no slashes,
# but mkdir -p is cheap insurance against future name conventions.)
mkdir -p "$(dirname "$WORKTREE_PATH")"

# --- Resolve the base ref: freshly-fetched origin/main, not the (often stale) root HEAD ---
# The root checkout ($BASE_PATH) stays on `main` but is never fast-forwarded, so its HEAD
# routinely trails origin/main by many commits (PP-2cpf, observed 12 behind). Branching a new
# worktree off that stale HEAD silently poisons anything that reads local files — e.g. the
# session briefing's `pnpm audit` flagging CVEs that were already patched upstream. Both bridge
# sessions and Agent(isolation:worktree) dispatch come through here, so fixing it at this
# chokepoint freshens every path.
#
# Best-effort: fetch origin/main and branch off the fetched SHA; fall back to HEAD's SHA when
# the fetch fails (offline) so worktree creation never hard-depends on the network. Always a
# SHA, never the name HEAD: with branch.autoSetupMerge=always, `-b <new> HEAD` writes tracking
# config. GIT_HTTP_LOW_SPEED_* bounds a stalled fetch (<1KB/s for 15s aborts) so a flaky network
# degrades to the HEAD fallback instead of hanging every worktree creation.
BASE_REF=""
if GIT_HTTP_LOW_SPEED_LIMIT=1000 GIT_HTTP_LOW_SPEED_TIME=15 \
     git -C "$BASE_PATH" fetch --quiet origin main 2>/dev/null; then
  BASE_REF=$(git -C "$BASE_PATH" rev-parse --verify --quiet FETCH_HEAD 2>/dev/null || true)
fi
if [ -z "$BASE_REF" ]; then
  BASE_REF=$(git -C "$BASE_PATH" rev-parse --verify --quiet HEAD 2>/dev/null || echo HEAD)
fi

# Remember what existed before, so a failed add only rolls back what it created.
branch_existed_before=0
worktree_registered_before=0
if git -C "$BASE_PATH" rev-parse --verify --quiet "refs/heads/$BRANCH" >/dev/null 2>&1; then
  branch_existed_before=1
fi
if git -C "$BASE_PATH" worktree list --porcelain 2>/dev/null | grep -Fx "worktree $WORKTREE_PATH" >/dev/null 2>&1; then
  worktree_registered_before=1
fi

if add_output=$(git -C "$BASE_PATH" worktree add "$WORKTREE_PATH" -b "$BRANCH" "$BASE_REF" 2>&1); then
  echo "$WORKTREE_PATH"
  exit 0
fi

echo "worktree-create.sh: git worktree add failed:" >&2
echo "  cwd=$BASE_PATH  branch=$BRANCH  target=$WORKTREE_PATH" >&2
echo "$add_output" >&2
# A failed post-checkout hook leaves a registered worktree and a new branch
# behind; remove both unless they predate this call.
case "$add_output" in
  *post-checkout*|*"hook failed"*)
    if [ "$worktree_registered_before" -eq 0 ] && [ -f "$BASE_PATH/scripts/worktree_cleanup.py" ]; then
      python3 "$BASE_PATH/scripts/worktree_cleanup.py" "$WORKTREE_PATH" >&2 || true
    fi
    if [ "$branch_existed_before" -eq 0 ] && git -C "$BASE_PATH" rev-parse --verify --quiet "refs/heads/$BRANCH" >/dev/null 2>&1; then
      git -C "$BASE_PATH" branch -D "$BRANCH" >&2 2>/dev/null || true
    fi
    ;;
esac
exit 1

