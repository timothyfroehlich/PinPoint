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

# SHA-pinned review marker, posted by mark-review.sh. The primary accepted record is a
# completed Codex Plugin CC `/codex:review --base main` — a command Tim types, since the
# plugin declares it `disable-model-invocation` and an agent cannot launch it. Legacy
# Claude markers remain readable so existing PRs do not lose their valid review history.
#
# What follows this prefix, up to the `-->`, is compared to the head SHA by STRING
# EQUALITY. Nothing else may go inside this comment — reviewer metadata lives in its own
# HTML comments for exactly that
# reason, since adding it here would fail every `reviewed` gate on every PR. (PP-9onv.)
readonly REVIEW_MARKER_PREFIX="<!-- pinpoint-review:"
readonly LEGACY_CLAUDE_MARKER_PREFIX="<!-- pinpoint-claude-review:"

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

# The full record of the review marker that decides a head's state, as one TSV line:
#
#   <state>\t<sha>\t<reviewer>\t<detail>\t<updated_at>\t<summary line>
#
# `_marker_verdict` (the gate's question) is the first two fields; merge-handoff.sh
# reports the rest, so this is the single place the pinning semantics live. Keeping one
# implementation is deliberate: a second lookup that answered "which marker counts?"
# even slightly differently would let the gate and the handoff report disagree about
# whether head was reviewed, which is the one thing neither may be wrong about.
#
# `reviewer` and `detail` name the review method. Legacy markers map to `claude-code`
# plus their former depth; incomplete metadata reads as `unrecorded`, never as a claim.
#
# Asked as "does ANY marker pin this head?", deliberately — not "does the newest one?".
# mark-review.sh keeps ONE sticky comment and rewrites it in place, so a PR
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
_marker_record() {
  local pr=$1 owner_repo=$2 head=$3
  gh api --paginate "repos/${owner_repo}/issues/${pr}/comments" \
    | jq -rs --arg prefix "$REVIEW_MARKER_PREFIX" --arg legacy "$LEGACY_CLAUDE_MARKER_PREFIX" --arg head "$head" \
        '[ .[] | flatten | .[]
           | (.body // "") as $b
           | select($b | startswith($prefix) or startswith($legacy))
           | { sha: (if $b | startswith($prefix) then ($b | ltrimstr($prefix)) else ($b | ltrimstr($legacy)) end | split("-->")[0] | gsub("^\\s+|\\s+$"; "")),
               reviewer: (if $b | startswith($prefix)
                          then ($b | [scan("<!-- pinpoint-reviewer:\\s*([a-z0-9-]+)\\s*-->")] | flatten | (.[0] // "unrecorded"))
                          else "claude-code" end),
               detail: (if $b | startswith($prefix)
                        then ($b | [scan("<!-- pinpoint-review-detail:\\s*([a-z0-9-]+)\\s*-->")] | flatten | (.[0] // "unrecorded"))
                        else ($b | [scan("<!-- pinpoint-review-depth:\\s*([a-z]+)\\s*-->")] | flatten | (.[0] // "unrecorded")) end),
               at: (.updated_at // ""),
               summary: ($b | split("\n") | last | gsub("^\\s+|\\s+$"; "")) }
         ] as $markers
         | [ $markers[] | select(.sha == $head) ] as $pinned
         | if ($pinned | length) > 0 then ($pinned | last) + { state: "marker" }
           elif ($markers | length) > 0 then ($markers | last) + { state: "stale_marker" }
           else { state: "unreviewed", sha: "", reviewer: "", detail: "", at: "", summary: "" }
           end
         | [ .state, .sha, .reviewer, .detail, .at, .summary ] | @tsv'
}

# The review markers' verdict on a given head, printed as "<state> <sha>" — the two
# fields of `_marker_record` the merge gate acts on.
_marker_verdict() {
  local record
  record=$(_marker_record "$1" "$2" "$3")
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
# Shared review state (PP-lzaw, rewritten for marker-only review in PP-4ric)
# ---------------------------------------------------------------------------------
#
# Three states. With the bot reviewer retired there is nobody to poll, no request to
# wait on, and no timer to run out — `/codex:review` runs on Tim's machine and
# leaves no GitHub trace. The only observable fact is the marker, so the question
# collapses to "does an attestation pin THIS head?":
#
#   marker        a review marker pins head's SHA — head has been reviewed
#   stale_marker  a marker exists but pins a DIFFERENT SHA — head was never reviewed
#   unreviewed    no marker on this PR at all — nobody has reviewed it
#
# "Different", not "older": the usual cause is a push on top of the reviewed commit, but
# a force-push leaves a marker pinning a commit that is not an ancestor of head at all,
# and there the distance between them is not merely large — it is undefined.
# merge-handoff.sh reports that case as unknowable rather than counting commits from an
# unrelated tree, and this gate does not care which it is: neither is a reviewed head.
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
# cannot do the first one: `/codex:review` is declared `disable-model-invocation` by the
# Codex plugin, so only Tim can trigger it. The review is a handoff and the marker is what
# the agent posts once he has run it and the findings are addressed.
_review_remedy() {
  local pr=$1
  echo "  remedy: confirm the review will see this PR's diff, ask Tim to run it, address"
  echo "          the findings, then attest the head he reviewed:"
  echo "    bash scripts/workflow/review-preflight.sh $pr"
  echo "    bash scripts/workflow/mark-review.sh $pr codex-plugin-cc base-main \"<one-line findings>\""
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
# `<!-- pinpoint-review: <head_sha> -->` in a PR conversation comment (posted by
# mark-review.sh, alongside reviewer/detail comments this
# gate ignores); the SHA pin makes it self-expiring, so a later fix changes the head SHA
# and re-arms the gate.
#
#   marker        → PASS
#   stale_marker  → FAIL   remedy: re-review the new head, re-attest
#   unreviewed    → FAIL   remedy: Tim runs /codex:review, then attest
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
