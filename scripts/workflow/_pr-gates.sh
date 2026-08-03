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

# SHA-pinned review markers. One of these must pin the head commit for the `reviewed`
# gate to pass; the SHA pin makes them self-expiring, so a later push re-arms the gate.
#
# Two markers, two different attestations — deliberately equal in the gate's eyes:
#
#   pinpoint-claude-review  posted by mark-claude-review.sh. Attests that Tim ran
#                           `/code-review` over the diff, which an agent cannot do for
#                           itself (it is a harness built-in only he can trigger).
#   pinpoint-agy-review     posted by agy_review.py. Attests that an Antigravity review
#                           was posted AND that it demonstrably read the diff it was
#                           given — that script refuses to write this marker unless the
#                           model echoed back facts about the diff that only a run which
#                           actually read it could produce. agy confabulates a plausible
#                           review when a read fails, so the proof check is what makes
#                           the marker mean anything. (PP-c6xz.)
#
# Copilot review was retired on 2026-08-02 (PP-4ric) — its free tier was too small to
# review PinPoint's PRs — and no bot reviews this repo unprompted.
readonly CLAUDE_MARKER_PREFIX="<!-- pinpoint-claude-review:"
readonly AGY_MARKER_PREFIX="<!-- pinpoint-agy-review:"

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

# The review markers' verdict on a given head, printed as "<state> <sha>".
#
# Asked as "does ANY marker pin this head?", deliberately — not "does the newest one?".
# mark-claude-review.sh keeps ONE sticky comment and rewrites it in place, so a PR
# normally carries a single marker, but nothing enforces that: a second session, or a
# hand-posted comment, can leave two. If the reader picks one comment and the writer
# picks a different one, re-attesting rewrites a marker the gate never reads, and a
# genuinely reviewed head reports stale_marker forever with `--force` as the only exit.
# Membership has no such failure mode: a marker pinning head means someone attested
# head, whatever order the comments landed in.
#
# When nothing pins head, the newest marker is the one reported — it is the most recent
# review the PR actually got, and naming its SHA is what lets the gate say "you pushed
# past the review" instead of "nobody reviewed this".
#
# `jq -rs` (slurp) rather than gh's `--jq`, which runs per-page under --paginate and so
# misses a marker sitting on page 2+ of a busy PR.
_marker_verdict() {
  local pr=$1 owner_repo=$2 head=$3
  local prefixes
  prefixes=$(jq -nc --arg a "$CLAUDE_MARKER_PREFIX" --arg b "$AGY_MARKER_PREFIX" '[$a, $b]')
  gh api --paginate "repos/${owner_repo}/issues/${pr}/comments" \
    | jq -rs --argjson prefixes "$prefixes" --arg head "$head" \
        '[ .[] | flatten | .[] | (.body // "") as $body
           | $prefixes[] as $prefix
           | select($body | startswith($prefix))
           | $body | ltrimstr($prefix) | split("-->")[0] | gsub("^\\s+|\\s+$"; "")
         ] as $pinned
         | if ($pinned | index($head)) then "marker \($head)"
           elif ($pinned | length) > 0 then "stale_marker \($pinned | last)"
           else "unreviewed "
           end'
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
# Shared review state (PP-lzaw, rewritten for marker-only review in PP-4ric)
# ---------------------------------------------------------------------------------
#
# Three states. With the bot reviewer retired there is nobody to poll, no request to
# wait on, and no timer to run out — Tim's `/code-review` runs on his machine and
# leaves no GitHub trace. The only observable fact is the marker, so the question
# collapses to "does an attestation pin THIS head?":
#
#   marker        a review marker pins head's SHA — head has been reviewed
#   stale_marker  a marker exists but pins an OLDER SHA — you pushed past the review
#   unreviewed    no marker on this PR at all — nobody has reviewed it
#
# `stale_marker` is the state worth keeping distinct. It is the successor to the old
# `pushed_after`, and the same trap: the PR visibly HAS a review, so the reflex is to
# read the gate as flaky rather than as "the thing you pushed was never looked at".
# Nothing re-attests automatically, and that is deliberate — a 3-commit fixup should
# not silently inherit the review of the commit before it.
#
# All six of the old states existed to separate "asked and waiting" from "nobody
# asked", which only meant something while a bot answered requests on its own clock.
# The wait threshold, the request timeline, and the quota-limited non-review body
# matching went with them (PP-lzaw, PP-jw0s — resolved by deletion, not by regression).
#
# Sets globals: RS_STATE RS_HEAD_SHA RS_MARKER_SHA
RS_STATE=""
RS_HEAD_SHA=""
RS_MARKER_SHA=""

_compute_review_state() {
  local pr=$1
  local owner_repo head_sha verdict
  owner_repo=$(_repo_slug)

  head_sha=$(gh pr view "$pr" --json headRefOid --jq .headRefOid)
  verdict=$(_marker_verdict "$pr" "$owner_repo" "$head_sha")

  RS_HEAD_SHA=$head_sha
  RS_STATE=${verdict%% *}
  RS_MARKER_SHA=${verdict#* }
}

# The remedy every un-reviewed state prints. Two steps, in order, because the agent
# cannot do the first one: `/code-review` is a Claude Code harness built-in that only
# Tim can trigger, so the review is a handoff and the marker is what the agent posts
# once he has run it and the findings are addressed.
_review_remedy() {
  local pr=$1
  echo "  remedy: ask Tim to run /code-review on this branch, address the findings,"
  echo "          then attest the head he reviewed:"
  echo "    bash scripts/workflow/mark-claude-review.sh $pr \"<one-line findings>\""
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

# Gate 3: head commit has been reviewed. The hard backstop — a head nobody reviewed
# cannot merge, and nothing here WAITs, because with no bot in the loop there is never
# an answer already on its way. The marker is
# `<!-- pinpoint-claude-review: <head_sha> -->` in a PR conversation comment (posted by
# mark-claude-review.sh); the SHA pin makes it self-expiring, so a later fix changes the
# head SHA and re-arms the gate.
#
#   marker        → PASS
#   stale_marker  → FAIL   remedy: re-review the new head, re-attest
#   unreviewed    → FAIL   remedy: Tim runs /code-review, then attest
check_review_happened() {
  local pr=$1
  _compute_review_state "$pr"

  case "$RS_STATE" in
    marker)
      echo "PASS: reviewed: review marker pins head SHA ${RS_HEAD_SHA:0:7}"
      return 0
      ;;
    stale_marker)
      echo "FAIL: reviewed: the review marker pins ${RS_MARKER_SHA:0:7}, but head is ${RS_HEAD_SHA:0:7}"
      echo "  You pushed AFTER the review, so what is about to merge was never read."
      echo "  Nothing re-attests automatically — that is deliberate, so a 3-commit"
      echo "  fixup cannot inherit the review of the commit before it."
      _review_remedy "$pr"
      return 1
      ;;
    unreviewed)
      echo "FAIL: reviewed: no review marker on this PR — head ${RS_HEAD_SHA:0:7} is unreviewed"
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
