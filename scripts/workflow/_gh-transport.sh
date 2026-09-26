#!/usr/bin/env bash
# GitHub reads for the PR gates: GraphQL first, REST when GraphQL is refused.
# Sourced by _pr-gates.sh; merge-pr.sh reaches it through that file.
#
# Claude Code cloud sessions reach GitHub through a proxy that answers every GraphQL
# request with HTTP 403 ("GraphQL is not available from Claude Code sessions"). `gh pr
# view --json`, `gh repo view`, `gh pr merge`, `gh pr edit` and `gh api graphql` are all
# GraphQL, so without this layer merge-pr.sh fails on its first read there.
#
# Every wrapper tries the GraphQL command the scripts always ran, with the same
# arguments, so local output and test stubs are unchanged. Only that exact 403 switches
# the transport to REST; any other failure is reported as before. The REST builders
# return the same JSON shape `gh pr view --json` would for the fields the gates ask for,
# and fail closed when a response cannot be read.
#
# The switch is remembered in _GH_TRANSPORT. A wrapper that runs inside `$(...)` cannot
# update its caller, so the first read of a run should happen at top level:
# merge-pr.sh's PR_INFO read does, and every later subshell inherits "rest".
# PINPOINT_GH_TRANSPORT=rest forces REST from the start (tests, or skipping the
# doomed GraphQL call).

readonly _GH_GRAPHQL_BLOCKED_MARKER="GraphQL is not available from Claude Code sessions"
_GH_TRANSPORT=${PINPOINT_GH_TRANSPORT:-graphql}

_gh_rest_mode() { [ "$_GH_TRANSPORT" = "rest" ]; }

_gh_switch_to_rest() {
  _GH_TRANSPORT=rest
  export PINPOINT_GH_TRANSPORT=rest
}

# Run a GraphQL-backed gh command, storing stdout in the variable named by $1.
# Returns 0/the command's rc as before, or 99 after switching to REST on the 403. The
# 403's stderr is swallowed; every other stderr is passed through unchanged.
_gh_graphql_to() {
  local __gh_var=$1 __gh_out __gh_err __gh_rc=0
  shift
  __gh_err=$(mktemp)
  __gh_out=$("$@" 2>"$__gh_err") || __gh_rc=$?
  if [ "$__gh_rc" -ne 0 ] && grep -qF "$_GH_GRAPHQL_BLOCKED_MARKER" "$__gh_err"; then
    rm -f "$__gh_err"
    _gh_switch_to_rest
    return 99
  fi
  cat "$__gh_err" >&2
  rm -f "$__gh_err"
  printf -v "$__gh_var" '%s' "$__gh_out"
  return "$__gh_rc"
}

# owner/repo without GraphQL: GH_REPO when set, else the last two path segments of
# origin's URL (the cloud proxy remote ends in /git/<owner>/<repo>).
_gh_rest_repo_slug() {
  if [ -n "${GH_REPO:-}" ]; then
    printf '%s\n' "${GH_REPO#*github.com/}"
    return 0
  fi
  local url
  url=$(git remote get-url origin 2>/dev/null) || return 1
  url=${url%.git}
  url=${url%/}
  if [[ "$url" =~ ([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+)$ ]]; then
    printf '%s/%s\n' "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}"
    return 0
  fi
  return 1
}

# The `gh pr view --json <fields>` document, built from REST. Fields this layer does not
# know fail closed rather than coming back null.
_gh_rest_pr_json() {
  local pr=$1 fields=$2 slug pull rollup='[]' field
  slug=$(_gh_rest_repo_slug) || return 1
  for field in ${fields//,/ }; do
    case "$field" in
      author|title|url|labels|headRefOid|headRefName|baseRefName|mergeable|state|mergedAt|mergeCommit|statusCheckRollup) ;;
      *) echo "gh-transport: REST fallback does not support field '$field'" >&2; return 1 ;;
    esac
  done
  pull=$(gh api "repos/${slug}/pulls/${pr}") || return 1
  if [[ ",$fields," == *",statusCheckRollup,"* ]]; then
    local head raw
    head=$(jq -r '.head.sha // empty' <<< "$pull")
    [ -n "$head" ] || return 1
    # filter=all keeps every attempt; CI_GATE_SELECT_JQ already ranks duplicates.
    # Commit statuses are omitted: CI Gate is a check run, and nothing reads statuses.
    raw=$(gh api --paginate "repos/${slug}/commits/${head}/check-runs?filter=all&per_page=100") || return 1
    rollup=$(jq -s '[ .[].check_runs[]
      | { __typename: "CheckRun",
          name: .name,
          status: ((.status // "") | ascii_upcase),
          conclusion: (if .conclusion == null then "" else (.conclusion | ascii_upcase) end),
          startedAt: .started_at,
          completedAt: .completed_at,
          detailsUrl: .details_url } ]' <<< "$raw") || return 1
  fi
  jq -c --arg fields "$fields" --argjson rollup "$rollup" '
    { author: { login: .user.login },
      title: .title,
      url: .html_url,
      labels: [ .labels[] | { name } ],
      headRefOid: .head.sha,
      headRefName: .head.ref,
      baseRefName: .base.ref,
      mergeable: (if .mergeable == true then "MERGEABLE"
                  elif .mergeable == false then "CONFLICTING"
                  else "UNKNOWN" end),
      state: (if .merged == true then "MERGED" else (.state | ascii_upcase) end),
      mergedAt: .merged_at,
      mergeCommit: (if .merged == true then { oid: .merge_commit_sha } else null end),
      statusCheckRollup: $rollup }
    | with_entries(select(.key as $k | ($fields | split(",")) | index($k)))' <<< "$pull"
}

# `gh pr view <pr> --json <fields> [--jq <filter>]` into the variable named by $1.
# The filter is applied with `jq -r` on the REST path, matching gh's raw output.
_gh_pr_view_to() {
  local __gh_var=$1 __gh_pr=$2 __gh_fields=$3 __gh_filter=${4:-} __gh_json __gh_rc=0
  if ! _gh_rest_mode; then
    if [ -n "$__gh_filter" ]; then
      _gh_graphql_to "$__gh_var" gh pr view "$__gh_pr" --json "$__gh_fields" --jq "$__gh_filter" || __gh_rc=$?
    else
      _gh_graphql_to "$__gh_var" gh pr view "$__gh_pr" --json "$__gh_fields" || __gh_rc=$?
    fi
    [ "$__gh_rc" -eq 99 ] || return "$__gh_rc"
  fi
  __gh_json=$(_gh_rest_pr_json "$__gh_pr" "$__gh_fields") || return 1
  if [ -n "$__gh_filter" ]; then
    __gh_json=$(jq -r "$__gh_filter" <<< "$__gh_json") || return 1
  fi
  printf -v "$__gh_var" '%s' "$__gh_json"
}

# Subshell-friendly form for callers that want stdout.
_gh_pr_view() {
  local __gh_view_out
  _gh_pr_view_to __gh_view_out "$@" || return $?
  printf '%s\n' "$__gh_view_out"
}

# owner/repo.
_gh_repo_slug() {
  local __gh_slug __gh_rc=0
  if ! _gh_rest_mode; then
    _gh_graphql_to __gh_slug gh repo view --json nameWithOwner --jq .nameWithOwner || __gh_rc=$?
    if [ "$__gh_rc" -ne 99 ]; then
      [ "$__gh_rc" -eq 0 ] && printf '%s\n' "$__gh_slug"
      return "$__gh_rc"
    fi
  fi
  _gh_rest_repo_slug
}

# Count unresolved threads from the proxy's review-thread route. GitHub has no public
# REST field for thread resolution; the Claude Code proxy serves
# /pulls/{n}/ccr/review_threads, a top-level array with one
# {resolved, outdated, path, line, comment_ids} object per thread. It is read strictly:
# any other shape, or a thread whose `resolved` is not a boolean, is an error, never a
# zero.
_gh_rest_unresolved_thread_count() {
  local pr=$1 slug raw
  slug=$(_gh_rest_repo_slug) || return 1
  raw=$(gh api --paginate "repos/${slug}/pulls/${pr}/ccr/review_threads") || return 1
  jq -s '
    [ .[]
      | if type == "array" then .[] else error("review_threads page is not an array") end
      | if (type == "object" and (.resolved | type) == "boolean") then .resolved
        else error("review thread without a boolean resolved flag") end
      | select(. == false) ] | length' <<< "$raw"
}
