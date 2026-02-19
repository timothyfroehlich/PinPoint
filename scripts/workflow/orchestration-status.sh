#!/bin/bash
# scripts/workflow/orchestration-status.sh
# Combined startup script for orchestration situational awareness.
# Outputs PR dashboard, worktree health, and beads status in one call.
#
# Usage:
#   ./scripts/workflow/orchestration-status.sh                   # All sections
#   ./scripts/workflow/orchestration-status.sh --prs-only        # Just PR dashboard
#   ./scripts/workflow/orchestration-status.sh --worktrees-only  # Just worktree health
#   ./scripts/workflow/orchestration-status.sh --beads-only      # Just beads status
#   ./scripts/workflow/orchestration-status.sh --security-only   # Just Dependabot alerts

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

SHOW_PRS=true
SHOW_WORKTREES=true
SHOW_BEADS=true
SHOW_SECURITY=true

for arg in "$@"; do
    case "$arg" in
        --prs-only)
            SHOW_PRS=true
            SHOW_WORKTREES=false
            SHOW_BEADS=false
            SHOW_SECURITY=false
            ;;
        --worktrees-only)
            SHOW_PRS=false
            SHOW_WORKTREES=true
            SHOW_BEADS=false
            SHOW_SECURITY=false
            ;;
        --beads-only)
            SHOW_PRS=false
            SHOW_WORKTREES=false
            SHOW_BEADS=true
            SHOW_SECURITY=false
            ;;
        --security-only)
            SHOW_PRS=false
            SHOW_WORKTREES=false
            SHOW_BEADS=false
            SHOW_SECURITY=true
            ;;
        *)
            echo "Error: unknown option '$arg'."
            echo "Usage: $0 [--prs-only|--worktrees-only|--beads-only|--security-only]"
            exit 1
            ;;
    esac
done

# Section 1: PR Dashboard
if [ "$SHOW_PRS" = "true" ]; then
    echo "========================================"
    echo " PR Dashboard"
    echo "========================================"
    echo ""
    bash "$SCRIPT_DIR/pr-dashboard.sh" 2>/dev/null || echo "  (no open PRs or error fetching)"
    echo ""
fi

# Section 2: Worktree Health
if [ "$SHOW_WORKTREES" = "true" ]; then
    echo "========================================"
    echo " Worktree Health"
    echo "========================================"
    echo ""
    bash "$SCRIPT_DIR/stale-worktrees.sh" 2>/dev/null || echo "  (no ephemeral worktrees or error)"
    echo ""
fi

# Section 3: Beads Status
if [ "$SHOW_BEADS" = "true" ]; then
    echo "========================================"
    echo " Beads Status"
    echo "========================================"
    echo ""

    echo "--- Ready (unblocked) ---"
    bd ready -n 50 2>/dev/null || echo "  (bd not available or no ready issues)"
    echo ""

    echo "--- In Progress ---"
    bd list --status=in_progress 2>/dev/null || echo "  (none in progress)"
    echo ""
fi

# Section 4: Security Alerts
if [ "$SHOW_SECURITY" = "true" ]; then
    echo "========================================"
    echo " Security Alerts (Dependabot)"
    echo "========================================"
    echo ""

    # Detect repo owner/name from git remote
    REPO_SLUG=$(gh repo view --json nameWithOwner --jq '.nameWithOwner' 2>/dev/null) || REPO_SLUG=""

    if [ -z "$REPO_SLUG" ]; then
        echo "  (could not detect repository)"
    else
        if ! alerts=$(gh api "repos/${REPO_SLUG}/dependabot/alerts" --jq '
            [.[] | select(.state == "open")] |
            group_by(.security_vulnerability.severity) |
            map({
                severity: .[0].security_vulnerability.severity,
                count: length,
                items: [.[] | "\(.dependency.package.name) (\(.security_advisory.cve_id // "no CVE"))"]
            }) |
            sort_by(
                if .severity == "critical" then 0
                elif .severity == "high" then 1
                elif .severity == "medium" then 2
                else 3 end
            )' 2>/dev/null); then
            echo "  WARNING: Could not fetch Dependabot alerts (check gh auth or API access)"
            alerts="[]"
        fi

        total=$(echo "$alerts" | jq '[.[].count] | add // 0')

        if [ "$total" -eq 0 ]; then
            echo "  No open security alerts."
        else
            echo "  $total open alert(s):"
            echo ""
            echo "$alerts" | jq -r '.[] | "  \(.severity | ascii_upcase) (\(.count)): \(.items | join(", "))"'
        fi
    fi
    echo ""
fi
