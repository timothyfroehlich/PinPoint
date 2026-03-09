#!/bin/bash
# scripts/workflow/monitor-gh-actions.sh
# Monitors active (queued or in-progress) workflow runs for a given PR.
# Usage: monitor-gh-actions.sh [PR_NUMBER]
#   PR_NUMBER - optional; when provided, filters runs to the PR's branch.
#               When omitted, monitors all active runs repo-wide.

set -euo pipefail

LOG_DIR="tmp/monitor-gh-actions"
ARTIFACT="$LOG_DIR/action-failure.md"
SIGNAL="$LOG_DIR/MONITOR_FAILED"
PR_NUMBER="${1:-}"

mkdir -p "$LOG_DIR"
rm -f "$SIGNAL" "$ARTIFACT"

# Find active runs (queued or in_progress), scoped to the PR's branch when possible.
if [ -n "$PR_NUMBER" ]; then
    BRANCH=$(gh pr view "$PR_NUMBER" --json headRefName --jq '.headRefName')
    ACTIVE_RUNS=$(gh run list --limit 100 --branch "$BRANCH" --json databaseId,status \
        --jq '.[] | select(.status == "in_progress" or .status == "queued") | .databaseId')
else
    ACTIVE_RUNS=$(gh run list --limit 100 --json databaseId,status \
        --jq '.[] | select(.status == "in_progress" or .status == "queued") | .databaseId')
fi

if [ -z "$ACTIVE_RUNS" ]; then
    # Fallback: show the most recent completed run (so the agent sees the result).
    if [ -n "$PR_NUMBER" ]; then
        ACTIVE_RUNS=$(gh run list --status completed --limit 1 --branch "$BRANCH" --json databaseId --jq '.[0].databaseId')
    else
        ACTIVE_RUNS=$(gh run list --status completed --limit 1 --json databaseId --jq '.[0].databaseId')
    fi
fi

if [ -z "$ACTIVE_RUNS" ]; then
    echo "No workflow runs found."
    exit 0
fi

echo "Monitoring runs: $ACTIVE_RUNS"

# Use an array to track background PIDs and their corresponding Run IDs
declare -a PIDS
declare -a RUN_IDS

# Function to watch a single run
watch_run() {
    local run_id=$1
    gh run watch "$run_id" --exit-status > /dev/null 2>&1
    return $?
}

# Launch watchers in parallel
for RID in $ACTIVE_RUNS; do
    watch_run "$RID" &
    PIDS+=("$!")
    RUN_IDS+=("$RID")
done

trap 'kill "${PIDS[@]}" 2>/dev/null || true; exit 0' TERM

# Wait for all background watchers and collect failures
FAILED_IDS=()
for i in "${!PIDS[@]}"; do
    if wait "${PIDS[$i]}"; then
        EXIT_CODE=0
    else
        EXIT_CODE=$?
    fi
    if [ "$EXIT_CODE" -ne 0 ]; then
        FAILED_IDS+=("${RUN_IDS[$i]}")
    fi
done

if [ ${#FAILED_IDS[@]} -eq 0 ]; then
    echo "All monitored workflows passed!"
    exit 0
else
    echo "Detected ${#FAILED_IDS[@]} failure(s). Fetching logs..."
    touch "$SIGNAL"
    {
        echo "# GitHub Actions Failure Report"
        echo "Generated at: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    } > "$ARTIFACT"

    for RID in "${FAILED_IDS[@]}"; do
        {
            echo
            echo "## Failed Run: $RID"
            echo "### Failed Logs (Last 100 lines)"
            echo '```text'
        } >> "$ARTIFACT"
        if ! gh run view "$RID" --log-failed 2>/dev/null | tail -n 100 >> "$ARTIFACT"; then
            echo "Unable to fetch failed logs for run $RID." >> "$ARTIFACT"
        fi
        {
            echo '```'
            echo
            echo "### Run Summary"
            echo '```text'
        } >> "$ARTIFACT"
        if ! gh run view "$RID" 2>/dev/null >> "$ARTIFACT"; then
            echo "Unable to fetch run summary for run $RID." >> "$ARTIFACT"
        fi
        echo '```' >> "$ARTIFACT"
    done

    echo "Failure report generated at $ARTIFACT"
    exit 1
fi
