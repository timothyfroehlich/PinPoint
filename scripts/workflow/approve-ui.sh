#!/usr/bin/env bash
# approve-ui.sh — record Tim's UI approval on a PR's current head (PP-zxlq.4).
#
# Usage: approve-ui.sh <PR> --source chat|artifact [--note "<text>"]
#
# Run it only when Tim himself approved this PR's UI: in the owning session's chat,
# or by clicking Approve in the orchestrator artifact. --source says which, and goes
# into the approval comment with --note. It approves the pending `ui-approval`
# environment deployment of the UI Approval run on the PR's current head, so an
# approval can never land on a head Tim did not see. Tim can also approve that
# deployment himself on GitHub; agents use this script, never the raw API.
#
# Exits 1 when the head has no UI Approval run waiting for sign-off.
set -euo pipefail

usage() {
  echo "Usage: $0 <PR> --source chat|artifact [--note \"<text>\"]" >&2
  exit 2
}

[[ $# -ge 1 && $1 =~ ^[0-9]+$ ]] || usage
pr=$1
shift
source="" note=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --source) source=${2:-}; shift 2 || usage ;;
    --note) note=${2:-}; shift 2 || usage ;;
    *) usage ;;
  esac
done
[[ "$source" == "chat" || "$source" == "artifact" ]] || usage

repo=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
head=$(gh pr view "$pr" --json headRefOid --jq .headRefOid)

run_id=$(gh run list --workflow ui-approval.yaml --commit "$head" --status waiting \
  --limit 1 --json databaseId --jq '.[0].databaseId // empty')
if [[ -z "$run_id" ]]; then
  echo "approve-ui: no UI Approval run is waiting for sign-off on PR #${pr} head ${head:0:7}." >&2
  echo "  Check the PR's UI Approval check: it may have passed (no UI change) or not started yet." >&2
  exit 1
fi

env_id=$(gh api "repos/${repo}/actions/runs/${run_id}/pending_deployments" \
  --jq '[.[] | select(.environment.name == "ui-approval") | .environment.id][0] // empty')
if [[ -z "$env_id" ]]; then
  echo "approve-ui: run ${run_id} has no pending ui-approval deployment." >&2
  exit 1
fi

comment="UI approved by Tim (${source}) on ${head:0:7}."
[[ -n "$note" ]] && comment="${comment} ${note}"

gh api -X POST "repos/${repo}/actions/runs/${run_id}/pending_deployments" \
  -F "environment_ids[]=${env_id}" -f state=approved -f comment="$comment" >/dev/null
echo "approve-ui: approved UI on PR #${pr} head ${head:0:7} (run ${run_id}, source ${source})."
