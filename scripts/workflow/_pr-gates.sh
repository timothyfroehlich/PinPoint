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
# CodeRabbit is a second trusted native reviewer, requested manually and only when Tim
# asks for it on a large PR (PP-w6u1). Its exact-head APPROVED review is sufficient
# coverage on its own. Nothing else it posts changes the Codex-derived state: a
# CodeRabbit finding review is adjudicated through the thread gate like any other
# thread, and its absence is never a failure.
readonly CODERABBIT_REVIEW_BOT="coderabbitai[bot]"
readonly GITHUB_ACTIONS_BOT="github-actions[bot]"
readonly GITHUB_ACTIONS_APP_SLUG="github-actions"
readonly CODEX_REACTION_WITNESS_PREFIX="<!-- pinpoint-codex-reaction-witness:"
readonly REVIEW_MARKER_PREFIX="<!-- pinpoint-review:"
readonly LEGACY_CLAUDE_MARKER_PREFIX="<!-- pinpoint-claude-review:"

# Parse owner/repo dynamically — avoid hardcoded slug. Memoized: several gates ask for
# it and pr-dashboard.sh runs them once per open PR, so an unmemoized call was one
# wasted API round-trip per question.
_REPO_SLUG_CACHE=""
_repo_slug() {
  if [ -z "$_REPO_SLUG_CACHE" ]; then
    _REPO_SLUG_CACHE=$(gh repo view --json nameWithOwner --jq .nameWithOwner) || return 1
  fi
  printf '%s\n' "$_REPO_SLUG_CACHE"
}


# ---------------------------------------------------------------------------------
# Review evidence — every record on the PR that could count as review coverage, as
# one JSON document. Collecting is separate from deciding: the three checkers below
# each read this document and answer for their own reviewer only.
# ---------------------------------------------------------------------------------
#
# Fields per record: sha, reviewer, detail, at, summary. `sha` is "" when GitHub
# returned a null commit_id, never absent, so every consumer can compare it.
#
# Lists (each sorted by `at`):
#   coderabbit      native reviews from the exact CodeRabbit App account
#   codex_native    native reviews from the exact Codex App account
#   codex_clean     Codex's "no major issues" issue comment, SHA-pinned by its
#                   "Reviewed commit" line (10- or 40-char)
#   codex_witness   GitHub Actions witness of Codex's +1 on the SHA-tagged request,
#                   SHA-pinned by the hidden marker
#   codex_requests  the owner's manual `@codex review` request, SHA-pinned by its marker
#   markers         local-review attestations posted by the repository owner (the
#                   repo is public; anyone else's marker text is not evidence):
#                   mark-review.sh markers, legacy Claude markers, and two-axis review
#                   comments (whose SHA is explicit in the preamble or else the newest
#                   commit at posting time)
_review_evidence() {
  local pr=$1 owner_repo=$2 head=$3
  local raw reviews_json comments_json commits_json="[]"
  # Fail closed: a failed fetch must not read as "no reviews" / "no comments".
  raw=$(gh api --paginate "repos/${owner_repo}/pulls/${pr}/reviews") || return 1
  reviews_json=$(jq -s '[ .[] | flatten | .[] ]' <<< "$raw")
  raw=$(gh api --paginate "repos/${owner_repo}/issues/${pr}/comments") || return 1
  comments_json=$(jq -s '[ .[] | flatten | .[] ]' <<< "$raw")

  # A two-axis review comment with no explicit SHA is dated to a commit. Only fetch
  # the commit list when such a comment exists; it is one more paginated request.
  if jq -e --arg owner "${owner_repo%%/*}" '
      any(.[];
        (.user.login? == $owner) and
        ((.body // "") as $b |
         ($b | test("(^|\\n)##\\s+(?:Two-axis\\s+code\\s+review|Code\\s+review)\\b"; "i")) and
         ($b | test("(^|\\n)##\\s+Standards\\b")) and
         ($b | test("(^|\\n)##\\s+Spec\\b")) and
         (($b | split("\n## Standards")[0] | [scan("(?:\\.{2,3}|(?:^|\\s)(?:head|commit)\\s+`?)([0-9a-f]{7,40})`?")] | flatten | length) == 0)
        )
      )' <<< "$comments_json" >/dev/null 2>&1; then
    commits_json=$(gh pr view "$pr" --json commits --jq .commits) || return 1
  fi

  jq -n --arg head "$head" \
      --arg codex_bot "$CODEX_REVIEW_BOT" --arg codex_app "$CODEX_REVIEW_APP_SLUG" \
      --arg coderabbit_bot "$CODERABBIT_REVIEW_BOT" \
      --arg actions_bot "$GITHUB_ACTIONS_BOT" --arg actions_app "$GITHUB_ACTIONS_APP_SLUG" \
      --arg witness_prefix "$CODEX_REACTION_WITNESS_PREFIX" \
      --arg clean_prefix "$CODEX_CLEAN_REVIEW_PREFIX" --arg prefix "$REVIEW_MARKER_PREFIX" \
      --arg legacy "$LEGACY_CLAUDE_MARKER_PREFIX" --arg owner "${owner_repo%%/*}" \
      --argjson reviews "$reviews_json" --argjson comments "$comments_json" \
      --argjson commits "$commits_json" '
    def native($bot):
      [ $reviews[]
        | select(.user.login? == $bot)
        | { sha: (.commit_id // ""),
            reviewer: (.user.login // ""),
            detail: (.state // "UNKNOWN"),
            at: (.submitted_at // ""),
            summary: (((.body? // "") | tostring | split("\n")[0] // "") | gsub("^\\s+|\\s+$"; "")) }
      ] | sort_by(.at);
    {
      head: $head,
      coderabbit: native($coderabbit_bot),
      codex_native: native($codex_bot),
      codex_clean: ([ $comments[]
        | (.body // "") as $body
        | select(.user.login? == $codex_bot and .performed_via_github_app.slug? == $codex_app)
        | { sha: ($body | [scan("\\*\\*Reviewed commit:\\*\\* `([0-9a-f]{10}|[0-9a-f]{40})`")] | flatten | (.[0] // "")),
            reviewer: (.user.login // ""),
            detail: "NO_FINDINGS",
            at: (.updated_at // .created_at // ""),
            summary: (($body | split("\n")[0]) // "") }
        | select(.summary | startswith($clean_prefix))
        | select((.sha | length) == 10 or (.sha | length) == 40)
      ] | sort_by(.at)),
      codex_witness: ([ $comments[]
        | (.body // "") as $body
        | select(.user.login? == $actions_bot
                 and .performed_via_github_app.slug? == $actions_app
                 and ($body | startswith($witness_prefix)))
        | { sha: ($body | [scan("^<!-- pinpoint-codex-reaction-witness: ([0-9a-f]{40}) -->")] | flatten | (.[0] // "")),
            reviewer: (.user.login // ""),
            detail: "REACTION_WITNESS",
            at: (.updated_at // .created_at // ""),
            summary: "Codex clean reaction witnessed by GitHub Actions" }
        | select((.sha | length) == 40)
      ] | sort_by(.at)),
      codex_requests: ([ $comments[]
        | (.body // "") as $body
        | select(.user.login? == $owner)
        | { sha: ($body | [scan("^@codex review\\n<!-- pinpoint-codex-review-head: ([0-9a-f]{40}) -->$")] | flatten | (.[0] // "")),
            reviewer: (.user.login // ""),
            detail: "MANUAL_REVIEW_REQUESTED",
            at: (.created_at // ""),
            summary: "Manual Codex review requested" }
        | select((.sha | length) == 40)
      ] | sort_by(.at)),
      markers: ([ $comments[]
        | (.body // "") as $body
        | (.updated_at // .created_at // "") as $at
        | if (.user.login? == $owner and ($body | startswith($prefix) or startswith($legacy))) then
            { sha: (if $body | startswith($prefix) then ($body | ltrimstr($prefix)) else ($body | ltrimstr($legacy)) end | split("-->")[0] | gsub("^\\s+|\\s+$"; "")),
              reviewer: (if $body | startswith($prefix)
                         then ($body | [scan("<!-- pinpoint-reviewer:\\s*([a-z0-9-]+)\\s*-->")] | flatten | (.[0] // "unrecorded"))
                         else "claude-code" end),
              detail: (if $body | startswith($prefix)
                       then ($body | [scan("<!-- pinpoint-review-detail:\\s*([a-z0-9-]+)\\s*-->")] | flatten | (.[0] // "unrecorded"))
                       else ($body | [scan("<!-- pinpoint-review-depth:\\s*([a-z]+)\\s*-->")] | flatten | (.[0] // "unrecorded")) end),
              at: $at,
              summary: (($body | split("\n") | last) // "") }
          elif (.user.login? == $owner
                and ($body | test("(^|\\n)##\\s+(?:Two-axis\\s+code\\s+review|Code\\s+review)\\b"; "i"))
                and ($body | test("(^|\\n)##\\s+Standards\\b"))
                and ($body | test("(^|\\n)##\\s+Spec\\b"))) then
            ($body | split("\n## Standards")[0] | [scan("(?:\\.{2,3}|(?:^|\\s)(?:head|commit)\\s+`?)([0-9a-f]{7,40})`?")] | flatten | (.[-1] // "")) as $explicit_sha
            | (if $explicit_sha != "" then
                 ($commits | map(select(.oid | startswith($explicit_sha))) | (.[0].oid // $explicit_sha))
               else
                 ($commits | map(select((.committedDate // "") <= $at)) | (last.oid // ""))
               end) as $resolved_sha
            | { sha: $resolved_sha,
                reviewer: (if ($body | test("—\\s*Antigravity|antigravity-code"; "i")) then "antigravity" else "claude-code" end),
                detail: "two-axis",
                at: $at,
                summary: (($body | [scan("(?m)^\\*\\*Summary[^\n]*")] | flatten | (.[0] // ($body | split("\n")[0]))) // "") }
          else empty end
        | select((.sha | length) >= 7)
      ] | sort_by(.at))
    }'
}

# ---------------------------------------------------------------------------------
# Three checkers. Each reads the evidence document and answers for one reviewer:
#
#   verdict   covers             this reviewer's evidence covers the exact head
#             changes_requested  this reviewer's latest exact-head review asks for changes
#             stale              this reviewer's newest evidence names an older commit
#             none               nothing usable from this reviewer
#   form      which evidence shape produced the verdict (approval, clean_comment,
#             clean_reaction, reviewed, marker) — for the handoff description only
#   sha, reviewer, detail, at, summary  the record that decided the verdict
#
# The gate passes if ANY checker covers head. Checkers never consult each other.
# ---------------------------------------------------------------------------------

# Shared jq: pick the record that decides a native reviewer's verdict — the latest
# exact-head review when there is one, otherwise the latest review at all. An
# approval for an older commit cannot cover a later push; a later review cannot
# inherit an earlier approval.
# shellcheck disable=SC2016  # a jq program, not shell
readonly _JQ_LATEST='
  def latest($records; $head):
    ([ $records[] | select(.sha == $head) ]) as $on_head
    | if ($on_head | length) > 0 then $on_head[-1] elif ($records | length) > 0 then $records[-1] else null end;
  def empty_verdict($checker):
    { checker: $checker, verdict: "none", form: "", sha: "", reviewer: "", detail: "", at: "", summary: "" };'

# CodeRabbit: only a native APPROVED pinned to head covers. CHANGES_REQUESTED on head
# is "changes requested" (it re-approves on its own once the threads resolve). Any
# other exact-head state is nothing; anything off-head is stale.
_coderabbit_check() {
  jq -c "$_JQ_LATEST"'
    .head as $head
    | latest(.coderabbit; $head) as $r
    | if $r == null then empty_verdict("coderabbit")
      elif $r.sha == $head and $r.detail == "APPROVED" then $r + { checker: "coderabbit", verdict: "covers", form: "approval" }
      elif $r.sha == $head and $r.detail == "CHANGES_REQUESTED" then $r + { checker: "coderabbit", verdict: "changes_requested", form: "" }
      elif $r.sha == $head then $r + { checker: "coderabbit", verdict: "none", form: "" }
      else $r + { checker: "coderabbit", verdict: "stale", form: "" }
      end'
}

# Codex: four evidence shapes cover head — a native APPROVED, a native COMMENTED or
# CHANGES_REQUESTED (the thread gate then owns every finding), the connector's clean
# comment whose 10- or 40-char SHA is a prefix of head, or the trusted reaction
# witness pinned to head. The newest of those on head is the record reported. With
# nothing usable on head, the newest Codex record of any shape is reported: stale
# when it names an older commit, none when it is an unusable state (DISMISSED,
# PENDING) on head itself.
_codex_check() {
  jq -c "$_JQ_LATEST"'
    .head as $head
    | ([ .codex_native[] | select(.sha == $head)
         | if .detail == "APPROVED" then . + { form: "approval" }
           elif .detail == "COMMENTED" or .detail == "CHANGES_REQUESTED" then . + { form: "reviewed" }
           else empty end ]
       + [ .codex_clean[] | select(.sha as $s | $head | startswith($s)) | . + { form: "clean_comment" } ]
       + [ .codex_witness[] | select(.sha == $head) | . + { form: "clean_reaction" } ]
       | sort_by(.at)) as $on_head
    | if ($on_head | length) > 0 then $on_head[-1] + { checker: "codex", verdict: "covers" }
      else
        ((.codex_native + .codex_clean + .codex_witness) | sort_by(.at)) as $all
        | if ($all | length) == 0 then empty_verdict("codex")
          elif $all[-1].sha == $head then $all[-1] + { checker: "codex", verdict: "none", form: "" }
          else $all[-1] + { checker: "codex", verdict: "stale", form: "" }
          end
      end'
}

# Local attestation: a marker whose SHA is a prefix of head (or vice versa, for the
# 7-char short form) covers. Otherwise the newest marker is stale.
_marker_check() {
  jq -c "$_JQ_LATEST"'
    .head as $head
    | ([ .markers[] | select(.sha as $s | (($head | startswith($s)) or ($s | startswith($head)))) ]) as $pinned
    | if ($pinned | length) > 0 then $pinned[-1] + { checker: "marker", verdict: "covers", form: "marker" }
      elif (.markers | length) > 0 then .markers[-1] + { checker: "marker", verdict: "stale", form: "" }
      else empty_verdict("marker")
      end'
}

# ---------------------------------------------------------------------------------
# Pure merge check: returns 0 if head is a clean merge of origin/main (or base_ref)
# over reviewed_sha without any unreviewed feature commits.
# ---------------------------------------------------------------------------------
_is_pure_merge_from_main() {
  local pr=$1 reviewed_sha=$2 head=$3 base_ref=${4:-main}
  [[ -z "$reviewed_sha" || -z "$head" || "$reviewed_sha" == "$head" ]] && return 1

  # Object presence check: both reviewed_sha and head must be valid commits
  if ! git cat-file -e "${reviewed_sha}^{commit}" 2>/dev/null || ! git cat-file -e "${head}^{commit}" 2>/dev/null; then
    # In a git repo, attempt to fetch if missing
    git fetch -q --no-write-fetch-head origin "+refs/pull/${pr}/head" "+refs/heads/${base_ref}" 2>/dev/null || true
  fi

  git cat-file -e "${reviewed_sha}^{commit}" 2>/dev/null || return 1
  git cat-file -e "${head}^{commit}" 2>/dev/null || return 1

  # Step 1: reviewed_sha must be an ancestor of head
  git merge-base --is-ancestor "$reviewed_sha" "$head" 2>/dev/null || return 1

  # Step 2: resolve base branch ref (e.g. origin/main, main)
  local main_ref=""
  if git rev-parse --verify "origin/${base_ref}^{commit}" >/dev/null 2>&1; then
    main_ref="origin/${base_ref}"
  elif git rev-parse --verify "${base_ref}^{commit}" >/dev/null 2>&1; then
    main_ref="${base_ref}"
  else
    return 1
  fi

  # Step 3: all non-merge commits in reviewed_sha..head must already be on main
  local extra_commits
  extra_commits=$(git rev-list --no-merges "${reviewed_sha}..${head}" --not "$main_ref" 2>/dev/null) || return 1
  [[ -z "$extra_commits" ]] || return 1

  # Step 4: there must be at least one merge commit in reviewed_sha..head
  local merge_commits
  merge_commits=$(git rev-list --merges "${reviewed_sha}..${head}" 2>/dev/null) || return 1
  [[ -n "$merge_commits" ]] || return 1

  # Step 5: for every merge commit in reviewed_sha..head:
  # - It must be a 2-parent merge
  # - One parent must be a descendant of reviewed_sha (the feature branch side)
  # - One parent must be on main_ref (the main side)
  # - The merge must be a clean merge: its tree matches git merge-tree --write-tree
  local m parents p1 p2 clean_tree actual_tree parent_array
  for m in $merge_commits; do
    parents=$(git rev-list --parents -n 1 "$m" 2>/dev/null | cut -d' ' -f2-)
    read -r -a parent_array <<< "$parents"
    [[ ${#parent_array[@]} -eq 2 ]] || return 1

    p1="${parent_array[0]}"
    p2="${parent_array[1]}"

    if git merge-base --is-ancestor "$reviewed_sha" "$p1" 2>/dev/null && \
       git merge-base --is-ancestor "$p2" "$main_ref" 2>/dev/null; then
      : # valid order: branch merged main
    elif git merge-base --is-ancestor "$reviewed_sha" "$p2" 2>/dev/null && \
         git merge-base --is-ancestor "$p1" "$main_ref" 2>/dev/null; then
      : # reverse order
    else
      return 1
    fi

    clean_tree=$(git merge-tree --write-tree "$p1" "$p2" 2>/dev/null) || return 1
    actual_tree=$(git rev-parse "${m}^{tree}" 2>/dev/null) || return 1
    [[ "$clean_tree" == "$actual_tree" ]] || return 1
  done

  return 0
}

# ---------------------------------------------------------------------------------
# Review summary — the one JSON document every consumer reads (Gate 3, merge-handoff,
# request-codex-review, pr-watch, pr-dashboard). Computed once per call.
#
#   head                    current head SHA
#   label                   approved | changes requested | stale review | not reviewed
#   coverage                the covering checker's record, or null
#   checkers                { coderabbit, codex, marker } — each checker's verdict record
#   codex_request_pending   the owner's manual Codex request is pinned to this head
#   unresolved_threads      count from Gate 2's query
#
# Label rules, in order: any checker covers → approved; otherwise unresolved threads
# or any checker's changes_requested → changes requested; otherwise any stale → stale
# review; otherwise not reviewed.
# ---------------------------------------------------------------------------------
_review_summary() {
  local pr=$1
  local owner_repo head base_ref evidence coderabbit codex marker unresolved pr_view
  owner_repo=$(_repo_slug) || return 1
  head=$(gh pr view "$pr" --json headRefOid --jq .headRefOid) || return 1
  pr_view=$(gh pr view "$pr" --json baseRefName 2>/dev/null || true)
  if jq -e '.baseRefName' <<< "$pr_view" >/dev/null 2>&1; then
    base_ref=$(jq -r '.baseRefName' <<< "$pr_view")
  elif [[ "$pr_view" =~ ^[a-zA-Z0-9._/-]+$ ]]; then
    base_ref="$pr_view"
  else
    base_ref="main"
  fi
  base_ref=${base_ref:-main}
  evidence=$(_review_evidence "$pr" "$owner_repo" "$head") || return 1
  coderabbit=$(_coderabbit_check <<< "$evidence")
  codex=$(_codex_check <<< "$evidence")
  marker=$(_marker_check <<< "$evidence")
  unresolved=$(_unresolved_thread_count "$pr") || return 1

  # Check for inherited review approval across pure merges from main
  if [[ $(jq -r '.verdict' <<< "$coderabbit") == "stale" ]]; then
    local cr_sha cr_detail
    cr_sha=$(jq -r '.sha' <<< "$coderabbit")
    cr_detail=$(jq -r '.detail' <<< "$coderabbit")
    if [[ "$cr_detail" == "APPROVED" ]] && _is_pure_merge_from_main "$pr" "$cr_sha" "$head" "$base_ref"; then
      coderabbit=$(jq -c '. + { verdict: "covers", form: "approval", inherited: true, inherited_from: .sha }' <<< "$coderabbit")
    fi
  fi

  if [[ $(jq -r '.verdict' <<< "$codex") == "stale" ]]; then
    local cx_sha cx_detail cx_form=""
    cx_sha=$(jq -r '.sha' <<< "$codex")
    cx_detail=$(jq -r '.detail' <<< "$codex")
    case "$cx_detail" in
      APPROVED) cx_form="approval" ;;
      NO_FINDINGS) cx_form="clean_comment" ;;
      REACTION_WITNESS) cx_form="clean_reaction" ;;
      COMMENTED|CHANGES_REQUESTED) cx_form="reviewed" ;;
    esac
    if [[ -n "$cx_form" ]] && _is_pure_merge_from_main "$pr" "$cx_sha" "$head" "$base_ref"; then
      codex=$(jq -c --arg form "$cx_form" '. + { verdict: "covers", form: $form, inherited: true, inherited_from: .sha }' <<< "$codex")
    fi
  fi

  if [[ $(jq -r '.verdict' <<< "$marker") == "stale" ]]; then
    local mk_sha
    mk_sha=$(jq -r '.sha' <<< "$marker")
    if [[ -n "$mk_sha" ]] && _is_pure_merge_from_main "$pr" "$mk_sha" "$head" "$base_ref"; then
      marker=$(jq -c '. + { verdict: "covers", form: "marker", inherited: true, inherited_from: .sha }' <<< "$marker")
    fi
  fi

  jq -n --arg head "$head" --argjson unresolved "$unresolved" \
      --argjson coderabbit "$coderabbit" --argjson codex "$codex" --argjson marker "$marker" \
      --argjson evidence "$evidence" '
    [$coderabbit, $codex, $marker] as $checks
    | ([ $checks[] | select(.verdict == "covers") ]
       | (map(select(.checker == "coderabbit"))[0] // (sort_by(.at) | last))) as $coverage
    | {
        head: $head,
        label: (if $coverage != null then "approved"
                elif $unresolved > 0 or any($checks[]; .verdict == "changes_requested") then "changes requested"
                elif any($checks[]; .verdict == "stale") then "stale review"
                else "not reviewed" end),
        coverage: $coverage,
        checkers: { coderabbit: $coderabbit, codex: $codex, marker: $marker },
        codex_request_pending: any($evidence.codex_requests[]; .sha == $head),
        unresolved_threads: $unresolved
      }'
}

# One line per checker, for the FAIL block and the handoff: what each reviewer's
# evidence says about this head.
_checker_lines() {
  jq -r '
    .head[0:7] as $h
    | .checkers | to_entries[]
    | .key as $k | .value as $v
    | (if $k == "coderabbit" then "CodeRabbit" elif $k == "codex" then "Codex" else "local attestation" end) as $name
    | if $v.verdict == "covers" then
        (if ($v.inherited // false) then "  \($name): covers head \($h) (inherited from \($v.inherited_from[0:7]); pure merge from main)"
         else "  \($name): covers head \($h)" end)
      elif $v.verdict == "changes_requested" then "  \($name): requested changes on head \($h)"
      elif $v.verdict == "stale" then "  \($name): newest evidence names \($v.sha[0:7]), head is \($h)"
      else "  \($name): none" end'
}

# Human-readable name for a trusted native reviewer login, for handoff output.
_native_reviewer_label() {
  case "$1" in
    "$CODERABBIT_REVIEW_BOT") printf 'CodeRabbit\n' ;;
    *) printf 'Codex\n' ;;
  esac
}
# One head can carry several `CI Gate` runs (draft promotion re-triggers the workflow on
# the same SHA). This jq picks the authoritative one — a live or finished run over a
# cancelled leftover, a live run over a finished one (never conclude while a
# replacement is still running), then the newest by startedAt — from a
# `statusCheckRollup` payload. Recency is start time, not completion time: an older
# run that finishes after a newer one must not hide the newer verdict. Shared with
# merge-pr.sh's compact poller so the first evaluation and the re-polls cannot
# disagree; pr-watch.py's `_select_ci_gate` ranks the same way.
readonly CI_GATE_SELECT_JQ='
    [.statusCheckRollup[]? | select(.name == "CI Gate")]
    | sort_by(
        (if ((.conclusion // "") | ascii_upcase) == "CANCELLED" then 0 else 1 end),
        (if ((.status // "") | ascii_upcase) == "COMPLETED" then 0 else 1 end),
        (.startedAt // .completedAt // "")
      )
    | last'

# Gate 1: CI Gate check has SUCCESS conclusion.
#
# Two COMPLETED entries used to come back as two objects, so `status` read
# "COMPLETED\nCOMPLETED", never equalled COMPLETED, and parked the gate in WAIT forever.
check_ci() {
  local pr=$1
  local rollup
  rollup=$(gh pr view "$pr" --json statusCheckRollup --jq "${CI_GATE_SELECT_JQ} // empty")
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


# Number of unresolved review threads, from ANY author, via GraphQL with cursor
# pagination. Shared by Gate 2 and the review summary's label.
_unresolved_thread_count() {
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
      }") || return 1
    local page_unresolved
    page_unresolved=$(jq '[.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved == false)] | length' <<< "$resp")
    unresolved=$((unresolved + page_unresolved))
    has_next=$(jq -r '.data.repository.pullRequest.reviewThreads.pageInfo.hasNextPage' <<< "$resp")
    cursor=$(jq -r '.data.repository.pullRequest.reviewThreads.pageInfo.endCursor // empty' <<< "$resp")
  done
  printf '%s\n' "$unresolved"
}

# Gate 2: Zero unresolved review threads.
#
# Counts threads from ANY author. It used to filter to Copilot-authored threads, which
# after the retirement would have matched nothing and turned this gate into a permanent
# PASS — a false green strictly worse than no gate. Every thread on a PinPoint PR now
# comes from Tim or another agent, and AGENTS.md already requires each one to be fixed
# or explicitly declined-and-resolved, so counting all of them is what the policy said
# all along.
check_unresolved_threads() {
  local pr=$1
  local unresolved
  # merge-pr.sh's run_gate captures output with `|| rc=$?`, which disables errexit
  # inside; guard explicitly so a failed fetch is a FAIL, not an empty comparison.
  if ! unresolved=$(_unresolved_thread_count "$pr"); then
    echo "FAIL: threads: could not read review threads (GitHub fetch failed)"
    return 1
  fi

  if [ "$unresolved" -eq 0 ]; then
    echo "PASS: threads: 0 unresolved review threads"
    return 0
  fi
  echo "FAIL: threads: $unresolved unresolved review threads"
  echo "  remedy: fix the code, or decline with a one-sentence reply — then resolve"
  echo "          the thread. A silent ignore is not a resolution (AGENTS.md §5)."
  return 1
}

# Gate 3: some reviewer's evidence covers the exact head — a CodeRabbit approval, a
# Codex result in any of its four shapes, or a local review attestation. Any one is
# enough; the separate thread gate owns findings.
#
# Sets globals for merge-handoff: RS_LABEL, RS_HEAD_SHA, RS_SUMMARY (the JSON).
RS_LABEL=""
RS_HEAD_SHA=""
RS_SUMMARY=""

check_review_happened() {
  local pr=$1
  if ! RS_SUMMARY=$(_review_summary "$pr"); then
    echo "FAIL: reviewed: could not read review evidence (GitHub fetch failed)"
    return 1
  fi
  RS_HEAD_SHA=$(jq -r '.head' <<< "$RS_SUMMARY")
  RS_LABEL=$(jq -r '.label' <<< "$RS_SUMMARY")

  if [ "$RS_LABEL" = "approved" ]; then
    local who
    who=$(jq -r '.coverage.checker' <<< "$RS_SUMMARY")
    local inherited from_sha suffix=""
    inherited=$(jq -r '.coverage.inherited // false' <<< "$RS_SUMMARY")
    if [ "$inherited" = "true" ]; then
      from_sha=$(jq -r '.coverage.inherited_from // .coverage.sha' <<< "$RS_SUMMARY")
      suffix=" (inherited from ${from_sha:0:7}; pure merge from main)"
    fi
    case "$who" in
      coderabbit) echo "PASS: reviewed: CodeRabbit approved head SHA ${RS_HEAD_SHA:0:7}${suffix}" ;;
      codex)
        case "$(jq -r '.coverage.form' <<< "$RS_SUMMARY")" in
          approval) echo "PASS: reviewed: Codex approved head SHA ${RS_HEAD_SHA:0:7}${suffix}" ;;
          clean_comment) echo "PASS: reviewed: Codex found no major issues on head SHA ${RS_HEAD_SHA:0:7}${suffix}" ;;
          clean_reaction) echo "PASS: reviewed: trusted workflow witnessed Codex clean reaction on head SHA ${RS_HEAD_SHA:0:7}${suffix}" ;;
          *) echo "PASS: reviewed: Codex reviewed head SHA ${RS_HEAD_SHA:0:7}; thread gate owns findings${suffix}" ;;
        esac
        ;;
      *) echo "PASS: reviewed: review marker pins head SHA ${RS_HEAD_SHA:0:7}${suffix}" ;;
    esac
    return 0
  fi

  echo "FAIL: reviewed: ${RS_LABEL} — no reviewer's evidence covers head ${RS_HEAD_SHA:0:7}"
  _checker_lines <<< "$RS_SUMMARY"
  if [ "$(jq -r '.codex_request_pending' <<< "$RS_SUMMARY")" = "true" ]; then
    echo "  remedy: the manual Codex review for this head was already requested; wait for"
    echo "          exact-head evidence, do not request the same head again. A new head"
    echo "          requires replacement CI and one new request."
  else
    echo "  remedy: after current-head CI succeeds and the PR is ready, run"
    echo "          request-codex-review.sh ${pr} exactly once for this head, or ask Tim"
    echo "          for a CodeRabbit request or a local review (review-preflight +"
    echo "          mark-review). A new head requires replacement CI and a new review."
  fi
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
