#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 || ! $1 =~ ^[0-9]+$ ]]; then
  echo "Usage: $0 <PR-number>" >&2
  exit 2
fi

readonly pr=$1
script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
readonly script_dir
# shellcheck source=scripts/workflow/_pr-gates.sh
source "${script_dir}/_pr-gates.sh"

owner_repo=$(_repo_slug)
owner=${owner_repo%%/*}
actor=$(gh api user --jq .login)
if [[ "$actor" != "$owner" ]]; then
  echo "BLOCK: review request: authenticated GitHub user ${actor} is not repository owner ${owner}" >&2
  exit 1
fi

metadata=$(gh pr view "$pr" --json headRefOid,isDraft,state,statusCheckRollup)
head_sha=$(jq -r .headRefOid <<< "$metadata")
pr_state=$(jq -r .state <<< "$metadata")
is_draft=$(jq -r .isDraft <<< "$metadata")

if [[ "$pr_state" != "OPEN" ]]; then
  echo "BLOCK: review request: PR #${pr} is ${pr_state}, not OPEN" >&2
  exit 1
fi
if [[ "$is_draft" == "true" ]]; then
  echo "BLOCK: review request: PR #${pr} is draft; wait for current-head CI, then mark it ready" >&2
  exit 1
fi

ci_gate=$(jq -c '
  [.statusCheckRollup[]? | select(.name == "CI Gate")]
  | sort_by(.startedAt // .completedAt // "")
  | last // {}
' <<< "$metadata")
ci_status=$(jq -r '.status // "MISSING"' <<< "$ci_gate")
ci_conclusion=$(jq -r '.conclusion // "MISSING"' <<< "$ci_gate")
if [[ "$ci_status" != "COMPLETED" ]]; then
  echo "BLOCK: review request: current-head CI Gate status=${ci_status}" >&2
  exit 1
fi
case "$ci_conclusion" in
  SUCCESS | NEUTRAL | SKIPPED) ;;
  *)
    echo "BLOCK: review request: current-head CI Gate conclusion=${ci_conclusion}" >&2
    exit 1
    ;;
esac

review_record=$(_review_record "$pr" "$owner_repo" "$head_sha")
review_state=$(cut -f1 <<< "$review_record")
case "$review_state" in
  approval | clean_comment | clean_reaction | reviewed | marker)
    echo "BLOCK: review request: head ${head_sha:0:7} already has exact-head review coverage (${review_state})" >&2
    exit 1
    ;;
  review_requested)
    echo "BLOCK: review request: head ${head_sha:0:7} was already requested; wait for its result" >&2
    exit 1
    ;;
esac

latest_head=$(gh pr view "$pr" --json headRefOid --jq .headRefOid)
if [[ "$latest_head" != "$head_sha" ]]; then
  echo "BLOCK: review request: PR head moved from ${head_sha:0:7} to ${latest_head:0:7}; re-check CI" >&2
  exit 1
fi

body=$(printf '@codex review\n<!-- pinpoint-codex-review-head: %s -->' "$head_sha")
url=$(gh api --method POST "repos/${owner_repo}/issues/${pr}/comments" -f "body=${body}" --jq .html_url)
echo "PASS: review request: requested Codex review for PR #${pr} head ${head_sha:0:7}"
echo "  ${url}"
