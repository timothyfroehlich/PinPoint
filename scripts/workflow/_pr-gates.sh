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

# Canonical Copilot reviewer login allowlist. Source of truth for all PinPoint workflow
# scripts. These are the logins Copilot posts REVIEWS under. The login it is REQUESTED
# under on the issue timeline is different — plain "Copilot" — so request detection
# matches a case-insensitive "copilot" prefix instead of this list (see
# _latest_copilot_request_at).
readonly COPILOT_LOGINS=("copilot-pull-request-reviewer" "copilot-pull-request-reviewer[bot]")

# How long to wait for Copilot to answer a review REQUEST before escalating: `currency`
# degrades WAIT → WARN, `reviewed` degrades WAIT → FAIL.
#
# Measured from the request, NOT from the head push (PP-lzaw). Copilot review is
# request-only on this repo since 2026-08-01 — one automatic request at PR-open and
# nothing after — so a timer keyed to the head push counts down against a review nobody
# asked for, and every un-re-requested PR lands on the `reviewed` FAIL whose documented
# remedy is the Claude marker. That makes the marker the DEFAULT path rather than the
# fallback, gutting the guarantee this gate exists to provide. A timer only makes sense
# once someone has actually asked.
readonly COPILOT_REVIEW_WAIT_THRESHOLD=600

# Copilot posts a review OBJECT even when it reviewed nothing — quota exhaustion, or
# no files it could analyze. Those carry a real submitted_at and a Copilot login, so a
# login-only filter counts them as reviews and every gate keyed on "a Copilot review
# covers head" goes green on a review that read nothing (PP-jw0s). Strictly worse than
# no review at all, because no-review has its own honest path. Match them by body and
# treat them as absent.
#
# Deliberately matched on WHOLE-PR phrasings, not the bare words "unable to review".
# Copilot's real reviews say things like "reviewed 3 out of 5 changed files" and can
# mention files they could not analyse — a looser pattern would discard a genuine
# review and push `reviewed` toward a FAIL that only --force or a marker clears,
# which trains exactly the reflex this gate exists to prevent. Precision over recall:
# an unrecognised NEW non-review wording slips through as a false green, but that is
# the status quo ante for a wording nobody has seen, whereas eating real reviews would
# be a fresh regression. Add wordings here as they are observed.
readonly COPILOT_NON_REVIEW_BODY_RE='reached their quota limit|unable to review this pull request|not able to review any files|wasn.t able to review any files'

# SHA-pinned Claude review marker, posted by mark-claude-review.sh.
readonly CLAUDE_MARKER_PREFIX="<!-- pinpoint-claude-review:"

# Parse owner/repo dynamically — avoid hardcoded slug. Memoized: the review-state
# computation asks four different endpoints and pr-dashboard.sh runs it once per open
# PR, so an unmemoized call was one wasted API round-trip per question.
_REPO_SLUG_CACHE=""
_repo_slug() {
  if [ -z "$_REPO_SLUG_CACHE" ]; then
    _REPO_SLUG_CACHE=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
  fi
  printf '%s\n' "$_REPO_SLUG_CACHE"
}

# jq array of the Copilot review-author logins, built once per process.
_copilot_logins_json() {
  printf '%s\n' "${COPILOT_LOGINS[@]}" | jq -R . | jq -s .
}

# ISO-8601 → epoch seconds. macOS ships BSD date, Linux GNU date; the gates compare
# timestamps from three different endpoints, so this branching lived inline in two
# functions and was about to live in a third.
_epoch() {
  local iso=$1
  if date -d "$iso" +%s 2>/dev/null; then
    return 0
  fi
  TZ=UTC date -jf "%Y-%m-%dT%H:%M:%SZ" "${iso%Z}Z" +%s
}

# Timestamp of the most recent Copilot review REQUEST, or empty when none exists.
#
# The reviews endpoint cannot answer this: it only reports whether a review exists, so
# "nobody asked" and "asked, still waiting" are indistinguishable there — and keeping
# those two distinct is the whole point of PP-lzaw. The issue timeline carries
# `event == "review_requested"` with a `created_at`, which is the clock the gates key to.
#
# Matched on a case-insensitive "copilot" prefix rather than COPILOT_LOGINS: a request
# names the reviewer as plain "Copilot", while the review it produces is authored by
# "copilot-pull-request-reviewer[bot]". The actor is NOT a usable discriminator — the
# repo owner is the actor for both the PR-open automatic request and an explicit
# `gh pr edit --add-reviewer`.
_latest_copilot_request_at() {
  local pr=$1 owner_repo=$2
  gh api --paginate "repos/${owner_repo}/issues/${pr}/timeline?per_page=100" \
    | jq -rs '[ .[] | flatten | .[]
                | select(.event == "review_requested")
                | select((.requested_reviewer.login // "") | ascii_downcase | startswith("copilot"))
              ] | sort_by(.created_at) | last | .created_at // empty'
}

# True when a SUBSTANTIVE Copilot review carries the head SHA.
#
# Compared by `commit_id`, not by timestamp (PP-lzaw). Copilot stamps every review with
# the commit it actually read; comparing submitted_at against the head commit's committer
# date instead reported "covers head" for a review of an earlier tree that happened to be
# submitted after a later push — observed on PR #1784, where a review of 64cfebc2 was
# submitted 3 minutes after head d7392134 was pushed. Under the old review-on-every-push
# model that mostly self-corrected; under request-only, where a review is a scarce
# deliberate act, it is a standing false PASS.
#
# ANY matching review counts, not just the newest: a review whose commit_id is head
# demonstrably read head, whatever landed after it.
#
# `jq -rs` (slurp) rather than gh's `--jq`, which runs per-page under --paginate and so
# misses reviews on page 2+ of a busy PR.
_copilot_review_covers_head() {
  local pr=$1 owner_repo=$2 head_sha=$3
  local count
  count=$(gh api --paginate "repos/${owner_repo}/pulls/${pr}/reviews" \
    | jq -rs --argjson logins "$(_copilot_logins_json)" \
             --arg skip "$COPILOT_NON_REVIEW_BODY_RE" \
             --arg head "$head_sha" \
        '[ .[] | flatten | .[]
           | select(.user.login as $l | $logins | index($l))
           | select(((.body // "") | test($skip; "i")) | not)
           | select(.commit_id == $head)
         ] | length')
  [ "${count:-0}" -gt 0 ]
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
# Shared review state (PP-lzaw)
# ---------------------------------------------------------------------------------
#
# `currency` and `reviewed` ask one question — "where does this PR stand with its
# reviewer?" — and answer it with different tokens. They used to compute it twice and
# drifted apart (reviewed learned about the Claude marker; currency did not). One
# computation, two mappings, so they cannot disagree.
#
# Six states. The point of splitting them this finely is that under request-only Copilot
# the difference between "asked, still waiting" and "nobody asked" is the difference
# between a legitimate wait and an overnight stall nobody is coming to end:
#
#   marker           SHA-pinned Claude review marker covers head
#   covered          a substantive Copilot review carries head's SHA
#   awaiting         request is newer than head, no covering review, inside the window
#   overdue          same, past the window — Copilot was asked and did not answer
#   pushed_after     head is NEWER than the newest request — you pushed after asking
#   never_requested  no Copilot review_requested event exists on this PR at all
#
# `never_requested` does not occur in practice while the repo's PR-open auto-request is
# enabled (measured 2026-08-01: it fires ~1s after PR creation on every PR). It is kept
# distinct anyway — it becomes real the moment that setting is turned off, and a gate
# that only asked "was a review ever requested" would answer yes on every PR and catch
# nothing. `pushed_after` is the state that actually bites today.
#
# Sets globals: RS_STATE RS_DETAIL RS_HEAD_SHA RS_REQUEST_AT RS_REQUEST_COVERS_HEAD
# RS_REQUEST_PENDING
# RS_DETAIL carries seconds — elapsed since the request (awaiting/overdue), or how far
# head outruns the request (pushed_after).
RS_STATE=""
RS_DETAIL=""
RS_HEAD_SHA=""
RS_REQUEST_AT=""
RS_REQUEST_COVERS_HEAD=0
RS_REQUEST_PENDING=0

_compute_review_state() {
  local pr=$1
  local owner_repo pr_data head_sha head_date request_at
  owner_repo=$(_repo_slug)

  # headRefOid and reviewRequests in ONE call. reviewRequests is only used to
  # explain a confusing `pushed_after`: the issue timeline is eventually
  # consistent and can lag a freshly-created review_requested event by a minute,
  # during which the state computes to `pushed_after` even though the agent just
  # re-requested. reviewRequests updates immediately, so a Copilot entry there
  # alongside a `pushed_after` verdict means "re-run, the timeline is catching
  # up". It is NOT treated as coverage: Copilot reviews the head as of the
  # REQUEST, not as of when it runs (measured on this PR — a request made at
  # a4a26aad produced a review stamped a4a26aad two minutes after 7d672c4 was
  # pushed), so a genuinely stale pending request still yields a stale review.
  pr_data=$(gh pr view "$pr" --json headRefOid,reviewRequests)
  head_sha=$(jq -r '.headRefOid' <<< "$pr_data")
  if [ "$(jq -r '[.reviewRequests[]? | (.login // .name // "") | ascii_downcase | select(startswith("copilot"))] | length' <<< "$pr_data")" -gt 0 ]; then
    RS_REQUEST_PENDING=1
  else
    RS_REQUEST_PENDING=0
  fi
  head_date=$(gh api "repos/${owner_repo}/commits/${head_sha}" --jq '.commit.committer.date')
  request_at=$(_latest_copilot_request_at "$pr" "$owner_repo")

  RS_HEAD_SHA=$head_sha
  RS_REQUEST_AT=$request_at
  RS_DETAIL=0
  RS_REQUEST_COVERS_HEAD=0

  local head_epoch request_epoch=0 now_epoch
  head_epoch=$(_epoch "$head_date")
  now_epoch=$(date -u +%s)
  if [ -n "$request_at" ]; then
    request_epoch=$(_epoch "$request_at")
    # THE question, in one comparison: is the newest request newer than the head
    # COMMIT? Not "was a review ever requested" — every PR answers yes to that.
    #
    # The head commit's committer date stands in for "when head arrived on the
    # branch". GitHub exposes no push timestamp for a PR head, and the two differ:
    # a commit can be authored well before it is pushed, and a cherry-pick or a
    # `git commit --date` can carry an older date still. Both endpoints agree on
    # the substitution — see the same note in pr-watch.py.
    #
    # It errs in a known direction. Committer date EARLIER than the real push makes
    # a request look like it covers a head it predates, so the gate reports
    # `awaiting` (and after the window, `overdue`) instead of `pushed_after`: it
    # still refuses to PASS, it just names the wrong reason for a while. The
    # opposite skew — a committer date in the future — would read as `pushed_after`
    # and demand a re-request that is already outstanding, which is noisy but
    # equally cannot open a merge path. Coverage itself is decided by commit_id, so
    # neither skew can make an unreviewed head PASS.
    if [ "$request_epoch" -ge "$head_epoch" ]; then
      RS_REQUEST_COVERS_HEAD=1
    fi
  fi

  # A Claude marker pinned to head answers "has a reviewer seen THIS commit?" directly.
  # It is checked first so a quota-limited or unanswered request doesn't sit out a timer
  # against a reviewer that already has a documented substitute. It is NOT silent about
  # standing in — see the note the gates print when no request covers head.
  if _claude_marker_present "$pr" "$owner_repo" "$head_sha"; then
    RS_STATE=marker
    return 0
  fi

  if _copilot_review_covers_head "$pr" "$owner_repo" "$head_sha"; then
    RS_STATE=covered
    return 0
  fi

  if [ -z "$request_at" ]; then
    RS_STATE=never_requested
    return 0
  fi

  if [ "$RS_REQUEST_COVERS_HEAD" -eq 0 ]; then
    RS_STATE=pushed_after
    RS_DETAIL=$((head_epoch - request_epoch))
    return 0
  fi

  # Only here does a timer apply, and it runs from the request — the moment someone
  # actually asked — not from the push.
  RS_DETAIL=$((now_epoch - request_epoch))
  if [ "$RS_DETAIL" -lt "$COPILOT_REVIEW_WAIT_THRESHOLD" ]; then
    RS_STATE=awaiting
  else
    RS_STATE=overdue
  fi
}

# The one command that requests (or RE-requests) a Copilot review. `--add-reviewer`
# re-requests when the reviewer is already assigned, so it is correct in both cases.
_request_review_cmd() {
  printf 'gh pr edit %s --add-reviewer "@copilot"\n' "$1"
}

# Printed whenever a Claude marker carries a head that no request covers. The marker is
# the fallback for a request Copilot did not answer; letting it stand in silently for a
# request nobody made is how it becomes the default path.
_marker_without_request_note() {
  local pr=$1
  echo "  note: no Copilot review was requested for this head — the Claude marker is"
  echo "        standing in. The marker is the fallback for a request Copilot did not"
  echo "        answer, not a substitute for asking. To ask:"
  echo "    $(_request_review_cmd "$pr")"
}

# Printed on `pushed_after` when Copilot is nonetheless a pending reviewer right now.
# Almost always means the re-request has been made and the timeline has not caught up.
_pending_request_lag_note() {
  echo "  note: Copilot IS a pending reviewer right now, so a request has probably just"
  echo "        been made and GitHub's issue timeline (which this gate reads) has not"
  echo "        caught up — it lags by up to a minute. Re-run before acting."
}

# Gate 2: where the PR stands with its reviewer. Soft by design — this gate never
# FAILs. It holds (WAIT) only while a request is genuinely outstanding; every other
# non-covering state is reported as a WARN with the remedy, because no amount of waiting
# resolves them. The hard backstop is `reviewed` (gate 4), not this one.
check_copilot_currency() {
  local pr=$1
  _compute_review_state "$pr"

  case "$RS_STATE" in
    marker)
      echo "PASS: currency: Claude review marker covers head commit"
      if [ "$RS_REQUEST_COVERS_HEAD" -eq 0 ]; then _marker_without_request_note "$pr"; fi
      return 0
      ;;
    covered)
      echo "PASS: currency: Copilot review carries head SHA ${RS_HEAD_SHA:0:7}"
      return 0
      ;;
    awaiting)
      echo "WAIT: currency: review requested ${RS_DETAIL}s ago, Copilot has not answered yet"
      return 2
      ;;
    overdue)
      echo "WARN: currency: review requested ${RS_DETAIL}s ago (>${COPILOT_REVIEW_WAIT_THRESHOLD}s), still unanswered"
      return 0
      ;;
    pushed_after)
      echo "WARN: currency: head is ${RS_DETAIL}s NEWER than the last review request — you pushed after requesting"
      echo "  re-request once you have stopped iterating:"
      echo "    $(_request_review_cmd "$pr")"
      if [ "$RS_REQUEST_PENDING" -eq 1 ]; then _pending_request_lag_note; fi
      return 0
      ;;
    never_requested)
      echo "WARN: currency: no Copilot review has ever been requested on this PR"
      echo "  request one:"
      echo "    $(_request_review_cmd "$pr")"
      return 0
      ;;
    *)
      echo "FAIL: currency: unrecognised review state '${RS_STATE}'"
      return 1
      ;;
  esac
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
# review marker. Unlike `currency` (which WARN-proceeds), this gate is the hard
# backstop: a head commit that no one reviewed cannot merge. The Claude marker is
# `<!-- pinpoint-claude-review: <head_sha> -->` in a PR conversation comment (posted by
# mark-claude-review.sh); the SHA pin makes it self-expiring — a later fix changes the
# head SHA and re-arms the gate.
#
# The merge bar is UNCHANGED by PP-lzaw: a review covering head is still REQUIRED. What
# changed is WHEN the wait is spent (from the request, not the push) and how precisely
# the non-covering states are named. Each terminal state names the ONE action that
# clears it, and only `overdue` — asked, unanswered — offers the Claude marker, because
# offering it on "you never asked" is what turns the fallback into the default path.
#
#   marker           → PASS (+ note if no request covers head)
#   covered          → PASS
#   awaiting         → WAIT   (the only state a timer legitimately applies to)
#   overdue          → FAIL   remedy: re-request, or attest with mark-claude-review.sh
#   pushed_after     → FAIL   remedy: re-request. No timer is waited out.
#   never_requested  → FAIL   remedy: request. No timer is waited out.
check_review_happened() {
  local pr=$1
  _compute_review_state "$pr"

  case "$RS_STATE" in
    marker)
      echo "PASS: reviewed: Claude review marker covers head commit"
      if [ "$RS_REQUEST_COVERS_HEAD" -eq 0 ]; then _marker_without_request_note "$pr"; fi
      return 0
      ;;
    covered)
      echo "PASS: reviewed: Copilot review carries head SHA ${RS_HEAD_SHA:0:7}"
      return 0
      ;;
    awaiting)
      echo "WAIT: reviewed: review requested ${RS_DETAIL}s ago, awaiting Copilot"
      return 2
      ;;
    overdue)
      echo "FAIL: reviewed: review requested ${RS_DETAIL}s ago and Copilot has not answered"
      echo "  note: a Copilot comment saying it could not review (quota limit, nothing to"
      echo "        analyze) does NOT count as a review — that is this gate working."
      echo "  remedy: ask again —"
      echo "    $(_request_review_cmd "$pr")"
      echo "  or, if Copilot cannot answer, review the PR yourself and attest head with:"
      echo "    bash scripts/workflow/mark-claude-review.sh $pr \"<one-line findings>\""
      return 1
      ;;
    pushed_after)
      echo "FAIL: reviewed: head is ${RS_DETAIL}s NEWER than the last review request (${RS_REQUEST_AT})"
      echo "  You pushed AFTER requesting the review, so the review that arrives (or"
      echo "  already arrived) does not cover head. Nothing re-requests automatically —"
      echo "  that is deliberate, so a 3-commit fixup does not spend 3 reviews."
      echo "  remedy: once you have stopped iterating, re-request:"
      echo "    $(_request_review_cmd "$pr")"
      if [ "$RS_REQUEST_PENDING" -eq 1 ]; then _pending_request_lag_note; fi
      return 1
      ;;
    never_requested)
      echo "FAIL: reviewed: no Copilot review has ever been requested on this PR"
      echo "  Copilot review is request-only on this repo — nothing fires on a push, on"
      echo "  the ready-for-review label, or on green CI. Nobody has asked yet."
      echo "  remedy: request one —"
      echo "    $(_request_review_cmd "$pr")"
      return 1
      ;;
    *)
      echo "FAIL: reviewed: unrecognised review state '${RS_STATE}'"
      return 1
      ;;
  esac
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
