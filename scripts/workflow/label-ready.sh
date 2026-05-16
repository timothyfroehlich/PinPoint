#!/bin/bash
# scripts/workflow/label-ready.sh
# Labels a PR as ready-for-review if it passes all CI checks and has 0 Copilot comments.
# Optionally cleans up the associated worktree.
#
# Usage:
#   ./scripts/workflow/label-ready.sh 918                    # Check and label if ready
#   ./scripts/workflow/label-ready.sh 918 --cleanup          # Also remove worktree
#   ./scripts/workflow/label-ready.sh 918 --force             # Label even with Copilot comments
#   ./scripts/workflow/label-ready.sh 918 --dry-run           # Show what would happen
#
# Copilot review currency gate (PP-pny0):
#   After CI passes, verifies the latest Copilot review covers the head commit.
#   - head newer than last review AND elapsed < 600s → exit 1 (WAIT)
#   - head newer than last review AND elapsed >= 600s → WARN and proceed
#   - review is current (review timestamp >= head commit timestamp) → proceed
#   - no Copilot reviews at all → proceed (some PRs legitimately skip Copilot)
#   - --force bypasses this gate

set -euo pipefail

if [ $# -lt 1 ]; then
    echo "Usage: $0 <PR_NUMBER> [--cleanup] [--force] [--dry-run]"
    exit 1
fi

PR=$1
if ! [[ "$PR" =~ ^[0-9]+$ ]]; then
    echo "Error: PR number must be numeric (e.g. '945'); received '$PR'."
    exit 1
fi
shift

CLEANUP=false
FORCE=false
DRY_RUN=false

for arg in "$@"; do
    case $arg in
        --cleanup) CLEANUP=true ;;
        --force) FORCE=true ;;
        --dry-run) DRY_RUN=true ;;
        *) echo "Error: unknown option '$arg'."; echo "Usage: $0 <PR_NUMBER> [--cleanup] [--force] [--dry-run]"; exit 1 ;;
    esac
done

# Get branch and draft status
pr_data=$(gh pr view "$PR" --json headRefName,isDraft 2>/dev/null) || { echo "FAIL: Could not fetch PR #${PR}."; exit 1; }
branch=$(echo "$pr_data" | jq -r '.headRefName')
is_draft=$(echo "$pr_data" | jq -r '.isDraft')

echo "PR #${PR} — branch: ${branch}"

# Check draft
if [ "$is_draft" = "true" ]; then
    echo "SKIP: PR is a draft."
    exit 1
fi

# Check CI
checks=$(gh pr checks "$PR" --json name,state 2>&1) || { echo "FAIL: Could not fetch CI checks for PR #${PR}."; exit 1; }
total=$(echo "$checks" | jq 'length')
failed=$(echo "$checks" | jq '[.[] | select((.state != "SUCCESS") and (.state != "IN_PROGRESS") and (.state != "QUEUED") and (.state != "PENDING") and (.state != "CANCELLED") and (.state != "SKIPPED") and (.name | startswith("codecov/") | not))] | length')
pending=$(echo "$checks" | jq '[.[] | select(.state == "IN_PROGRESS" or .state == "QUEUED" or .state == "PENDING")] | length')

if [ "$total" -eq 0 ]; then
    echo "WAIT: No CI checks reported yet."
    exit 1
fi

if [ "$pending" -gt 0 ]; then
    echo "WAIT: ${pending} checks still running."
    exit 1
fi

if [ "$failed" -gt 0 ]; then
    failed_names=$(echo "$checks" | jq -r '.[] | select((.state != "SUCCESS") and (.state != "IN_PROGRESS") and (.state != "QUEUED") and (.state != "PENDING") and (.state != "CANCELLED") and (.state != "SKIPPED") and (.name | startswith("codecov/") | not)) | "\(.name) (\(.state))"' | paste -sd ", ")
    echo "FAIL: ${failed} checks failed: ${failed_names}"
    exit 1
fi

echo "CI: All checks passed."

# Gate: Copilot review currency (PP-pny0)
# Verifies the latest Copilot review covers the current head commit.
# ISO 8601 timestamps from GitHub are always UTC (Z suffix), so string
# comparison is lexicographically correct (same logic as copilot-comments.sh).
COPILOT_CURRENCY_THRESHOLD=600  # seconds; elapsed >= threshold → WARN and proceed

if [ "$FORCE" = "false" ]; then
    latest_review=$(gh api "repos/timothyfroehlich/PinPoint/pulls/${PR}/reviews" \
        --jq '[.[] | select(.user.login == "copilot-pull-request-reviewer[bot]")] | sort_by(.submitted_at) | last | .submitted_at // empty' 2>/dev/null) || latest_review=""

    if [ -n "$latest_review" ]; then
        head_sha=$(gh api "repos/timothyfroehlich/PinPoint/pulls/${PR}" --jq '.head.sha // empty' 2>/dev/null) || head_sha=""
        if [ -n "$head_sha" ]; then
            head_date=$(gh api "repos/timothyfroehlich/PinPoint/commits/${head_sha}" --jq '.commit.committer.date // empty' 2>/dev/null) || head_date=""

            if [ -n "$head_date" ] && [[ "$head_date" > "$latest_review" ]]; then
                # Head commit is newer than last Copilot review — compute elapsed seconds.
                # Both macOS (BSD date -jf) and Linux (GNU date -d) need TZ=UTC to parse
                # the trailing Z as UTC rather than the local timezone.
                if date --version >/dev/null 2>&1; then
                    # GNU date (Linux)
                    head_epoch=$(TZ=UTC date -d "$head_date" +%s 2>/dev/null) || head_epoch=0
                    now_epoch=$(date +%s)
                else
                    # BSD date (macOS) — strip trailing Z, parse with explicit TZ=UTC
                    head_date_noz="${head_date%Z}"
                    head_epoch=$(TZ=UTC date -jf "%Y-%m-%dT%H:%M:%S" "$head_date_noz" +%s 2>/dev/null) || head_epoch=0
                    now_epoch=$(date +%s)
                fi

                if [ "$head_epoch" -gt 0 ]; then
                    elapsed=$(( now_epoch - head_epoch ))
                    if [ "$elapsed" -lt "$COPILOT_CURRENCY_THRESHOLD" ]; then
                        echo "WAIT: Copilot review pending for ${elapsed}s since push (threshold: ${COPILOT_CURRENCY_THRESHOLD}s). Use --force to override."
                        exit 1
                    else
                        echo "WARN: Copilot review not received after ${elapsed}s — proceeding."
                    fi
                else
                    echo "WARN: Could not parse head commit date '${head_date}' — skipping currency check."
                fi
            elif [ -n "$head_date" ]; then
                echo "Copilot: review is current."
            else
                echo "WARN: Could not fetch head commit date — skipping currency check."
            fi
        else
            echo "WARN: Could not fetch head SHA — skipping currency check."
        fi
    else
        # No Copilot reviews at all — some PRs legitimately skip (e.g. Dependabot).
        echo "Copilot: no reviews found — skipping currency check."
    fi
fi

# Check Copilot comments (unresolved threads only via GraphQL)
# shellcheck disable=SC2016
copilot_count=$(gh api graphql -f query="
  {
    repository(owner: \"timothyfroehlich\", name: \"PinPoint\") {
      pullRequest(number: $PR) {
        reviewThreads(first: 100) {
          nodes {
            isResolved
            comments(first: 1) {
              nodes { author { login } }
            }
          }
        }
      }
    }
  }" --jq '
  [.data.repository.pullRequest.reviewThreads.nodes[]
   | select(.isResolved == false)
   | select(.comments.nodes | length > 0)
   | .comments.nodes[0] as $comment
   | select(
       $comment.author.login == "copilot-pull-request-reviewer"
       or $comment.author.login == "copilot-pull-request-reviewer[bot]"
     )]
   | length' 2>/dev/null) || { echo "FAIL: Could not fetch Copilot threads (API error). Use --force to skip."; exit 1; }

if [ "$copilot_count" -gt 0 ] && [ "$FORCE" = "false" ]; then
    echo "BLOCK: ${copilot_count} unresolved Copilot thread(s). Use --force to label anyway."
    exit 1
fi

if [ "$copilot_count" -gt 0 ]; then
    echo "WARN: ${copilot_count} unresolved Copilot thread(s) (--force used)."
else
    echo "Copilot: 0 unresolved threads."
fi

# Label
if [ "$DRY_RUN" = "true" ]; then
    echo "DRY RUN: Would label PR #${PR} as ready-for-review"
else
    gh pr edit "$PR" --add-label "ready-for-review" >/dev/null 2>&1 || { echo "FAIL: Could not add ready-for-review label."; exit 1; }
    echo "Labeled PR #${PR} as ready-for-review."
fi

# Cleanup worktree
if [ "$CLEANUP" = "true" ]; then
    # The main worktree is always the first entry in 'git worktree list --porcelain'.
    # We never want to clean it up — running worktree_cleanup.py on it would stop
    # the user's Supabase and try to remove their primary checkout.
    main_worktree=$(git worktree list --porcelain | awk '/^worktree / { print substr($0, 10); exit }')

    # Ask git for the worktree path bound to this branch — handles every layout
    # (pinpoint-worktrees/<branch>, pinpoint-worktrees/<branch-with-slashes-as-dashes>,
    # and Claude Code's .claude/worktrees/agent-<hash>).
    worktree_path=$(git worktree list --porcelain | awk -v target="refs/heads/${branch}" '
        /^worktree / { wt = substr($0, 10) }
        /^branch /   { if ($2 == target) { print wt; exit } }
    ')
    is_locked=false
    if [ -n "$worktree_path" ]; then
        if git worktree list --porcelain | awk -v wt="$worktree_path" '
            /^worktree / { current = ($0 == "worktree " wt) }
            /^locked/    { if (current) { exit 0 } }
            END          { exit 1 }
        '; then
            is_locked=true
        fi
    fi

    # Fallbacks for older naming conventions in case git's metadata is missing
    if [ -z "$worktree_path" ]; then
        branch_dir=$(echo "$branch" | tr '/' '-')
        for candidate in \
            "${HOME}/Code/pinpoint-worktrees/${branch_dir}" \
            "${HOME}/Code/pinpoint-worktrees/${branch}"; do
            if [ -d "$candidate" ]; then
                worktree_path="$candidate"
                break
            fi
        done
    fi

    if [ -z "$worktree_path" ] || [ ! -d "$worktree_path" ]; then
        echo "No worktree found for branch ${branch}."
    elif [ "$worktree_path" = "$main_worktree" ]; then
        echo "SKIP: Branch lives in the main worktree (${worktree_path}); cleanup would stop Supabase and try to remove the primary checkout."
    elif [ "$is_locked" = "true" ]; then
        echo "SKIP: Worktree at ${worktree_path} is locked (likely an active subagent). Remove manually after the agent finishes."
    elif [ "$DRY_RUN" = "true" ]; then
        echo "DRY RUN: Would remove worktree at ${worktree_path}"
    else
        echo "Removing worktree: ${worktree_path}"
        if [ -f "./scripts/worktree_cleanup.py" ]; then
            python3 ./scripts/worktree_cleanup.py "$worktree_path" || echo "WARN: worktree cleanup failed."
        fi
        if [ -d "$worktree_path" ]; then
            git worktree remove "$worktree_path" 2>/dev/null || \
                echo "WARN: Could not remove worktree (it may contain uncommitted changes). Clean up manually."
        fi
    fi
fi

echo "Done."
