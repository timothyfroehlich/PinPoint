#!/bin/bash
# scripts/workflow/pr-dashboard.sh
# Shows all open PRs with CI status, review state, and readiness.
#
# Usage:
#   ./scripts/workflow/pr-dashboard.sh          # All open PRs
#   ./scripts/workflow/pr-dashboard.sh 918 920  # Specific PRs only

set -euo pipefail

# shellcheck source=./_pr-gates.sh
# shellcheck disable=SC1091
source "$(dirname "$0")/_pr-gates.sh"

OWNER_REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
OWNER=$(cut -d/ -f1 <<< "$OWNER_REPO")
REPO=$(cut -d/ -f2 <<< "$OWNER_REPO")

# Get PR list
if [ $# -gt 0 ]; then
    PRS="$*"
else
    PRS=$(gh pr list --state open --limit 100 --json number --jq '.[].number' | sort -n)
fi

if [ -z "$PRS" ]; then
    echo "No open PRs found."
    exit 0
fi

# Header. The Review column reports the REVIEW state, not just a thread count:
# a bare "0" read identically for "reviewed, everything resolved" and "nobody has
# reviewed this at all", which is the difference between ready-to-merge and
# nobody-is-coming. Unresolved threads still take precedence — they are the
# actionable state.
printf "%-6s %-40s %-12s %-12s %-10s %-8s %s\n" "PR" "Title" "CI" "Review" "Merge" "Draft" "Branch"
printf "%-6s %-40s %-12s %-12s %-10s %-8s %s\n" "------" "----------------------------------------" "------------" "------------" "----------" "--------" "-------------------"

for pr in $PRS; do
    if ! [[ "$pr" =~ ^[0-9]+$ ]]; then
        echo "Error: PR number must be numeric (e.g. '945'); received '$pr'."
        exit 1
    fi

    # Get PR metadata (including merge status)
    pr_data=$(gh pr view "$pr" --json title,headRefName,isDraft,mergeable,mergeStateStatus 2>/dev/null) || continue
    title=$(echo "$pr_data" | jq -r '.title' | cut -c1-40)
    branch=$(echo "$pr_data" | jq -r '.headRefName')
    is_draft=$(echo "$pr_data" | jq -r '.isDraft')
    merge_state=$(echo "$pr_data" | jq -r '.mergeStateStatus')

    # CI status: count states
    checks=$(gh pr checks "$pr" --json name,state 2>/dev/null) || checks="[]"
    total=$(echo "$checks" | jq 'length')
    passed=$(echo "$checks" | jq '[.[] | select(.state == "SUCCESS")] | length')
    failed=$(echo "$checks" | jq '[.[] | select(.state == "FAILURE" and (.name | startswith("codecov/") | not))] | length')
    pending=$(echo "$checks" | jq '[.[] | select(.state == "IN_PROGRESS" or .state == "QUEUED" or .state == "PENDING")] | length')

    if [ "$failed" -gt 0 ]; then
        ci_status="${failed} FAILED"
    elif [ "$pending" -gt 0 ]; then
        ci_status="${passed}/${total} running"
    else
        ci_status="All passed"
    fi

    # Unresolved review threads, from any author — cursor-paginated to avoid
    # first:100 truncation
    thread_count=0
    cursor=""
    has_next=true
    threads_ok=true
    while [ "$has_next" = "true" ]; do
        after_arg=""
        [ -n "$cursor" ] && after_arg=", after: \"$cursor\""
        # shellcheck disable=SC2016
        resp=$(gh api graphql -f query="
          {
            repository(owner: \"$OWNER\", name: \"$REPO\") {
              pullRequest(number: $pr) {
                reviewThreads(first: 100$after_arg) {
                  pageInfo { hasNextPage endCursor }
                  nodes { isResolved }
                }
              }
            }
          }" 2>/dev/null) || { threads_ok=false; break; }
        page_count=$(jq '
          [.data.repository.pullRequest.reviewThreads.nodes[]
           | select(.isResolved == false)]
           | length' <<< "$resp") || { threads_ok=false; break; }
        thread_count=$((thread_count + page_count))
        has_next=$(jq -r '.data.repository.pullRequest.reviewThreads.pageInfo.hasNextPage' <<< "$resp")
        cursor=$(jq -r '.data.repository.pullRequest.reviewThreads.pageInfo.endCursor // empty' <<< "$resp")
    done
    [ "$threads_ok" = "false" ] && thread_count="?"

    # Review column: unresolved threads win (they need action now); otherwise
    # report which review state the PR is in.
    if [ "$thread_count" = "?" ]; then
        review_str="?"
    elif [ "$thread_count" -gt 0 ]; then
        review_str="${thread_count} unres"
    elif _compute_review_state "$pr" 2>/dev/null; then
        case "$RS_STATE" in
            approval)       review_str="reviewed" ;;
            clean_comment)  review_str="reviewed" ;;
            clean_reaction) review_str="reviewed" ;;
            reviewed)       review_str="reviewed" ;;
            marker)         review_str="reviewed" ;;
            stale_approval) review_str="RE-REVIEW" ;;
            stale_clean_comment) review_str="RE-REVIEW" ;;
            stale_marker)   review_str="RE-REVIEW" ;;
            not_approved)   review_str="NOT APPROVED" ;;
            unreviewed)     review_str="NOT REVIEWED" ;;
            *)            review_str="?" ;;
        esac
    else
        review_str="?"
    fi

    # Merge status
    case "$merge_state" in
        CONFLICTING) merge_str="CONFLICT" ;;
        CLEAN)       merge_str="CLEAN" ;;
        BLOCKED)     merge_str="BLOCKED" ;;
        UNSTABLE)    merge_str="UNSTABLE" ;;
        BEHIND)      merge_str="BEHIND" ;;
        UNKNOWN)     merge_str="UNKNOWN" ;;
        *)           merge_str="${merge_state:-?}" ;;
    esac

    # Draft status
    draft_str=""
    if [ "$is_draft" = "true" ]; then
        draft_str="draft"
    fi

    printf "%-6s %-40s %-12s %-12s %-10s %-8s %s\n" "#${pr}" "$title" "$ci_status" "$review_str" "$merge_str" "$draft_str" "$branch"
done
