#!/bin/bash
# DEPRECATED: Use ./scripts/workflow/pr-watch.py instead.
# pr-watch.py is Monitor-tool compatible (streams one line per event) and avoids
# the 20s review-polling loop that caused 403 rate-limit errors (see commit 8f522a21).
#
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

# Trap TERM so we can clean up and exit gracefully if review watcher fires.
# Must be set BEFORE launching the review watcher subshell to avoid a race
# where SIGTERM arrives before the handler is installed.
EARLY_EXIT=false
trap 'EARLY_EXIT=true; kill "${PIDS[@]}" 2>/dev/null || true' TERM

# If a PR number was given, also poll for new Copilot reviews in the background.
# If a review arrives, kill the CI watchers and exit early so the agent can address it.
REVIEW_WATCHER_PID=""
if [ -n "$PR_NUMBER" ]; then
    # Capture the current review count as baseline
    BASELINE_REVIEW_COUNT=$(gh api "repos/{owner}/{repo}/pulls/${PR_NUMBER}/reviews" --jq 'length' 2>/dev/null || echo "0")
    (
        while true; do
            sleep 20
            CURRENT_COUNT=$(gh api "repos/{owner}/{repo}/pulls/${PR_NUMBER}/reviews" --jq 'length' 2>/dev/null || echo "0")
            if [ "$CURRENT_COUNT" -gt "$BASELINE_REVIEW_COUNT" ]; then
                echo ""
                echo "📝 New review posted on PR #${PR_NUMBER} — stopping CI watch early."
                echo "   Run: ./scripts/workflow/copilot-comments.sh ${PR_NUMBER}"
                # Signal the main script process ($PPID is the parent of this subshell)
                kill -TERM "$PPID" 2>/dev/null || true
                exit 0
            fi
        done
    ) &
    REVIEW_WATCHER_PID=$!
fi

# Wait for all background watchers and collect failures
FAILED_IDS=()
for i in "${!PIDS[@]}"; do
    if wait "${PIDS[$i]}"; then
        EXIT_CODE=0
    else
        EXIT_CODE=$?
    fi
    if [ "$EXIT_CODE" -ne 0 ] && ! $EARLY_EXIT; then
        FAILED_IDS+=("${RUN_IDS[$i]}")
    fi
done

# Clean up review watcher if still running
if [ -n "$REVIEW_WATCHER_PID" ]; then
    kill "$REVIEW_WATCHER_PID" 2>/dev/null || true
fi

if $EARLY_EXIT; then
    exit 0
fi

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
