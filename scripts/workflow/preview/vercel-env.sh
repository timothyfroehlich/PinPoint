# shellcheck shell=bash
# Git-branch-scoped Vercel preview env vars over the REST API (PP-fmli).
#
# Sourced by preview-create.sh and preview-destroy.sh. It replaces the Vercel
# CLI (formerly fetched with `npx vercel@<pin>` at run time), so no npm code runs
# in the steps that hold VERCEL_TOKEN and SUPABASE_ACCESS_TOKEN.
#
# Argv hygiene: the bearer token reaches curl through a `-K` config on a
# process-substitution fd written by the printf builtin, and env values reach
# jq and curl on stdin. Neither the token nor a value appears in any process's
# argv.
#
# Required environment:
#   VERCEL_TOKEN        Vercel auth token
#   VERCEL_ORG_ID       Vercel team id (teamId query parameter)
#   VERCEL_PROJECT_ID   Vercel project id
#   GIT_BRANCH          PR head branch the vars are scoped to

VERCEL_API_BASE="${VERCEL_API_BASE:-https://api.vercel.com}"

# vercel_api <METHOD> <path?query> [curl args...]
# Prints the response body followed by a final line holding the HTTP status.
# Returns non-zero only on a transport failure (curl could not complete).
vercel_api() {
  local method="$1" path="$2"
  shift 2
  curl -sS -X "$method" "${VERCEL_API_BASE}${path}" \
    -K <(printf 'header = "Authorization: Bearer %s"\n' "$VERCEL_TOKEN") \
    -w $'\n%{http_code}' \
    "$@"
}

# _vercel_status <raw> / _vercel_body <raw> split vercel_api output.
_vercel_status() { printf '%s' "${1##*$'\n'}"; }
_vercel_body() { printf '%s' "${1%$'\n'*}"; }

# vercel_env_set <NAME> <TYPE>  (value on stdin)
# Upserts NAME for target=preview scoped to $GIT_BRANCH. TYPE is a Vercel env
# type (sensitive | encrypted | plain). Returns non-zero on any failure, so
# callers under `set -e` fail the run instead of shipping a preview that is
# silently wired to the wrong database.
vercel_env_set() {
  local name="$1" type="$2" raw status body
  if ! raw="$(jq -Rs \
    --arg key "$name" --arg type "$type" --arg branch "$GIT_BRANCH" \
    '{key: $key, value: ., type: $type, target: ["preview"], gitBranch: $branch}' \
    | vercel_api POST \
      "/v10/projects/${VERCEL_PROJECT_ID}/env?upsert=true&teamId=${VERCEL_ORG_ID}" \
      -H "Content-Type: application/json" --data-binary @-)"; then
    echo "::error::Vercel API request failed while setting ${name}" >&2
    return 1
  fi
  status="$(_vercel_status "$raw")"
  body="$(_vercel_body "$raw")"
  if [[ ! "$status" =~ ^2 ]] \
    || [[ "$(printf '%s' "$body" | jq '(.failed // []) | length' 2>/dev/null || echo 1)" != "0" ]]; then
    # Print only Vercel's error code/message: never the request or the body.
    echo "::error::failed to set Vercel env ${name} for branch ${GIT_BRANCH} (HTTP ${status:-?})" >&2
    printf '%s' "$body" \
      | jq -r '[.error, (.failed // [])[].error] | map(select(.) | "\(.code // "?"): \(.message // "")") | .[]' \
        2>/dev/null >&2 || true
    return 1
  fi
}

# vercel_env_rm <NAME>...
# Removes each NAME's preview var scoped to $GIT_BRANCH. Missing vars are not an
# error. Returns non-zero if listing or any delete fails.
vercel_env_rm() {
  local branch_q raw status body ids id name rc=0
  branch_q="$(jq -rn --arg b "$GIT_BRANCH" '$b | @uri')"
  if ! raw="$(vercel_api GET \
    "/v10/projects/${VERCEL_PROJECT_ID}/env?gitBranch=${branch_q}&teamId=${VERCEL_ORG_ID}")"; then
    echo "::warning::Vercel API request failed while listing env for ${GIT_BRANCH}"
    return 1
  fi
  status="$(_vercel_status "$raw")"
  body="$(_vercel_body "$raw")"
  if [[ ! "$status" =~ ^2 ]]; then
    echo "::warning::listing Vercel env for ${GIT_BRANCH} returned HTTP ${status:-?}"
    return 1
  fi
  for name in "$@"; do
    ids="$(printf '%s' "$body" | jq -r --arg k "$name" --arg b "$GIT_BRANCH" \
      '(.envs // [])[]
       | select(.key == $k and .gitBranch == $b and ((.target // []) | index("preview")))
       | .id')"
    if [[ -z "$ids" ]]; then
      echo "  ${name} not present (skipped)"
      continue
    fi
    while IFS= read -r id; do
      [[ -z "$id" ]] && continue
      if ! raw="$(vercel_api DELETE \
        "/v9/projects/${VERCEL_PROJECT_ID}/env/${id}?teamId=${VERCEL_ORG_ID}")"; then
        echo "::warning::Vercel API request failed while removing ${name}"
        rc=1
        continue
      fi
      status="$(_vercel_status "$raw")"
      if [[ "$status" =~ ^2 ]]; then
        echo "  removed ${name}"
      else
        echo "::warning::removing ${name} returned HTTP ${status:-?}"
        rc=1
      fi
    done <<<"$ids"
  done
  return "$rc"
}
