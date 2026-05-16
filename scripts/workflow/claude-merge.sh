#!/bin/bash
# scripts/workflow/claude-merge.sh
# Re-evaluates all PR gates at merge time and squash-merges if they pass.
# On gate failure, removes the ready-for-review label (it can no longer be trusted).
#
# Usage:
#   ./scripts/workflow/claude-merge.sh 918                # Check gates and merge
#   ./scripts/workflow/claude-merge.sh 918 --dry-run       # Show what would happen without acting
#   ./scripts/workflow/claude-merge.sh 918 --force         # Bypass all gates and merge
#
# Gate summary (see _pr-gates.sh for full logic):
#   check_ci              — all CI checks SUCCESS
#   check_copilot_currency — last Copilot review covers head commit (PP-pny0)
#   check_unresolved_threads — 0 unresolved Copilot threads
#   check_no_merge_conflict  — PR is not CONFLICTING
#
# Authorship check (not bypassable by --force — separate safety):
#   PR must be authored by the current gh CLI user.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/workflow/_pr-gates.sh
source "${SCRIPT_DIR}/_pr-gates.sh"

if [ $# -lt 1 ]; then
    echo "Usage: $0 <PR_NUMBER> [--dry-run] [--force]"
    exit 1
fi

PR=$1
if ! [[ "$PR" =~ ^[0-9]+$ ]]; then
    echo "Error: PR number must be numeric (e.g. '945'); received '$PR'."
    exit 1
fi
shift

FORCE=false
DRY_RUN=false

for arg in "$@"; do
    case $arg in
        --force) FORCE=true ;;
        --dry-run) DRY_RUN=true ;;
        *) echo "Error: unknown option '$arg'."; echo "Usage: $0 <PR_NUMBER> [--dry-run] [--force]"; exit 1 ;;
    esac
done

# ---------------------------------------------------------------------------
# Authorship check — not bypassable by --force (separate safety concern)
# ---------------------------------------------------------------------------
current_user=$(gh api user --jq .login 2>/dev/null) || {
    echo "FAIL: Could not determine current GitHub user. Check 'gh auth status'."
    exit 1
}
pr_author=$(gh pr view "$PR" --json author --jq .author.login 2>/dev/null) || {
    echo "FAIL: Could not fetch PR #${PR} author."
    exit 1
}

if [ "$current_user" != "$pr_author" ]; then
    echo "REFUSE: claude-merge only operates on your own PRs."
    echo "  PR #${PR} was authored by '${pr_author}', but current user is '${current_user}'."
    exit 1
fi

# Get PR title for display
pr_title=$(gh pr view "$PR" --json title --jq .title 2>/dev/null) || pr_title="(unknown)"
echo "PR #${PR}: ${pr_title}"
echo "Author: ${pr_author} (matches current user)"

# ---------------------------------------------------------------------------
# Run all four gates
# ---------------------------------------------------------------------------
gates_passed=true
gate_failures=()

if ! check_ci "$PR"; then
    gates_passed=false
    pr_url=$(gh pr view "$PR" --json url --jq .url 2>/dev/null || echo "")
    gate_failures+=("CI is red — see ${pr_url}")
fi

if ! check_copilot_currency "$PR" "$FORCE"; then
    gates_passed=false
    gate_failures+=("Copilot is reviewing the latest commit — re-run in ~3min, or use --force")
fi

if ! check_unresolved_threads "$PR" "$FORCE"; then
    gates_passed=false
    pr_url=$(gh pr view "$PR" --json url --jq .url 2>/dev/null || echo "")
    gate_failures+=("Unresolved Copilot threads — address at ${pr_url}/files")
fi

if ! check_no_merge_conflict "$PR"; then
    gates_passed=false
    gate_failures+=("Merge conflict — resolve and re-push (git fetch origin && git merge origin/main)")
fi

# ---------------------------------------------------------------------------
# Handle gate failure
# ---------------------------------------------------------------------------
if [ "$gates_passed" = "false" ]; then
    echo ""
    echo "GATES FAILED — PR #${PR} is not ready to merge."
    for hint in "${gate_failures[@]}"; do
        echo "  - ${hint}"
    done

    if [ "$DRY_RUN" = "false" ]; then
        # Remove ready-for-review label if present (squelch error if already absent)
        current_labels=$(gh pr view "$PR" --json labels --jq '[.labels[].name]' 2>/dev/null || echo "[]")
        if echo "$current_labels" | jq -e 'index("ready-for-review") != null' >/dev/null 2>&1; then
            gh pr edit "$PR" --remove-label "ready-for-review" >/dev/null 2>&1 || true
            echo "Removed ready-for-review label (label can no longer be trusted)."
        fi
    else
        echo "(DRY RUN: would remove ready-for-review label if present)"
    fi
    exit 1
fi

# ---------------------------------------------------------------------------
# All gates passed — merge or dry-run
# ---------------------------------------------------------------------------
if [ "$DRY_RUN" = "true" ]; then
    echo ""
    echo "DRY RUN: All gates passed. Would run:"
    echo "  gh pr merge ${PR} --squash --delete-branch"
else
    echo ""
    echo "All gates passed. Merging PR #${PR}..."
    gh pr merge "$PR" --squash --delete-branch
    echo "Merged."
fi
