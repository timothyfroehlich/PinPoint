#!/bin/bash
# Combined orchestration snapshot. Successful producers keep their native compact
# output; failed producers surface one bounded diagnostic and make the snapshot fail.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

SHOW_PRS=true
SHOW_WORKTREES=true
SHOW_BEADS=true
SHOW_SECURITY=true
VERBOSE=false
overall_status=0

usage() {
  echo "Usage: $0 [--prs-only|--worktrees-only|--beads-only|--security-only] [--verbose]" >&2
  exit 2
}

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
    --verbose) VERBOSE=true ;;
    *) usage ;;
  esac
done

capture_stdout=$(mktemp "${TMPDIR:-/tmp}/pinpoint-orchestration-out.XXXXXX")
capture_stderr=$(mktemp "${TMPDIR:-/tmp}/pinpoint-orchestration-err.XXXXXX")
chmod 600 "$capture_stdout" "$capture_stderr"

trap 'rm -f "$capture_stdout" "$capture_stderr"' EXIT

first_error_line() {
  local line
  line=$(awk 'NF { print; exit }' "$capture_stderr")
  if [ -z "$line" ]; then
    line="no diagnostic emitted"
  fi
  printf '%s\n' "$line" |
    sed -E \
      -e 's/((token|TOKEN|password|PASSWORD|secret|SECRET|authorization|Authorization)[=:][[:space:]]*)[^[:space:]]+/\1[REDACTED]/g' \
      -e 's/gh[pousr]_[A-Za-z0-9_]{20,}/[REDACTED]/g' |
    cut -c1-240
}

report_failure() {
  local label="$1"
  local rc="$2"
  local detail=""
  if [ "$VERBOSE" = false ]; then
    detail=$(first_error_line)
  fi
  if [ -n "$detail" ]; then
    printf 'ERROR: %s unavailable (exit %s): %s\n' "$label" "$rc" "$detail"
  else
    printf 'ERROR: %s unavailable (exit %s)\n' "$label" "$rc"
  fi
  overall_status=1
}

run_snapshot() {
  local label="$1"
  local rc
  shift
  : >"$capture_stdout"
  : >"$capture_stderr"

  if [ "$VERBOSE" = true ]; then
    if "$@"; then
      return
    else
      rc=$?
    fi
  elif "$@" >"$capture_stdout" 2>"$capture_stderr"; then
    cat "$capture_stdout" "$capture_stderr"
    return
  else
    rc=$?
  fi

  report_failure "$label" "$rc"
}

capture_value() {
  local label="$1"
  local rc
  shift
  : >"$capture_stdout"
  : >"$capture_stderr"

  if [ "$VERBOSE" = true ]; then
    if "$@" >"$capture_stdout"; then
      CAPTURED_VALUE=$(cat "$capture_stdout")
      return 0
    else
      rc=$?
    fi
  elif "$@" >"$capture_stdout" 2>"$capture_stderr"; then
    CAPTURED_VALUE=$(cat "$capture_stdout")
    return 0
  else
    rc=$?
  fi

  report_failure "$label" "$rc"
  CAPTURED_VALUE=""
  return 1
}

section_header() {
  printf '========================================\n %s\n========================================\n\n' "$1"
}

if [ "$SHOW_PRS" = true ]; then
  section_header "PR Dashboard"
  run_snapshot "PR dashboard" bash "$SCRIPT_DIR/pr-dashboard.sh"
  echo ""
fi

if [ "$SHOW_WORKTREES" = true ]; then
  section_header "Worktree Health"
  run_snapshot "worktree report" python3 "$SCRIPT_DIR/../worktree_reap.py" \
    --repo-dir "$SCRIPT_DIR/../.."
  echo ""
fi

if [ "$SHOW_BEADS" = true ]; then
  section_header "Beads Status"
  echo "--- Ready (unblocked) ---"
  run_snapshot "Beads ready list" bd ready -n 50
  echo ""
  echo "--- In Progress ---"
  run_snapshot "Beads in-progress list" bd list --status=in_progress
  echo ""
fi

if [ "$SHOW_SECURITY" = true ]; then
  section_header "Security Alerts (Dependabot)"

  CAPTURED_VALUE=""
  if capture_value "repository detection" gh repo view --json nameWithOwner --jq '.nameWithOwner'; then
    REPO_SLUG="$CAPTURED_VALUE"
    CAPTURED_VALUE=""
    if capture_value "Dependabot alerts" gh api "repos/${REPO_SLUG}/dependabot/alerts" --jq '
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
      )'; then
      alerts="$CAPTURED_VALUE"
      total=$(printf '%s\n' "$alerts" | jq '[.[].count] | add // 0')
      if [ "$total" -eq 0 ]; then
        echo "  No open security alerts."
      else
        printf '  %s open alert(s):\n\n' "$total"
        printf '%s\n' "$alerts" |
          jq -r '.[] | "  \(.severity | ascii_upcase) (\(.count)): \(.items | join(", "))"'
      fi
    fi
  fi
  echo ""
fi

exit "$overall_status"
