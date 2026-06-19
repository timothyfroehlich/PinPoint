#!/usr/bin/env bash
set -euo pipefail

# Re-run the failed jobs of the most recent CI run for a commit SHA, so the
# audit gate re-evaluates now that the override is in place — without waiting
# for a new push.
#
# Re-running `--failed` is intentional: only the `pnpm-audit` job (and the
# dependent `CI Gate`) flip green; any OTHER genuine failure (a real test,
# typecheck, etc.) re-runs and stays red. The override bypasses the audit gate
# and nothing else.
#
# Usage: rerun-ci.sh <sha>
#
# Environment:
#   GH_TOKEN          required by `gh`
#   GITHUB_REPOSITORY owner/repo (defaults to timothyfroehlich/PinPoint)

REPO="${GITHUB_REPOSITORY:-timothyfroehlich/PinPoint}"
sha="${1:?sha required}"

run_id="$(gh api --paginate \
  "repos/${REPO}/actions/runs?head_sha=${sha}" \
  --jq '.workflow_runs | map(select(.name == "CI")) | sort_by(.run_started_at) | last | .id // empty')"

if [[ -z "$run_id" ]]; then
  echo "::warning::No CI run found for ${sha}; nothing to re-run. The override is recorded and applies on the next CI run."
  exit 0
fi

echo "Re-running failed jobs of CI run ${run_id} for ${sha}"
if ! gh run rerun "$run_id" --failed --repo "$REPO"; then
  echo "::warning::Could not re-run CI run ${run_id} (it may still be in progress or have no failed jobs yet). The override is recorded and applies on the next run."
fi
