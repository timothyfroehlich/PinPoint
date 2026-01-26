#!/bin/bash
# scripts/monitor-gh-actions.sh
# Usage: ./scripts/monitor-gh-actions.sh [run_id]

# Determine Run ID
if [ -z "$1" ]; then
    RUN_ID=$(gh run list --limit 1 --json databaseId --jq '.[0].databaseId')
else
    RUN_ID=$1
fi

LOG_DIR="tmp/monitor-gh-actions"
ARTIFACT="$LOG_DIR/action-failure.md"
SIGNAL="$LOG_DIR/MONITOR_FAILED"

mkdir -p "$LOG_DIR"
rm -f "$SIGNAL" "$ARTIFACT"

echo "Watching workflow run $RUN_ID..."
# gh run watch --exit-status will wait for completion and exit with 1 on failure.
if gh run watch "$RUN_ID" --exit-status; then
    echo "Workflow passed!"
    exit 0
else
    echo "Workflow failed. Fetching logs..."
    touch "$SIGNAL"
    echo "# GitHub Action Failure: Run $RUN_ID" > "$ARTIFACT"
    echo "Generated at: $(date)" >> "$ARTIFACT"
    echo "## Failed Jobs & Logs (Last 100 lines)" >> "$ARTIFACT"
    echo '```text' >> "$ARTIFACT"
    # Fetch logs for failed steps
    gh run view "$RUN_ID" --log-failed | tail -n 100 >> "$ARTIFACT"
    echo '```' >> "$ARTIFACT"
    
    # Also include the run summary for context
    echo -e "
## Run Summary" >> "$ARTIFACT"
    echo '```text' >> "$ARTIFACT"
    gh run view "$RUN_ID" >> "$ARTIFACT"
    echo '```' >> "$ARTIFACT"
    
    exit 1
fi
