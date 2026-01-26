#!/bin/bash
# scripts/monitor-gh-actions.sh
# Monitors all currently active (queued or in-progress) workflow runs.

LOG_DIR="tmp/monitor-gh-actions"
ARTIFACT="$LOG_DIR/action-failure.md"
SIGNAL="$LOG_DIR/MONITOR_FAILED"

mkdir -p "$LOG_DIR"
rm -f "$SIGNAL" "$ARTIFACT"

# Find all active runs (queued or in_progress)
# We use multiple status flags to catch everything active.
ACTIVE_RUNS=$(gh run list --status in_progress --status queued --json databaseId --jq '.[].databaseId')

if [ -z "$ACTIVE_RUNS" ]; then
    # Fallback: if user specified an ID, use it. Otherwise, look for the absolute latest run.
    if [ -n "$1" ]; then
        ACTIVE_RUNS=$1
    else
        ACTIVE_RUNS=$(gh run list --limit 1 --json databaseId --jq '.[0].databaseId')
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
    PIDS+=($!)
    RUN_IDS+=($RID)
done

# Wait for all background watchers and collect failures
FAILED_IDS=()
for i in "${!PIDS[@]}"; do
    wait "${PIDS[$i]}"
    EXIT_CODE=$?
    if [ $EXIT_CODE -ne 0 ]; then
        FAILED_IDS+=("${RUN_IDS[$i]}")
    fi
done

if [ ${#FAILED_IDS[@]} -eq 0 ]; then
    echo "All monitored workflows passed!"
    exit 0
else
    echo "Detected ${#FAILED_IDS[@]} failure(s). Fetching logs..."
    touch "$SIGNAL"
    echo "# GitHub Actions Failure Report" > "$ARTIFACT"
    echo "Generated at: $(date)" >> "$ARTIFACT"
    
    for RID in "${FAILED_IDS[@]}"; do
        echo -e "\n## Failed Run: $RID" >> "$ARTIFACT"
        echo "### Failed Logs (Last 100 lines)" >> "$ARTIFACT"
        echo '```text' >> "$ARTIFACT"
        gh run view "$RID" --log-failed | tail -n 100 >> "$ARTIFACT"
        echo '```' >> "$ARTIFACT"
        
        echo -e "\n### Run Summary" >> "$ARTIFACT"
        echo '```text' >> "$ARTIFACT"
        gh run view "$RID" >> "$ARTIFACT"
        echo '```' >> "$ARTIFACT"
    done
    
    echo "Failure report generated at $ARTIFACT"
    exit 1
fi