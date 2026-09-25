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
pr_state=$(jq -r .state <<< "$metadata")
is_draft=$(jq -r .isDraft <<< "$metadata")

if [[ "$pr_state" != "OPEN" ]]; then
  echo "BLOCK: CodeRabbit request: PR #${pr_number} is ${pr_state}, not OPEN" >&2
  exit 1
fi
if [[ "$is_draft" == "true" ]]; then
  echo "BLOCK: CodeRabbit request: PR #${pr_number} is draft; wait for current-head CI, then mark it ready" >&2
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
  echo "BLOCK: CodeRabbit request: current-head CI Gate status=${ci_status}" >&2
  exit 1
fi
case "$ci_conclusion" in
  SUCCESS | NEUTRAL | SKIPPED) ;;
  *)
    echo "BLOCK: CodeRabbit request: current-head CI Gate conclusion=${ci_conclusion}" >&2
    exit 1
    ;;
esac

if jq -e 'any(.statusCheckRollup[]?; .context == "CodeRabbit" and .state == "PENDING")' \
    <<< "$metadata" >/dev/null; then
  echo "BLOCK: CodeRabbit request: a CodeRabbit review is already in progress; wait for it" >&2
  exit 1
fi

summary=$(_review_summary "$pr_number")
if [[ "$(jq -r '.label' <<< "$summary")" == "approved" ]]; then
  covered_by=$(jq -r '.coverage.checker' <<< "$summary")
  echo "BLOCK: CodeRabbit request: head ${head_sha:0:7} already has exact-head review coverage (${covered_by})" >&2
  exit 1
fi

# The SHA marker is what request-codex-review.sh later binds CodeRabbit's
# rate-limit reply to, so one head gets exactly one tagged request.
body=$(printf '@coderabbitai review\n<!-- pinpoint-coderabbit-review-head: %s -->' "$head_sha")
comments_raw=$(gh api --paginate "repos/${owner_repo}/issues/${pr_number}/comments")
if jq -se --arg actor "$actor" --arg body "$body" '
  any(.[] | flatten | .[]; .user.login? == $actor and (.body // "") == $body)
' <<< "$comments_raw" >/dev/null; then
  echo "BLOCK: CodeRabbit request: head ${head_sha:0:7} was already requested; wait for its result" >&2
  exit 1
fi

latest_head=$(gh pr view "$pr_number" --json headRefOid --jq .headRefOid)
if [[ "$latest_head" != "$head_sha" ]]; then
  echo "BLOCK: CodeRabbit request: PR head moved from ${head_sha:0:7} to ${latest_head:0:7}; re-check CI" >&2
  exit 1
fi

url=$(gh api --method POST "repos/${owner_repo}/issues/${pr_number}/comments" -f "body=${body}" --jq .html_url)
echo "PASS: CodeRabbit request: requested review for PR #${pr_number} head ${head_sha:0:7}"
echo "  ${url}"
