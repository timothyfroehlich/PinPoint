#!/bin/bash
# scripts/workflow/_pr-gates.sh
# Shared PR gate functions sourced by label-ready.sh and claude-merge.sh.
# Each function prints informative output and returns 0 (pass) or 1 (fail).
#
# Usage: source this file, then call gate functions:
#   check_ci <PR>
#   check_copilot_currency <PR> [force]
#   check_unresolved_threads <PR> [force]
#   check_no_merge_conflict <PR>
#
# Pass "true" as the second arg to force-bypass gates that support it.

# ---------------------------------------------------------------------------
# check_ci <PR>
# Verifies all CI checks have completed and passed (ignoring codecov/* checks).
# Returns 0 if all checks succeeded, 1 if any failed, pending, or no checks.
# ---------------------------------------------------------------------------
check_ci() {
    local PR="$1"
    local checks total failed pending failed_names

    checks=$(gh pr checks "$PR" --json name,state 2>&1) || {
        echo "FAIL: Could not fetch CI checks for PR #${PR}."
        return 1
    }
    total=$(echo "$checks" | jq 'length')
    failed=$(echo "$checks" | jq '[.[] | select((.state != "SUCCESS") and (.state != "IN_PROGRESS") and (.state != "QUEUED") and (.state != "PENDING") and (.state != "CANCELLED") and (.state != "SKIPPED") and (.name | startswith("codecov/") | not))] | length')
    pending=$(echo "$checks" | jq '[.[] | select(.state == "IN_PROGRESS" or .state == "QUEUED" or .state == "PENDING")] | length')

    if [ "$total" -eq 0 ]; then
        echo "WAIT: No CI checks reported yet."
        return 1
    fi

    if [ "$pending" -gt 0 ]; then
        echo "WAIT: ${pending} checks still running."
        return 1
    fi

    if [ "$failed" -gt 0 ]; then
        failed_names=$(echo "$checks" | jq -r '.[] | select((.state != "SUCCESS") and (.state != "IN_PROGRESS") and (.state != "QUEUED") and (.state != "PENDING") and (.state != "CANCELLED") and (.state != "SKIPPED") and (.name | startswith("codecov/") | not)) | "\(.name) (\(.state))"' | paste -sd ", ")
        echo "FAIL: ${failed} checks failed: ${failed_names}"
        return 1
    fi

    echo "CI: All checks passed."
    return 0
}

# ---------------------------------------------------------------------------
# check_copilot_currency <PR> [force]
# Verifies the latest Copilot review covers the head commit (PP-pny0 logic).
# If force="true", skips the check and returns 0.
# Returns 0 (pass/warn/skip) or 1 (WAIT: review pending within threshold).
# ---------------------------------------------------------------------------
COPILOT_CURRENCY_THRESHOLD=600  # seconds; elapsed >= threshold → WARN and proceed

check_copilot_currency() {
    local PR="$1"
    local force="${2:-false}"
    local reviews_json latest_review head_sha head_date head_epoch now_epoch elapsed head_date_noz

    if [ "$force" = "true" ]; then
        return 0
    fi

    # Paginate to cover long-running PRs with >30 review cycles. Run jq on the
    # merged output (not via --jq) so sort_by/last operates across all pages.
    # Distinguish API failure from "no Copilot reviews": failure exits 1 per
    # scripts/workflow/AGENTS.md ("label-ready must fail closed on Copilot
    # API errors unless --force").
    if ! reviews_json=$(gh api --paginate "repos/timothyfroehlich/PinPoint/pulls/${PR}/reviews" 2>/dev/null); then
        echo "FAIL: Could not query Copilot reviews from GitHub API. Use --force to override."
        return 1
    fi
    latest_review=$(echo "$reviews_json" | jq -r '[.[] | select(.user.login == "copilot-pull-request-reviewer[bot]")] | sort_by(.submitted_at) | last | .submitted_at // empty')

    if [ -n "$latest_review" ]; then
        if ! head_sha=$(gh api "repos/timothyfroehlich/PinPoint/pulls/${PR}" --jq '.head.sha // empty' 2>/dev/null); then
            echo "FAIL: Could not fetch PR head SHA from GitHub API. Use --force to override."
            return 1
        fi
        if [ -n "$head_sha" ]; then
            if ! head_date=$(gh api "repos/timothyfroehlich/PinPoint/commits/${head_sha}" --jq '.commit.committer.date // empty' 2>/dev/null); then
                echo "FAIL: Could not fetch head commit metadata from GitHub API. Use --force to override."
                return 1
            fi

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
                        return 1
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
    return 0
}

# ---------------------------------------------------------------------------
# check_unresolved_threads <PR> [force]
# Verifies there are 0 unresolved Copilot review threads (via GraphQL).
# If force="true", warns instead of blocking.
# Returns 0 (pass or forced) or 1 (unresolved threads present).
# ---------------------------------------------------------------------------
check_unresolved_threads() {
    local PR="$1"
    local force="${2:-false}"
    local copilot_count

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
   | length' 2>/dev/null) || {
        echo "FAIL: Could not fetch Copilot threads (API error). Use --force to skip."
        return 1
    }

    if [ "$copilot_count" -gt 0 ] && [ "$force" = "false" ]; then
        echo "BLOCK: ${copilot_count} unresolved Copilot thread(s). Use --force to label anyway."
        return 1
    fi

    if [ "$copilot_count" -gt 0 ]; then
        echo "WARN: ${copilot_count} unresolved Copilot thread(s) (--force used)."
    else
        echo "Copilot: 0 unresolved threads."
    fi
    return 0
}

# ---------------------------------------------------------------------------
# check_no_merge_conflict <PR>
# Verifies the PR is mergeable (not CONFLICTING). BEHIND is allowed.
# Retries up to 30s if GitHub returns UNKNOWN (still computing).
# Returns 0 (MERGEABLE or BEHIND) or 1 (CONFLICTING or timeout).
# ---------------------------------------------------------------------------
check_no_merge_conflict() {
    local PR="$1"
    local mergeable elapsed=0 interval=5

    while [ "$elapsed" -le 30 ]; do
        mergeable=$(gh pr view "$PR" --json mergeable --jq '.mergeable' 2>/dev/null) || {
            echo "FAIL: Could not fetch mergeable status for PR #${PR}."
            return 1
        }

        case "$mergeable" in
            MERGEABLE)
                echo "Merge: no conflicts."
                return 0
                ;;
            CONFLICTING)
                echo "BLOCK: PR has merge conflicts. Resolve and re-push before merging."
                return 1
                ;;
            UNKNOWN)
                if [ "$elapsed" -eq 0 ]; then
                    echo "Merge: GitHub still computing merge status, waiting..."
                fi
                sleep "$interval"
                elapsed=$(( elapsed + interval ))
                ;;
            *)
                echo "WARN: Unexpected mergeable status '${mergeable}' — skipping conflict check."
                return 0
                ;;
        esac
    done

    echo "FAIL: Timed out waiting for GitHub to compute merge status. Re-run or use --force."
    return 1
}
