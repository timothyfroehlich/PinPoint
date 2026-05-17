#!/usr/bin/env bash
# Shared PR gate functions. Sourced by merge-pr.sh and other workflow scripts.
# Each gate function prints structured status to stdout and returns 0 (pass) or non-zero (fail).
# Callers interpret --force/--dry-run semantics; gates are pure status reporters.
#
# Status token vocabulary:
#   PASS: <gate>: <state>     — gate passed
#   FAIL: <gate>: <state>     — gate failed (blocks)
#   WAIT: <gate>: <state>     — transient state, retry suggested
#   BLOCK: <gate>: <state>    — state mismatch, user action needed
#   WARN: <gate>: <state>     — proceeding with notice
#   SKIP: <gate>: <reason>    — gate doesn't apply

set -euo pipefail

# Canonical Copilot reviewer login allowlist. Source of truth for all PinPoint workflow scripts.
readonly COPILOT_LOGINS=("copilot-pull-request-reviewer" "copilot-pull-request-reviewer[bot]")

# Threshold: if Copilot review is stale by more than this many seconds since head push,
# WARN-and-proceed instead of WAIT. Covers GitHub silently-skipped review_requested events
# (observed in PR #1342 and PR #1326).
readonly COPILOT_CURRENCY_THRESHOLD=600

# Parse owner/repo dynamically — avoid hardcoded slug.
_repo_slug() {
  gh repo view --json nameWithOwner --jq .nameWithOwner
}

# Gate 1: CI Gate check has SUCCESS conclusion.
check_ci() {
  local pr=$1
  local rollup
  rollup=$(gh pr view "$pr" --json statusCheckRollup --jq '.statusCheckRollup[] | select(.name=="CI Gate")')
  if [ -z "$rollup" ]; then
    echo "FAIL: ci: CI Gate check not found"
    return 1
  fi
  local status conclusion
  status=$(jq -r '.status' <<< "$rollup")
  conclusion=$(jq -r '.conclusion' <<< "$rollup")
  if [ "$status" != "COMPLETED" ]; then
    echo "WAIT: ci: CI Gate status=$status"
    return 2
  fi
  case "$conclusion" in
    SUCCESS|NEUTRAL|SKIPPED)
      echo "PASS: ci: CI Gate conclusion=$conclusion"
      return 0
      ;;
    CANCELLED)
      echo "FAIL: ci: CI Gate cancelled"
      return 1
      ;;
    *)
      echo "FAIL: ci: CI Gate conclusion=$conclusion"
      return 1
      ;;
  esac
}

# Gate 2: Latest Copilot review is newer than the PR head commit.
# If head is newer than the latest Copilot review:
#   - elapsed < COPILOT_CURRENCY_THRESHOLD → WAIT
#   - elapsed >= threshold → WARN (proceed)
check_copilot_currency() {
  local pr=$1
  local owner_repo head_sha head_date latest_review elapsed
  owner_repo=$(_repo_slug)

  # Get head SHA and committer date in one call.
  local pr_data
  pr_data=$(gh pr view "$pr" --json headRefOid)
  head_sha=$(jq -r '.headRefOid' <<< "$pr_data")
  head_date=$(gh api "repos/${owner_repo}/commits/${head_sha}" --jq '.commit.committer.date')

  # Get latest Copilot review timestamp via paginated reviews (jq slurp fixes per-page jq bug).
  latest_review=$(gh api --paginate "repos/${owner_repo}/pulls/${pr}/reviews" \
    | jq -rs --argjson logins "$(printf '%s\n' "${COPILOT_LOGINS[@]}" | jq -R . | jq -s .)" \
        '[.[] | flatten | .[] | select(.user.login as $l | $logins | index($l))] | sort_by(.submitted_at) | last | .submitted_at // empty')

  if [ -z "$latest_review" ]; then
    echo "SKIP: currency: no Copilot reviews exist for this PR"
    return 0
  fi

  # macOS vs Linux date parsing with TZ=UTC normalization.
  local head_epoch review_epoch now_epoch
  if date -d "$head_date" +%s >/dev/null 2>&1; then
    head_epoch=$(date -d "$head_date" +%s)
    review_epoch=$(date -d "$latest_review" +%s)
  else
    head_epoch=$(TZ=UTC date -jf "%Y-%m-%dT%H:%M:%SZ" "${head_date%Z}Z" +%s)
    review_epoch=$(TZ=UTC date -jf "%Y-%m-%dT%H:%M:%SZ" "${latest_review%Z}Z" +%s)
  fi
  now_epoch=$(date -u +%s)

  if [ "$review_epoch" -ge "$head_epoch" ]; then
    echo "PASS: currency: latest Copilot review covers head commit"
    return 0
  fi

  elapsed=$((now_epoch - head_epoch))
  if [ "$elapsed" -lt "$COPILOT_CURRENCY_THRESHOLD" ]; then
    echo "WAIT: currency: ${elapsed}s since head push, Copilot review pending"
    return 2
  fi
  echo "WARN: currency: head ${elapsed}s old, Copilot review ${COPILOT_CURRENCY_THRESHOLD}s+ stale"
  return 0
}

# Gate 3: Zero unresolved Copilot threads. Uses GraphQL with cursor pagination.
check_unresolved_threads() {
  local pr=$1
  local owner_repo cursor=""
  local unresolved=0
  local has_next=true
  owner_repo=$(_repo_slug)
  local owner repo
  owner=$(cut -d/ -f1 <<< "$owner_repo")
  repo=$(cut -d/ -f2 <<< "$owner_repo")

  while [ "$has_next" = "true" ]; do
    local after_arg=""
    [ -n "$cursor" ] && after_arg=", after: \"$cursor\""
    local resp
    resp=$(gh api graphql -f query="
      query {
        repository(owner: \"$owner\", name: \"$repo\") {
          pullRequest(number: $pr) {
            reviewThreads(first: 100$after_arg) {
              pageInfo { hasNextPage endCursor }
              nodes { isResolved comments(first: 1) { nodes { author { login } } } }
            }
          }
        }
      }")
    local page_unresolved
    page_unresolved=$(jq --argjson logins "$(printf '%s\n' "${COPILOT_LOGINS[@]}" | jq -R . | jq -s .)" \
      '[.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved == false) | select(.comments.nodes[0].author.login as $l | $logins | index($l))] | length' <<< "$resp")
    unresolved=$((unresolved + page_unresolved))
    has_next=$(jq -r '.data.repository.pullRequest.reviewThreads.pageInfo.hasNextPage' <<< "$resp")
    cursor=$(jq -r '.data.repository.pullRequest.reviewThreads.pageInfo.endCursor // empty' <<< "$resp")
  done

  if [ "$unresolved" -eq 0 ]; then
    echo "PASS: threads: 0 unresolved Copilot threads"
    return 0
  fi
  echo "FAIL: threads: $unresolved unresolved Copilot threads"
  return 1
}

# Gate 4: PR has no merge conflict. UNKNOWN returned once; caller may retry.
check_no_merge_conflict() {
  local pr=$1
  local mergeable
  mergeable=$(gh pr view "$pr" --json mergeable --jq .mergeable)
  case "$mergeable" in
    MERGEABLE)
      echo "PASS: no_conflict: MERGEABLE"
      return 0
      ;;
    CONFLICTING)
      echo "BLOCK: no_conflict: CONFLICTING"
      return 1
      ;;
    UNKNOWN)
      echo "WAIT: no_conflict: GitHub still computing merge status"
      return 2
      ;;
    *)
      echo "FAIL: no_conflict: unexpected mergeable=$mergeable"
      return 1
      ;;
  esac
}
