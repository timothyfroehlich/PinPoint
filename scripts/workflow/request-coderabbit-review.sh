#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 || ! $1 =~ ^[0-9]+$ ]]; then
  echo "Usage: $0 <PR-number>" >&2
  exit 2
fi

readonly pr_number=$1
script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
readonly script_dir
# shellcheck source=scripts/workflow/_pr-gates.sh
source "${script_dir}/_pr-gates.sh"

owner_repo=$(_repo_slug)
owner=${owner_repo%%/*}
actor=$(gh api user --jq .login)
if [[ "$actor" != "$owner" ]]; then
  echo "BLOCK: CodeRabbit request: authenticated GitHub user ${actor} is not repository owner ${owner}" >&2
  exit 1
fi

metadata=$(gh pr view "$pr_number" --json headRefOid,isDraft,state,statusCheckRollup)
head_sha=$(jq -r .headRefOid <<< "$metadata")
if [[ "$(jq -r .state <<< "$metadata")" != "OPEN" ||
      "$(jq -r .isDraft <<< "$metadata")" == "true" ]]; then
  echo "BLOCK: CodeRabbit request: PR must be open and ready" >&2
  exit 1
fi

ci_gate=$(jq -c '
  [.statusCheckRollup[]? | select(.name == "CI Gate")]
  | sort_by(.startedAt // .completedAt // "")
  | last // {}
' <<< "$metadata")
if [[ "$(jq -r '.status // ""' <<< "$ci_gate")" != "COMPLETED" ||
      "$(jq -r '.conclusion // ""' <<< "$ci_gate")" != "SUCCESS" ]]; then
  echo "BLOCK: CodeRabbit request: current-head CI Gate has not passed" >&2
  exit 1
fi

if jq -e 'any(.statusCheckRollup[]?; .context == "CodeRabbit" and .state == "PENDING")' \
    <<< "$metadata" >/dev/null; then
  echo "BLOCK: CodeRabbit request: a review is already in progress on this head" >&2
  exit 1
fi

summary=$(_review_summary "$pr_number")
if [[ "$(jq -r .label <<< "$summary")" == "approved" ]]; then
  echo "BLOCK: CodeRabbit request: head ${head_sha:0:7} already has review coverage" >&2
  exit 1
fi

comments_raw=$(gh api --paginate "repos/${owner_repo}/issues/${pr_number}/comments")
if jq -se --arg actor "$actor" --arg head "$head_sha" '
  any(.[] | flatten | .[];
    .user.login? == $actor and
    ((.body // "") == ("@coderabbitai review\n<!-- pinpoint-coderabbit-review-head: " + $head + " -->")))
' <<< "$comments_raw" >/dev/null; then
  echo "BLOCK: CodeRabbit request: head ${head_sha:0:7} was already requested" >&2
  exit 1
fi

latest_head=$(gh pr view "$pr_number" --json headRefOid --jq .headRefOid)
if [[ "$latest_head" != "$head_sha" ]]; then
  echo "BLOCK: CodeRabbit request: PR head moved from ${head_sha:0:7} to ${latest_head:0:7}" >&2
  exit 1
fi

body=$(printf '@coderabbitai review\n<!-- pinpoint-coderabbit-review-head: %s -->' "$head_sha")
url=$(gh api --method POST "repos/${owner_repo}/issues/${pr_number}/comments" -f "body=${body}" --jq .html_url)
echo "PASS: CodeRabbit request: requested review for PR #${pr_number} head ${head_sha:0:7}"
echo "  ${url}"
