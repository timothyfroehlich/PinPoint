#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 || ! $1 =~ ^[0-9]+$ || ! $2 =~ ^[0-9]+$ ]]; then
  echo "Usage: $0 <PR-number> <CodeRabbit-rate-limit-comment-ID>" >&2
  exit 2
fi

readonly pr_number=$1
readonly rate_limit_comment_id=$2
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

metadata=$(gh pr view "$pr_number" --json headRefOid,isDraft,state,statusCheckRollup)
head_sha=$(jq -r .headRefOid <<< "$metadata")
pr_state=$(jq -r .state <<< "$metadata")
is_draft=$(jq -r .isDraft <<< "$metadata")

if [[ "$pr_state" != "OPEN" ]]; then
  echo "BLOCK: review request: PR #${pr_number} is ${pr_state}, not OPEN" >&2
  exit 1
fi
if [[ "$is_draft" == "true" ]]; then
  echo "BLOCK: review request: PR #${pr_number} is draft; wait for current-head CI, then mark it ready" >&2
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

# Any reviewer's coverage of this head — Codex, CodeRabbit, or a local attestation —
# makes a request redundant; a pending request for this head makes it a duplicate.
summary=$(_review_summary "$pr_number")
if [[ "$(jq -r '.label' <<< "$summary")" == "approved" ]]; then
  covered_by=$(jq -r '.coverage.checker' <<< "$summary")
  echo "BLOCK: review request: head ${head_sha:0:7} already has exact-head review coverage (${covered_by})" >&2
  exit 1
fi
if [[ "$(jq -r '.codex_request_pending' <<< "$summary")" == "true" ]]; then
  echo "BLOCK: review request: head ${head_sha:0:7} was already requested; wait for its result" >&2
  exit 1
fi

# A missing review, a pending CodeRabbit request, and a completed review without
# a native approval are not quota exhaustion. Bind the fallback to a SHA-tagged
# owner request and CodeRabbit's rate-limit acknowledgement after that request.
comments_raw=$(gh api --paginate "repos/${owner_repo}/issues/${pr_number}/comments")
latest_coderabbit_request_at=$(jq -sr --arg actor "$actor" --arg head "$head_sha" '
  [ .[] | flatten | .[]
    | select(.user.login? == $actor and
             (.body // "") == ("@coderabbitai review\n<!-- pinpoint-coderabbit-review-head: " + $head + " -->"))
    | .created_at // "" ] | max // ""
' <<< "$comments_raw")
if [[ -z "$latest_coderabbit_request_at" ]]; then
  echo "BLOCK: review request: no SHA-tagged CodeRabbit request for head ${head_sha:0:7}" >&2
  exit 1
fi

rate_limit_comment=$(gh api "repos/${owner_repo}/issues/comments/${rate_limit_comment_id}")
if ! jq -e --arg repo "$owner_repo" --arg pr "$pr_number" \
    --arg requested "$latest_coderabbit_request_at" '
  .user.login? == "coderabbitai[bot]" and
  .performed_via_github_app.slug? == "coderabbitai" and
  .issue_url? == ("https://api.github.com/repos/" + $repo + "/issues/" + $pr) and
  ((.body // "") | test("Review rate limited"; "i")) and
  (.updated_at // "") >= $requested
' <<< "$rate_limit_comment" >/dev/null; then
  echo "BLOCK: review request: comment ${rate_limit_comment_id} does not prove CodeRabbit usage exhaustion for this head" >&2
  exit 1
fi

latest_head=$(gh pr view "$pr_number" --json headRefOid --jq .headRefOid)
if [[ "$latest_head" != "$head_sha" ]]; then
  echo "BLOCK: review request: PR head moved from ${head_sha:0:7} to ${latest_head:0:7}; re-check CI" >&2
  exit 1
fi

body=$(printf '@codex review\n<!-- pinpoint-codex-review-head: %s -->' "$head_sha")
url=$(gh api --method POST "repos/${owner_repo}/issues/${pr_number}/comments" -f "body=${body}" --jq .html_url)
echo "PASS: review request: requested Codex review for PR #${pr_number} head ${head_sha:0:7}"
echo "  ${url}"
