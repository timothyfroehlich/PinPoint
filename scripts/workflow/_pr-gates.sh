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

# Copilot posts a review OBJECT even when it reviewed nothing — quota exhaustion, or
# no files it could analyze. Those carry a real submitted_at and a Copilot login, so a
# login-only filter counts them as reviews and every gate keyed on "a Copilot review
# covers head" goes green on a review that read nothing (PP-jw0s). Strictly worse than
# no review at all, because no-review has its own honest path. Match them by body and
# treat them as absent.
readonly COPILOT_NON_REVIEW_BODY_RE='unable to review|was not able to review|wasn.t able to review|reached their quota limit|no files in this pull request'

# SHA-pinned Claude review marker, posted by mark-claude-review.sh.
readonly CLAUDE_MARKER_PREFIX="<!-- pinpoint-claude-review:"

# Parse owner/repo dynamically — avoid hardcoded slug.
_repo_slug() {
  gh repo view --json nameWithOwner --jq .nameWithOwner
}

# Latest SUBSTANTIVE Copilot review timestamp for a PR, or empty if none.
# Shared by the currency and reviewed gates: they asked the same question with the same
# 3-line jq, and drifted — reviewed learned about the Claude marker, currency did not.
# `jq -rs` (slurp) rather than gh's `--jq`, which runs per-page under --paginate and so
# misses reviews on page 2+ of a busy PR.
_latest_copilot_review_at() {
  local pr=$1 owner_repo=$2
  gh api --paginate "repos/${owner_repo}/pulls/${pr}/reviews" \
    | jq -rs --argjson logins "$(printf '%s\n' "${COPILOT_LOGINS[@]}" | jq -R . | jq -s .)" \
             --arg skip "$COPILOT_NON_REVIEW_BODY_RE" \
        '[ .[] | flatten | .[]
           | select(.user.login as $l | $logins | index($l))
           | select(((.body // "") | test($skip; "i")) | not)
         ] | sort_by(.submitted_at) | last | .submitted_at // empty'
}

# True when a Claude review marker pins THIS head SHA. The pin is what makes the
# attestation self-expiring: a later fix changes the head SHA and re-arms the gates.
# Issue-comments endpoint = PR conversation comments.
_claude_marker_present() {
  local pr=$1 owner_repo=$2 head_sha=$3
  local count
  count=$(gh api --paginate "repos/${owner_repo}/issues/${pr}/comments" \
    | jq -rs --arg marker "${CLAUDE_MARKER_PREFIX} ${head_sha} -->" \
        '[.[] | flatten | .[] | select(.body | contains($marker))] | length')
  [ "${count:-0}" -gt 0 ]
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

# Gate 2: A reviewer has seen the current head commit. Soft by design — this gate
# never FAILs, it only holds briefly to give Copilot a chance to catch up:
#   - Claude marker pins head SHA                  → PASS
#   - no substantive Copilot review on the PR      → SKIP (nothing to be stale about)
#   - Copilot review covers head (review >= head)  → PASS
#   - head newer, elapsed < COPILOT_CURRENCY_THRESHOLD → WAIT
#   - head newer, elapsed >= threshold             → WARN (proceed)
# The hard backstop is `reviewed` (gate 4), not this one.
check_copilot_currency() {
  local pr=$1
  local owner_repo head_sha head_date latest_review elapsed
  owner_repo=$(_repo_slug)

  # Get head SHA and committer date in one call.
  local pr_data
  pr_data=$(gh pr view "$pr" --json headRefOid)
  head_sha=$(jq -r '.headRefOid' <<< "$pr_data")
  head_date=$(gh api "repos/${owner_repo}/commits/${head_sha}" --jq '.commit.committer.date')

  # A Claude review pinned to this head answers currency's question — "has a reviewer
  # seen THIS commit?" — with a stronger signal than a timestamp comparison. Without
  # this check the gate sits out its full timer waiting on a reviewer that already has
  # a documented substitute, which is dead time whenever Copilot is quota-limited.
  if _claude_marker_present "$pr" "$owner_repo" "$head_sha"; then
    echo "PASS: currency: Claude review covers head commit"
    return 0
  fi

  latest_review=$(_latest_copilot_review_at "$pr" "$owner_repo")

  if [ -z "$latest_review" ]; then
    echo "SKIP: currency: no substantive Copilot review exists for this PR"
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

# Gate 4: Head commit was reviewed by *someone* — Copilot OR a SHA-pinned Claude
# review marker. Unlike `currency` (which WARN-proceeds on a stale/absent Copilot
# review), this gate is the hard backstop: a head commit that no one reviewed
# cannot merge. The Claude marker is `<!-- pinpoint-claude-review: <head_sha> -->`
# in a PR conversation comment (posted by mark-claude-review.sh); the SHA pin makes
# it self-expiring — a later fix changes the head SHA and re-arms the gate.
#   - Claude marker matches head SHA            → PASS
#   - Copilot review covers head (review>=head) → PASS
#   - no review, head age < threshold           → WAIT (still inside Copilot window)
#   - no review, head age >= threshold          → FAIL
check_review_happened() {
  local pr=$1
  local owner_repo head_sha head_date latest_review elapsed
  owner_repo=$(_repo_slug)

  # Head SHA + committer date (same idiom as check_copilot_currency).
  local pr_data
  pr_data=$(gh pr view "$pr" --json headRefOid)
  head_sha=$(jq -r '.headRefOid' <<< "$pr_data")
  head_date=$(gh api "repos/${owner_repo}/commits/${head_sha}" --jq '.commit.committer.date')

  if _claude_marker_present "$pr" "$owner_repo" "$head_sha"; then
    echo "PASS: reviewed: Claude review covers head commit"
    return 0
  fi

  latest_review=$(_latest_copilot_review_at "$pr" "$owner_repo")

  # macOS vs Linux date parsing with TZ=UTC normalization (mirrors check_copilot_currency).
  local head_epoch review_epoch=0 now_epoch
  if date -d "$head_date" +%s >/dev/null 2>&1; then
    head_epoch=$(date -d "$head_date" +%s)
    [ -n "$latest_review" ] && review_epoch=$(date -d "$latest_review" +%s)
  else
    head_epoch=$(TZ=UTC date -jf "%Y-%m-%dT%H:%M:%SZ" "${head_date%Z}Z" +%s)
    [ -n "$latest_review" ] && review_epoch=$(TZ=UTC date -jf "%Y-%m-%dT%H:%M:%SZ" "${latest_review%Z}Z" +%s)
  fi
  now_epoch=$(date -u +%s)

  if [ -n "$latest_review" ] && [ "$review_epoch" -ge "$head_epoch" ]; then
    echo "PASS: reviewed: Copilot review covers head commit"
    return 0
  fi

  elapsed=$((now_epoch - head_epoch))
  if [ "$elapsed" -lt "$COPILOT_CURRENCY_THRESHOLD" ]; then
    echo "WAIT: reviewed: ${elapsed}s since head push, awaiting review"
    return 2
  fi
  echo "FAIL: reviewed: head commit has no Copilot or Claude review"
  echo "  note: a Copilot comment saying it could not review (quota limit, nothing to"
  echo "        analyze) does NOT count as a review — that is this gate working."
  echo "  remedy: review the PR yourself, then attest the head commit with:"
  echo "    bash scripts/workflow/mark-claude-review.sh $pr \"<one-line findings>\""
  return 1
}

# Gate 5: PR has no merge conflict. UNKNOWN returned once; caller may retry.
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
