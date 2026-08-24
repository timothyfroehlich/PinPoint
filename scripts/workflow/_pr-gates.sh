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
readonly CODEX_REVIEW_APP_SLUG="chatgpt-codex-connector"
readonly CODEX_CLEAN_REVIEW_PREFIX="Codex Review: Didn't find any major issues."
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

# The full record of the Codex GitHub review that decides a head's state, as one TSV
# line: <state> <sha> <reviewer> <detail> <submitted_at> <summary line>.
#
# The latest review from the trusted Codex App is authoritative. An approval for an
# older commit cannot cover a later push, and a later change-request review cannot
# inherit an earlier approval. GitHub's commit_id is compared directly to the head SHA;
# timestamps are only ordering metadata.
#
# The slurp is required because gh emits one JSON array per page under --paginate.
_codex_review_record() {
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
         | [ $reviews[] | select(.sha == $head) ] as $head_reviews
         | if ($reviews | length) == 0 then
             { state: "unreviewed", sha: "", reviewer: "", detail: "", at: "", summary: "" }
           else
             (if ($head_reviews | length) > 0 then $head_reviews[-1] else $reviews[-1] end) as $latest
             | if $latest.detail == "APPROVED" and $latest.sha == $head then
                 $latest + { state: "approval" }
               elif $latest.detail == "APPROVED" then
                 $latest + { state: "stale_approval" }
               elif $latest.sha == $head then
                 $latest + { state: "reviewed" }
               else
                 $latest + { state: "not_approved" }
               end
           end
         | [ .state, .sha, .reviewer, .detail, .at, .summary ] | @tsv'
}

# Issue comments carry two distinct review records: the connector's clean automatic
# result and the independent manual attestation. The clean result is trusted only when
# the exact bot posted it through the exact GitHub App, used the known no-findings
# prefix, and named a 10- or 40-character prefix of the current head SHA.
_comment_review_record() {
  local pr=$1 owner_repo=$2 head=$3
  gh api --paginate "repos/${owner_repo}/issues/${pr}/comments" \
    | jq -rs --arg bot "$CODEX_REVIEW_BOT" --arg app "$CODEX_REVIEW_APP_SLUG" \
        --arg clean_prefix "$CODEX_CLEAN_REVIEW_PREFIX" --arg prefix "$REVIEW_MARKER_PREFIX" \
        --arg legacy "$LEGACY_CLAUDE_MARKER_PREFIX" --arg head "$head" \
        '[ .[] | flatten | .[] ] as $comments
         | ([ $comments[]
           | (.body // "") as $body
           | select(.user.login? == $bot and .performed_via_github_app.slug? == $app)
           | { sha: ($body | [scan("\\*\\*Reviewed commit:\\*\\* `([0-9a-f]{10}|[0-9a-f]{40})`")] | flatten | (.[0] // "")),
               reviewer: (.user.login // ""),
               detail: "NO_FINDINGS",
               at: (.updated_at // .created_at // ""),
               summary: (($body | split("\n")[0]) // "") }
           | select(.summary | startswith($clean_prefix))
           | select((.sha | length) == 10 or (.sha | length) == 40)
         ] | sort_by(.at)) as $clean
         | ([ $comments[]
           | (.body // "") as $body
           | select($body | startswith($prefix) or startswith($legacy))
           | { sha: (if $body | startswith($prefix) then ($body | ltrimstr($prefix)) else ($body | ltrimstr($legacy)) end | split("-->")[0] | gsub("^\\s+|\\s+$"; "")),
               reviewer: (if $body | startswith($prefix)
                          then ($body | [scan("<!-- pinpoint-reviewer:\\s*([a-z0-9-]+)\\s*-->")] | flatten | (.[0] // "unrecorded"))
                          else "claude-code" end),
               detail: (if $body | startswith($prefix)
                        then ($body | [scan("<!-- pinpoint-review-detail:\\s*([a-z0-9-]+)\\s*-->")] | flatten | (.[0] // "unrecorded"))
                        else ($body | [scan("<!-- pinpoint-review-depth:\\s*([a-z]+)\\s*-->")] | flatten | (.[0] // "unrecorded")) end),
               at: (.updated_at // ""),
               summary: (($body | split("\n") | last) // "") }
         ] | sort_by(.at)) as $markers
         | [ $markers[] | select(.sha == $head) ] as $pinned
         | [ $clean[] | .sha as $sha | select($head | startswith($sha)) ] as $clean_pinned
         | if ($pinned | length) > 0 then ($pinned | last) + { state: "marker" }
           elif ($clean_pinned | length) > 0 then ($clean_pinned | last) + { state: "clean_comment" }
           elif ($markers | length) > 0 and ($clean | length) > 0 then
             if $markers[-1].at > $clean[-1].at
             then $markers[-1] + { state: "stale_marker" }
             else $clean[-1] + { state: "stale_clean_comment" }
             end
           elif ($markers | length) > 0 then $markers[-1] + { state: "stale_marker" }
           elif ($clean | length) > 0 then $clean[-1] + { state: "stale_clean_comment" }
           else { state: "unreviewed", sha: "", reviewer: "", detail: "", at: "", summary: "" }
           end
         | [ .state, .sha, .reviewer, .detail, .at, .summary ] | @tsv'
}

# A manual marker is an independent valid record. Native reviews and clean connector
# comments are two representations of the automatic Codex path; when they disagree,
# the newer automatic record wins so a later finding cannot inherit an earlier clean.
_review_record() {
  local head=$3 codex comment codex_state comment_state codex_sha codex_at comment_at
  codex=$(_codex_review_record "$@")
  codex_state=$(cut -f1 <<< "$codex")
  # A current native approval already passes the gate. Do not spend a second
  # paginated GitHub request looking up a marker that cannot change that result.
  if [[ "$codex_state" == "approval" ]]; then
    printf '%s\n' "$codex"
    return
  fi

  comment=$(_comment_review_record "$@")
  comment_state=$(cut -f1 <<< "$comment")
  if [[ "$comment_state" == "marker" ]]; then
    printf '%s\n' "$comment"
  elif [[ "$comment_state" == "clean_comment" ]]; then
    codex_sha=$(cut -f2 <<< "$codex")
    codex_at=$(cut -f5 <<< "$codex")
    comment_at=$(cut -f5 <<< "$comment")
    if [[ "$codex_state" == "unreviewed" || "$codex_sha" != "$head" || "$comment_at" > "$codex_at" ]]; then
      printf '%s\n' "$comment"
    else
      printf '%s\n' "$codex"
    fi
  elif [[ "$codex_state" == "unreviewed" ]]; then
    printf '%s\n' "$comment"
  elif [[ "$comment_state" == "unreviewed" ]]; then
    printf '%s\n' "$codex"
  else
    # Neither path covers head. Report the newest record so merge-handoff can
    # show the real diff since review instead of an older, unrelated failure.
    codex_at=$(cut -f5 <<< "$codex")
    comment_at=$(cut -f5 <<< "$comment")
    if [[ "$comment_at" > "$codex_at" ]]; then
      printf '%s\n' "$comment"
    else
      printf '%s\n' "$codex"
    fi
  fi
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
# Shared review state — a trusted automatic Codex result or manual attestation pinned
# to the PR head.
# ---------------------------------------------------------------------------------
#
#   approval        Codex approved the current head SHA
#   clean_comment   Codex reported no major issues for the current head SHA
#   reviewed        Codex reviewed the current head; the thread gate owns adjudication
#   marker          A manual review marker pins the current head SHA
#   stale_approval  Codex approved a different SHA — the current head was not reviewed
#   stale_clean_comment  A clean Codex comment names a different SHA
#   stale_marker    A manual marker names a different SHA
#   not_approved    Codex's most-recent review covers a different SHA and is not an approval
#   unreviewed      Neither review path has a record
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
  echo "  remedy: await a clean automatic Codex result on this head of PR #${pr}. Use @codex"
  echo "          review only when Tim explicitly requests it; use review-preflight +"
  echo "          mark-review only after Tim explicitly runs a local review."
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

# Gate 3: a trusted clean Codex result or manual review marker must cover the exact head.
#
#   approval        → PASS
#   clean_comment   → PASS
#   reviewed        → PASS (the separate thread gate requires every finding adjudicated)
#   marker          → PASS
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
    clean_comment)
      echo "PASS: reviewed: Codex found no major issues on head SHA ${RS_HEAD_SHA:0:7}"
      return 0
      ;;
    reviewed)
      echo "PASS: reviewed: Codex reviewed head SHA ${RS_HEAD_SHA:0:7}; thread gate owns findings"
      return 0
      ;;
    marker)
      echo "PASS: reviewed: review marker pins head SHA ${RS_HEAD_SHA:0:7}"
      return 0
      ;;
    stale_approval)
      echo "FAIL: reviewed: Codex approved ${RS_REVIEW_SHA:0:7}, but head is ${RS_HEAD_SHA:0:7}"
      echo "  You pushed after that approval, so what is about to merge was never read."
      _review_remedy "$pr"
      return 1
      ;;
    stale_clean_comment)
      echo "FAIL: reviewed: Codex clean result covers ${RS_REVIEW_SHA:0:7}, but head is ${RS_HEAD_SHA:0:7}"
      _review_remedy "$pr"
      return 1
      ;;
    not_approved)
      echo "FAIL: reviewed: Codex last reviewed ${RS_REVIEW_SHA:0:7} without approval"
      _review_remedy "$pr"
      return 1
      ;;
    stale_marker)
      echo "FAIL: reviewed: the review marker pins ${RS_REVIEW_SHA:0:7}, but head is ${RS_HEAD_SHA:0:7}"
      _review_remedy "$pr"
      return 1
      ;;
    unreviewed)
      echo "FAIL: reviewed: no clean Codex result on PR #${pr} — head ${RS_HEAD_SHA:0:7} is unreviewed"
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
