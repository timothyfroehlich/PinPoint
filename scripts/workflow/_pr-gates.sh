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

# SHA-pinned review marker, posted by mark-claude-review.sh. It attests that Tim ran
# `/code-review` over the diff, which an agent cannot do for itself: `/code-review` is a
# harness built-in only he can trigger. Copilot review was retired on 2026-08-02
# (PP-4ric) — its free tier was too small to review PinPoint's PRs — so no bot reviews
# this repo, and the marker was for a while the only thing that satisfied the `reviewed`
# gate. Since PP-97tt the inline comments `/code-review --comment` posts count too; the
# marker remains the path for a review that found nothing to post.
#
# What follows this prefix, up to the `-->`, is compared to the head SHA by STRING
# EQUALITY. Nothing else may go inside this comment — the review depth mark-claude-review.sh
# records lives in its own `<!-- pinpoint-review-depth: … -->` comment for exactly that
# reason, since adding it here would fail every `reviewed` gate on every PR. (PP-9onv.)
readonly CLAUDE_MARKER_PREFIX="<!-- pinpoint-claude-review:"

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

# Two kinds of evidence can show that a head was reviewed, and this is the one place
# that knows how to weigh them:
#
#   marker    the sticky `<!-- pinpoint-claude-review: <sha> -->` comment that
#             mark-claude-review.sh posts. Carries a recorded depth and a findings
#             summary, so it is the richer record and wins a tie.
#   comments  inline review comments Tim's `/code-review <depth> --comment <PR>` posted
#             on the PR. They pin a SHA of their own, so a review that found something
#             attests itself — no second step, nothing for an agent to forget. A review
#             that found NOTHING posts nothing, which is why the marker still exists.
#             (PP-97tt.)
#
# Pinned on `original_commit_id`, never `commit_id`. GitHub re-anchors `commit_id` as a
# PR advances so a still-applicable comment keeps pointing at a live line; a gate reading
# that field would find every review comment pinning head forever, and report a commit
# nobody read as reviewed. `original_commit_id` is immutable and is literally the commit
# the reviewer was looking at, which is the question being asked.
#
# REPLIES ARE EXCLUDED (`in_reply_to_id == null`). A reply is created at whatever head is
# current, so an agent that pushes a fix and then answers the thread it just addressed
# would re-green this gate on a commit no reviewer has seen — the exact failure the SHA
# pin exists to prevent. Only a top-level comment counts as someone reading the diff.
#
# The full record, as one TSV line:
#
#   <state>\t<sha>\t<depth>\t<updated_at>\t<summary line>
#
# `_review_verdict` (the gate's question) is the first two fields; merge-handoff.sh
# reports the rest, so this is the single place the pinning semantics live. Keeping one
# implementation is deliberate: a second lookup that answered "which evidence counts?"
# even slightly differently would let the gate and the handoff report disagree about
# whether head was reviewed, which is the one thing neither may be wrong about.
#
# `depth` is the `/code-review` level recorded by mark-claude-review.sh in a second HTML
# comment. Markers posted before PP-9onv have no such comment, and inline comments carry
# no depth at all; both read as `unrecorded` — absence of the field, not a claim that no
# review ran.
#
# Asked as "does ANY evidence pin this head?", deliberately — not "does the newest one?".
# mark-claude-review.sh keeps ONE sticky comment and rewrites it in place, so a PR
# normally carries a single marker, but nothing enforces that: a second session, or a
# hand-posted comment, can leave two. If the reader picks one comment and the writer
# picks a different one, re-attesting rewrites a marker the gate never reads, and a
# genuinely reviewed head reports stale_marker forever with `--force` as the only exit.
# Membership has no such failure mode: evidence pinning head means someone read head,
# whatever order the comments landed in.
#
# When nothing pins head, the newest evidence of a kind is the one reported — it is the
# most recent review the PR actually got, and naming its SHA is what lets the gate say
# "you pushed past the review" instead of "nobody reviewed this".
#
# Markers outrank comments at every step, pinned and stale alike, and pr-watch.py's mirror
# resolves it the same way. A single fixed precedence rather than "whichever is newer":
# the two clocks are not comparable (a marker's `updated_at` moves when the sticky comment
# is rewritten, a comment's when someone edits a finding), so ordering by timestamp would
# make the answer depend on which unrelated edit happened last.
#
# `jq -s` (slurp) rather than gh's `--jq`, which runs per-page under --paginate and so
# misses a marker sitting on page 2+ of a busy PR.
_review_record() {
  local pr=$1 owner_repo=$2 head=$3
  local markers comments

  markers=$(gh api --paginate "repos/${owner_repo}/issues/${pr}/comments" \
    | jq -s --arg prefix "$CLAUDE_MARKER_PREFIX" \
        '[ .[] | flatten | .[]
           | (.body // "") as $b
           | select($b | startswith($prefix))
           | { kind: "marker",
               sha: ($b | ltrimstr($prefix) | split("-->")[0] | gsub("^\\s+|\\s+$"; "")),
               depth: ($b | [scan("<!-- pinpoint-review-depth:\\s*([a-z]+)\\s*-->")]
                          | flatten | (.[0] // "unrecorded")),
               at: (.updated_at // ""),
               summary: ($b | split("\n") | last | gsub("^\\s+|\\s+$"; "")) } ]')

  # Grouped by the SHA reviewed, so a review that raised six findings is ONE piece of
  # evidence rather than six — the summary then reports the count, which is the fact a
  # reader of the handoff report wants.
  comments=$(gh api --paginate "repos/${owner_repo}/pulls/${pr}/comments" \
    | jq -s '[ .[] | flatten | .[]
               | select(.in_reply_to_id == null)
               | select((.original_commit_id // "") != "")
               | { kind: "comments", sha: .original_commit_id, depth: "unrecorded",
                   at: (.updated_at // .created_at // "") } ]
             | group_by(.sha)
             | map(max_by(.at)
                   + { summary: "\(length) inline review comment(s) posted on the PR" })
             | sort_by(.at)')

  jq -rn --argjson markers "$markers" --argjson comments "$comments" --arg head "$head" \
    '[ $markers[] | select(.sha == $head) ] as $pinned_markers
     | [ $comments[] | select(.sha == $head) ] as $pinned_comments
     | if ($pinned_markers | length) > 0 then ($pinned_markers | last) + { state: "marker" }
       elif ($pinned_comments | length) > 0 then ($pinned_comments | last) + { state: "commented" }
       elif ($markers | length) > 0 then ($markers | last) + { state: "stale_marker" }
       elif ($comments | length) > 0 then ($comments | last) + { state: "stale_comments" }
       else { state: "unreviewed", sha: "", depth: "", at: "", summary: "" }
       end
     | [ .state, .sha, .depth, .at, .summary ] | @tsv'
}

# The review evidence's verdict on a given head, printed as "<state> <sha>" — the two
# fields of `_review_record` the merge gate acts on.
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
# Shared review state (PP-lzaw, rewritten for marker-only review in PP-4ric)
# ---------------------------------------------------------------------------------
#
# Five states. With the bot reviewer retired there is nobody to poll, no request to wait
# on, and no timer to run out, so the question collapses to "does review evidence pin
# THIS head?" — and since PP-97tt there are two kinds of evidence (see `_review_record`):
#
#   marker          a review marker pins head's SHA — head has been reviewed
#   commented       inline review comments pin head's SHA — head has been reviewed
#   stale_marker    a marker exists but pins a DIFFERENT SHA — head was never reviewed
#   stale_comments  review comments exist but pin a DIFFERENT SHA — likewise
#   unreviewed      no evidence on this PR at all — nobody has reviewed it
#
# The two stale states are kept apart because their remedies differ: a stale marker is
# cleared by re-attesting (the agent's own command), a stale comment set only by getting
# the new head reviewed. Collapsing them would print the wrong next step half the time.
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

# The remedy every un-reviewed state prints. The agent cannot do the first step:
# `/code-review` is a Claude Code harness built-in that only Tim can trigger, so the
# review is a handoff — and the command below is the one to hand him VERBATIM.
#
# `--comment` is what makes his findings land on the PR instead of only in his terminal.
# They arrive as review threads, which does two things: the `threads` gate then refuses
# to merge until each finding is fixed or declined-and-resolved, and the comments pin
# head themselves, so this gate clears without a second step. `ultra` is excluded from
# the depth list on purpose — the cloud path honours `--fix` but has no comment-posting
# counterpart, so `--comment` there is silently a no-op.
#
# The marker stays, and is named second, because a review that finds NOTHING posts no
# comments: the case with the least to fix is the one with no evidence, and it is the
# agent's job to record it. (PP-97tt.)
_review_remedy() {
  local pr=$1
  echo "  remedy: ask Tim to run this on the branch, and paste it to him verbatim —"
  echo "          the PR number and --comment are what post the findings to the PR:"
  echo "    /code-review <depth> --comment $pr"
  echo "          (<depth>: low|medium|high|xhigh|max — ultra does not post comments)"
  echo "          Address every thread it opens. If it found nothing, there is nothing"
  echo "          to post, so attest the head he read instead:"
  echo "    bash scripts/workflow/mark-claude-review.sh $pr <depth> \"<one-line findings>\""
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
# an answer already on its way. Either kind of evidence clears it (see `_review_record`):
# the `<!-- pinpoint-claude-review: <head_sha> -->` marker mark-claude-review.sh posts,
# or inline review comments `/code-review --comment` left on the head commit. Both pin a
# SHA, which makes them self-expiring: a later fix changes the head SHA and re-arms the
# gate.
#
#   marker          → PASS
#   commented       → PASS
#   stale_marker    → FAIL   remedy: re-review the new head, re-attest
#   stale_comments  → FAIL   remedy: re-review the new head
#   unreviewed      → FAIL   remedy: Tim runs /code-review --comment, or the agent attests
check_review_happened() {
  local pr=$1
  _compute_review_state "$pr"

  case "$RS_STATE" in
    marker)
      echo "PASS: reviewed: review marker pins head SHA ${RS_HEAD_SHA:0:7}"
      return 0
      ;;
    commented)
      echo "PASS: reviewed: inline review comments pin head SHA ${RS_HEAD_SHA:0:7}"
      return 0
      ;;
    stale_marker)
      echo "FAIL: reviewed: the review marker pins ${RS_REVIEW_SHA:0:7}, but head is ${RS_HEAD_SHA:0:7}"
      echo "  You pushed AFTER the review, so what is about to merge was never read."
      echo "  Nothing re-attests automatically — that is deliberate, so a 3-commit"
      echo "  fixup cannot inherit the review of the commit before it."
      _review_remedy "$pr"
      return 1
      ;;
    stale_comments)
      echo "FAIL: reviewed: the review comments pin ${RS_REVIEW_SHA:0:7}, but head is ${RS_HEAD_SHA:0:7}"
      echo "  You pushed AFTER the review, so what is about to merge was never read."
      echo "  Resolving those threads does not re-attest — a reply is created at whatever"
      echo "  head is current, so it is deliberately not counted as evidence."
      _review_remedy "$pr"
      return 1
      ;;
    unreviewed)
      echo "FAIL: reviewed: no review marker or review comments on this PR — head ${RS_HEAD_SHA:0:7} is unreviewed"
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
