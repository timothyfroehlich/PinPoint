#!/bin/bash
# scripts/workflow/stale-worktrees.sh
# Detects stale ephemeral worktrees by cross-referencing against open PRs.
#
# Status:
#   ACTIVE - Has an open PR
#   STALE  - No open PR, working tree clean
#   DIRTY  - No open PR, has uncommitted changes
#
# Usage:
#   ./scripts/workflow/stale-worktrees.sh              # Report all ephemeral worktrees
#   ./scripts/workflow/stale-worktrees.sh --clean      # Remove STALE worktrees
#   ./scripts/workflow/stale-worktrees.sh --json        # Machine-readable JSON output

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

CLEAN=false
JSON_OUTPUT=false

for arg in "$@"; do
    case $arg in
        --clean) CLEAN=true ;;
        --json) JSON_OUTPUT=true ;;
        *) echo "Error: unknown option '$arg'."; echo "Usage: $0 [--clean] [--json]"; exit 1 ;;
    esac
done

# Get all open PR branch names in one API call
if ! open_branches=$(gh pr list --state open --json headRefName --jq '.[].headRefName' 2>/dev/null); then
    if [ "$CLEAN" = "true" ]; then
        echo "ERROR: Cannot fetch open PRs from GitHub. Aborting --clean to prevent accidental removal."
        exit 1
    fi
    open_branches=""
fi

# Parse worktree list (porcelain format)
worktree_paths=()
while IFS= read -r line; do
    if [[ "$line" == "worktree "* ]]; then
        wt_path="${line#worktree }"
        # Only include ephemeral worktrees (under pinpoint-worktrees/)
        if [[ "$wt_path" == *"/pinpoint-worktrees/"* ]]; then
            worktree_paths+=("$wt_path")
        fi
    fi
done < <(git worktree list --porcelain 2>/dev/null)

if [ ${#worktree_paths[@]} -eq 0 ]; then
    if [ "$JSON_OUTPUT" = "true" ]; then
        echo "[]"
    else
        echo "No ephemeral worktrees found."
    fi
    exit 0
fi

# Collect results
json_entries=()
stale_count=0
dirty_count=0
active_count=0

if [ "$JSON_OUTPUT" = "false" ]; then
    printf "%-40s %-30s %-8s %s\n" "WORKTREE" "BRANCH" "STATUS" "DETAILS"
    printf "%-40s %-30s %-8s %s\n" "----------------------------------------" "------------------------------" "--------" "-------------------"
fi

for wt_path in "${worktree_paths[@]}"; do
    dir_name=$(basename "$wt_path")

    # Get branch name
    branch=$(git -C "$wt_path" rev-parse --abbrev-ref HEAD 2>/dev/null) || branch="unknown"

    # Check if branch has an open PR
    has_pr=false
    if echo "$open_branches" | grep -Fqx "$branch" 2>/dev/null; then
        has_pr=true
    fi

    # Check for uncommitted changes
    changes=$(git -C "$wt_path" status --porcelain 2>/dev/null) || changes=""
    has_changes=false
    if [ -n "$changes" ]; then
        has_changes=true
    fi

    # Determine status
    if [ "$has_pr" = "true" ]; then
        status="ACTIVE"
        details="open PR"
        active_count=$((active_count + 1))
    elif [ "$has_changes" = "true" ]; then
        status="DIRTY"
        change_count=$(echo "$changes" | wc -l | tr -d ' ')
        details="${change_count} uncommitted file(s)"
        dirty_count=$((dirty_count + 1))
    else
        status="STALE"
        details="no PR, clean"
        stale_count=$((stale_count + 1))
    fi

    if [ "$JSON_OUTPUT" = "true" ]; then
        json_entry=$(jq -n \
            --arg path "$wt_path" \
            --arg dir "$dir_name" \
            --arg branch "$branch" \
            --arg status "$status" \
            --argjson has_pr "$has_pr" \
            --argjson has_changes "$has_changes" \
            '{path: $path, dir: $dir, branch: $branch, status: $status, has_pr: $has_pr, has_changes: $has_changes}')
        json_entries+=("$json_entry")
    else
        printf "%-40s %-30s %-8s %s\n" "$dir_name" "$branch" "$status" "$details"
    fi
done

if [ "$JSON_OUTPUT" = "true" ]; then
    # Build JSON array
    echo -n "["
    for i in "${!json_entries[@]}"; do
        if [ "$i" -gt 0 ]; then echo -n ","; fi
        echo -n "${json_entries[$i]}"
    done
    echo "]"
else
    echo ""
    echo "Summary: ${active_count} active, ${stale_count} stale, ${dirty_count} dirty"
fi

# Clean stale worktrees if requested
if [ "$CLEAN" = "true" ] && [ "$stale_count" -gt 0 ] && [ "$JSON_OUTPUT" = "false" ]; then
    echo ""
    echo "Cleaning ${stale_count} stale worktree(s)..."
    for wt_path in "${worktree_paths[@]}"; do
        branch=$(git -C "$wt_path" rev-parse --abbrev-ref HEAD 2>/dev/null) || continue

        has_pr=false
        if echo "$open_branches" | grep -Fqx "$branch" 2>/dev/null; then
            has_pr=true
        fi

        changes=$(git -C "$wt_path" status --porcelain 2>/dev/null) || changes=""

        if [ "$has_pr" = "false" ] && [ -z "$changes" ]; then
            echo "  Removing: $branch"
            python3 "$REPO_ROOT/pinpoint-wt.py" remove "$branch" 2>/dev/null || echo "    WARN: Failed to remove $branch"
        fi
    done
    echo "Done."
fi
