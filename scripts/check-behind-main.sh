#!/usr/bin/env bash
# Warn (non-blocking) when the current branch is behind origin/main, especially
# when there are merge conflicts. GitHub Actions silently skips
# `pull_request:synchronize` workflow runs when the merge commit can't be
# created (mergeStateStatus=DIRTY) — a long debugging cycle was caused by
# pushing fixes that CI literally couldn't run. This check surfaces that
# state during local `pnpm run check`, before the push.
#
# Behavior:
# - Skipped on `main` itself (nothing to compare to).
# - Skipped if `origin/main` isn't fetchable (offline, no remote, etc.).
# - Always exits 0 so it never blocks the check pipeline.
# - Prints to stderr so the warning stands out from check pass/fail noise.

set -u

# Skip if we're on main.
current=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
if [[ "$current" == "main" || -z "$current" ]]; then
  exit 0
fi

# Quiet fetch — don't fail the pipeline if offline.
if ! git fetch --quiet origin main 2>/dev/null; then
  exit 0
fi

# Count commits we're behind.
behind=$(git rev-list --count "HEAD..origin/main" 2>/dev/null || echo "0")
if [[ "$behind" -eq 0 ]]; then
  exit 0
fi

# Try a dry-run merge to detect conflicts.
# `git merge-tree` writes a unified diff with `<<<<<<<` markers when there are
# conflicts. We don't actually modify the working tree.
base=$(git merge-base HEAD origin/main 2>/dev/null || echo "")
conflicts=0
if [[ -n "$base" ]]; then
  if git merge-tree "$base" HEAD origin/main 2>/dev/null | grep -q "^<<<<<<<"; then
    conflicts=1
  fi
fi

# Format the warning so it's hard to miss.
{
  echo ""
  echo "⚠️  Branch is $behind commit(s) behind origin/main."
  if [[ "$conflicts" -eq 1 ]]; then
    echo "   ⛔ Merge conflicts detected. GitHub Actions WILL NOT run the CI"
    echo "      workflow on a 'pull_request:synchronize' event while the PR is"
    echo "      in this state (mergeStateStatus: DIRTY). Push will not retrigger CI."
    echo "      Resolve before pushing:"
    echo ""
    echo "        git fetch origin && git merge origin/main"
  else
    echo "   No merge conflicts detected, but it's still good practice to merge"
    echo "   periodically:"
    echo ""
    echo "        git fetch origin && git merge origin/main"
  fi
  echo ""
} >&2

exit 0
