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

# The GitHub App identity Codex uses for native pull-request reviews. The account is
# deliberately exact: accepting an arbitrary bot (or a human who happens to include
# "codex" in a login) would let a review be forged. A qualifying approval must also name
# the PR's exact current head SHA.
readonly CODEX_REVIEW_BOT="chatgpt-codex-connector[bot]"

# Parse owner/repo dynamically — avoid hardcoded slug. Memoized: several gates ask for
# it and pr-dashboard.sh runs them once per open PR, so an unmemoized call was one
# wasted API round-trip per question.
_REPO_SLUG_CACHE=""
_repo_slug() {
  if [ -z "$_REPO_SLUG_CACHE" ]; then
    _REPO_SLUG_CACHE=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
  fi
  printf '%s\n' "$_REPO_SLUG_CACHE"
}

# The full record of the Codex GitHub review that decides a head's state, as one TSV
# line: <state> <sha> <reviewer> <detail> <submitted_at> <summary line>.
#
# The latest review from the trusted Codex App is authoritative. An approval for an
# older commit cannot cover a later push, and a later change-request review cannot
# inherit an earlier approval. GitHub's commit_id is compared directly to the head SHA;
# timestamps are only ordering metadata.
#
# The slurp is required because gh emits one JSON array per page under --paginate.
_review_record() {
  local pr=$1 owner_repo=$2 head=$3
  gh api --paginate "repos/${owner_repo}/pulls/${pr}/reviews" \
    | jq -rs --arg bot "$CODEX_REVIEW_BOT" --arg head "$head" \
        '[ .[] | flatten | .[]
           | select(.user.login? == $bot)
           | { sha: (.commit_id // ""),
               reviewer: (.user.login // ""),
               detail: (.state // "UNKNOWN"),
               at: (.submitted_at // ""),
               summary: (((.body? // "") | tostring | split("\n")[0] // "") | gsub("^\\s+|\\s+$"; "")) }
         ] | sort_by(.at) as $reviews
         | if ($reviews | length) == 0 then
             { state: "unreviewed", sha: "", reviewer: "", detail: "", at: "", summary: "" }
           else
             $reviews[-1] as $latest
             | if $latest.detail == "APPROVED" and $latest.sha == $head then
                 $latest + { state: "approval" }
               elif $latest.detail == "APPROVED" then
                 $latest + { state: "stale_approval" }
               else
                 $latest + { state: "not_approved" }
               end
           end
         | [ .state, .sha, .reviewer, .detail, .at, .summary ] | @tsv'
}

# The review verdict on a given head, printed as "<state> <sha>" — the two
# fields of _review_record the merge gate acts on.
_review_verdict() {
  local record
  record=$(_review_record "$1" "$2" "$3")
  printf '%s %s\n' "$(cut -f1 <<< "$record")" "$(cut -f2 <<< "$record")"
}

# Gate 1: CI Gate check has SUCCESS conclusion.
check_ci() {
  local pr=$1
  local rollup
  rollup=$(gh pr view "$pr" --json statusCheckRollup --jq '.statusCheckRollup[] | select(.name=="CI Gate")')
  if [ -z "$rollup" ]; then
    # Not a failure — GitHub has simply not registered the check run yet, which is
    # the normal state for the first seconds after `gh pr create`. Reporting it as a
    # hard FAIL made `--automerge` exit RED on its first poll and strip the
    # ready-for-review label, breaking the very case it exists for. WAIT lets the
    # poller keep looking; a genuinely absent workflow then ends in a timeout, which
    # is the honest outcome. One-shot callers still block — they treat WAIT and FAIL
    # alike — so this changes the token, not their exit code.
    echo "WAIT: ci: CI Gate check not reported yet"
    return 2
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

# ---------------------------------------------------------------------------------
# Shared review state — a native Codex GitHub approval pinned to the PR head.
# ---------------------------------------------------------------------------------
#
#   approval        Codex approved the current head SHA
#   stale_approval  Codex approved a different SHA — the current head was not reviewed
#   not_approved    Codex reviewed, but did not approve its most-recent review
#   unreviewed      Codex has not reviewed this PR
#
# Sets globals: RS_STATE RS_HEAD_SHA RS_REVIEW_SHA
RS_STATE=""
RS_HEAD_SHA=""
RS_REVIEW_SHA=""

_compute_review_state() {
  local pr=$1
  local owner_repo head_sha verdict
  owner_repo=$(_repo_slug)

  head_sha=$(gh pr view "$pr" --json headRefOid --jq .headRefOid)
  verdict=$(_review_verdict "$pr" "$owner_repo" "$head_sha")

  RS_HEAD_SHA=$head_sha
  RS_STATE=${verdict%% *}
  RS_REVIEW_SHA=${verdict#* }
}

_review_remedy() {
  local pr=$1
  echo "  remedy: comment @codex review on PR #${pr}, address every finding, and ask"
  echo "          Codex to review again after any push. The approval must name this head SHA."
}

# Gate 2: Zero unresolved review threads. Uses GraphQL with cursor pagination.
#
# Counts threads from ANY author. It used to filter to Copilot-authored threads, which
# after the retirement would have matched nothing and turned this gate into a permanent
# PASS — a false green strictly worse than no gate. Every thread on a PinPoint PR now
# comes from Tim or another agent, and AGENTS.md already requires each one to be fixed
# or explicitly declined-and-resolved, so counting all of them is what the policy said
# all along.
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
              nodes { isResolved }
            }
          }
        }
      }")
    local page_unresolved
    page_unresolved=$(jq '[.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved == false)] | length' <<< "$resp")
    unresolved=$((unresolved + page_unresolved))
    has_next=$(jq -r '.data.repository.pullRequest.reviewThreads.pageInfo.hasNextPage' <<< "$resp")
    cursor=$(jq -r '.data.repository.pullRequest.reviewThreads.pageInfo.endCursor // empty' <<< "$resp")
  done

  if [ "$unresolved" -eq 0 ]; then
    echo "PASS: threads: 0 unresolved review threads"
    return 0
  fi
  echo "FAIL: threads: $unresolved unresolved review threads"
  echo "  remedy: fix the code, or decline with a one-sentence reply — then resolve"
  echo "          the thread. A silent ignore is not a resolution (AGENTS.md §5)."
  return 1
}

# Gate 3: the trusted Codex App must approve the exact current head commit.
#
#   approval        → PASS
#   stale_approval  → FAIL: Codex approved an earlier commit
#   not_approved    → FAIL: Codex posted a non-approval review
#   unreviewed      → FAIL: Codex has not reviewed the PR
check_review_happened() {
  local pr=$1
  _compute_review_state "$pr"

  case "$RS_STATE" in
    approval)
      echo "PASS: reviewed: Codex approved head SHA ${RS_HEAD_SHA:0:7}"
      return 0
      ;;
    stale_approval)
      echo "FAIL: reviewed: Codex approved ${RS_REVIEW_SHA:0:7}, but head is ${RS_HEAD_SHA:0:7}"
      echo "  You pushed after that approval, so what is about to merge was never read."
      _review_remedy "$pr"
      return 1
      ;;
    not_approved)
      echo "FAIL: reviewed: Codex last reviewed ${RS_REVIEW_SHA:0:7} without approval"
      _review_remedy "$pr"
      return 1
      ;;
    unreviewed)
      echo "FAIL: reviewed: no Codex approval on PR #${pr} — head ${RS_HEAD_SHA:0:7} is unreviewed"
      _review_remedy "$pr"
      return 1
      ;;
    *)
      echo "FAIL: reviewed: unrecognised review state '${RS_STATE}'"
      return 1
      ;;
  esac
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
