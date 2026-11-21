#!/usr/bin/env bash
# approve-ui.sh — record Tim's UI approval on the PR head he saw (PP-zxlq.4).
#
# Usage: approve-ui.sh <PR> --head <sha> --source chat|artifact [--note "<text>"]
#
# Run it only when Tim himself approved this PR's UI: in the owning session's chat,
# or by clicking Approve in the orchestrator artifact. --source says which, and goes
# into the approval comment with --note. --head is the commit Tim saw (the one the
# screenshots were taken from). When the PR head has moved past it, the script
# records the approval on the current head only if the PR's own UI diff there is
# the same patch as at the commit Tim saw (ui-approval-scope.sh --compare): a merge
# of main, clean or conflicted, that left the PR's UI changes alone. Otherwise it
# refuses and names the UI files that changed, so an approval never lands on UI he
# did not see.
#
# On a head whose UI Approval run waits for sign-off (no earlier sign-off on the
# PR), it approves that run's pending `ui-approval` environment deployment. On a
# head whose UI Approval already passed because Tim signed off on an earlier head,
# it records his fresh approval as a PR comment: the owning agent showed him a
# significant UI change since that sign-off (pinpoint-pr-workflow 3.5). Tim can
# also approve the deployment himself on GitHub; agents use this script, never the
# raw API.
#
# Exits 1 when the head has no UI Approval run waiting and none that passed.
set -euo pipefail

usage() {
  echo "Usage: $0 <PR> --head <sha> --source chat|artifact [--note \"<text>\"]" >&2
  exit 2
}

[[ $# -ge 1 && $1 =~ ^[0-9]+$ ]] || usage
pr=$1
shift
source="" note="" seen=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --source) source=${2:-}; shift 2 || usage ;;
    --note) note=${2:-}; shift 2 || usage ;;
    --head) seen=${2:-}; shift 2 || usage ;;
    *) usage ;;
  esac
done
[[ "$source" == "chat" || "$source" == "artifact" ]] || usage
[[ "$seen" =~ ^[0-9a-f]{7,40}$ ]] || usage

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
head=$(gh pr view "$pr" --json headRefOid --jq .headRefOid)
saw=""
if [[ "$head" != "$seen"* ]]; then
  # The head moved past the commit Tim saw. Fetch both and compare the PR's own UI
  # diff at each: a merge of main leaves it unchanged, a new UI change does not.
  git fetch -q origin main "refs/pull/${pr}/head"
  if ! seen_full=$(git rev-parse --verify -q "${seen}^{commit}"); then
    echo "approve-ui: ${seen:0:7}, the commit Tim saw, is not in this clone." >&2
    exit 1
  fi
  differ=$(CLAUDE_REVIEW_MAIN_REF=origin/main \
    bash "${script_dir}/ui-approval-scope.sh" --compare "$seen_full" "$head")
  if [[ -n "$differ" ]]; then
    echo "approve-ui: PR #${pr} head ${head:0:7} changes UI beyond ${seen:0:7}, the commit Tim saw:" >&2
    while IFS= read -r path; do echo "  ${path}" >&2; done <<< "$differ"
    echo "  Show Tim the UI at ${head:0:7} and get his approval for that commit." >&2
    exit 1
  fi
  saw=$seen_full
fi

comment="UI approved by Tim (${source}) on ${head:0:7}."
if [[ -n "$saw" ]]; then
  comment="${comment} He saw ${saw:0:7}; the PR's own UI changes are the same at ${head:0:7}."
fi
[[ -n "$note" ]] && comment="${comment} ${note}"

run_id=$(gh run list --workflow ui-approval.yaml --commit "$head" --status waiting \
  --limit 1 --json databaseId --jq '.[0].databaseId // empty')
if [[ -z "$run_id" ]]; then
  passed=$(gh run list --workflow ui-approval.yaml --commit "$head" --status success \
    --limit 1 --json databaseId --jq '.[0].databaseId // empty')
  if [[ -z "$passed" ]]; then
    echo "approve-ui: no UI Approval run on PR #${pr} head ${head:0:7} is waiting for sign-off or has passed." >&2
    echo "  It may not have started yet; check the PR's UI Approval check." >&2
    exit 1
  fi
  # The check already passed, normally on an earlier sign-off: record this
  # approval as a comment.
  gh pr comment "$pr" --body "$comment" >/dev/null
  echo "approve-ui: UI Approval already passed on PR #${pr} head ${head:0:7};"
  echo "  recorded Tim's approval as a PR comment (source ${source})."
  exit 0
fi

env_id=$(gh api "repos/${repo}/actions/runs/${run_id}/pending_deployments" \
  --jq '[.[] | select(.environment.name == "ui-approval") | .environment.id][0] // empty')
if [[ -z "$env_id" ]]; then
  echo "approve-ui: run ${run_id} has no pending ui-approval deployment." >&2
  exit 1
fi

gh api -X POST "repos/${repo}/actions/runs/${run_id}/pending_deployments" \
  -F "environment_ids[]=${env_id}" -f state=approved -f comment="$comment" >/dev/null
echo "approve-ui: approved UI on PR #${pr} head ${head:0:7} (run ${run_id}, source ${source})."
if [[ -n "$saw" ]]; then
  echo "  Tim saw ${saw:0:7}; the PR's own UI changes are the same at ${head:0:7}."
fi
