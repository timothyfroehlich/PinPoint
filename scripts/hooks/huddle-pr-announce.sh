#!/usr/bin/env bash
# shellcheck disable=SC2250  # unbraced $vars are consistent throughout this codebase
# huddle-pr-announce.sh — PostToolUse hook: announce newly-opened PRs to the
# huddle coordination bead.
#
# Fires on EVERY PostToolUse call (matcher: Bash|mcp__github__create_pull_request).
# Must be FAST and FAIL-OPEN: it must never block a tool call, never error visibly,
# and must exit quickly when the tool is not a PR create.
#
# Supported tool shapes:
#   1. Bash: command matches `gh pr create` and stdout contains a /pull/N URL.
#   2. MCP:  tool_name == mcp__github__create_pull_request, response has .number/.html_url/.title.
#
# Dedup: skips posting if today's bead comments already mention "PR #N".
#
# HUDDLE_DRY_RUN=1: print the would-post text to stdout instead of calling bd.
#   Used by test_huddle_pr_announce.py.

set -euo pipefail

# Fail-open on missing dependencies.
for dep in jq python3; do
  command -v "$dep" >/dev/null 2>&1 || exit 0
done

# --- Read stdin JSON (best-effort, fail-open) ---
INPUT=""
if [[ ! -t 0 ]]; then
  IFS= read -r -d '' INPUT || true
fi

[[ -n "$INPUT" ]] || exit 0

# --- CHEAP EARLY-EXIT: bail unless this is a PR create ---
# Parse tool_name from stdin. Use python3 for correctness (jq may not handle
# escaped chars in tool_response reliably). Any parse failure → exit 0.
TOOL_NAME=$(printf '%s' "$INPUT" | python3 -c "
import sys, json
try:
    print(json.load(sys.stdin).get('tool_name') or '')
except Exception:
    print('')
" 2>/dev/null) || exit 0

case "$TOOL_NAME" in
  mcp__github__create_pull_request)
    # MCP path — proceed to parse below
    ;;
  Bash)
    # Only proceed if the command looks like `gh pr create`
    TOOL_CMD=$(printf '%s' "$INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    cmd = d.get('tool_input', {}).get('command') or ''
    print(cmd)
except Exception:
    print('')
" 2>/dev/null) || exit 0
    case "$TOOL_CMD" in
      *"gh pr create"*) ;;
      *) exit 0 ;;
    esac
    ;;
  *)
    exit 0
    ;;
esac

# --- Parse PR number and title from tool response ---
PR_NUMBER=""
PR_TITLE=""

if [[ "$TOOL_NAME" == "mcp__github__create_pull_request" ]]; then
  # MCP shape: tool_response is a JSON object with .number, .html_url, .title
  PR_NUMBER=$(printf '%s' "$INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    resp = d.get('tool_response') or {}
    if isinstance(resp, str):
        resp = json.loads(resp)
    print(resp.get('number') or resp.get('pullRequest', {}).get('number') or '')
except Exception:
    print('')
" 2>/dev/null) || PR_NUMBER=""
  PR_TITLE=$(printf '%s' "$INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    resp = d.get('tool_response') or {}
    if isinstance(resp, str):
        resp = json.loads(resp)
    print(resp.get('title') or resp.get('pullRequest', {}).get('title') or '')
except Exception:
    print('')
" 2>/dev/null) || PR_TITLE=""
else
  # Bash shape: parse /pull/N URL from tool_response (stdout of gh pr create)
  TOOL_RESPONSE=$(printf '%s' "$INPUT" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    resp = d.get('tool_response') or {}
    # tool_response may be a dict with 'output' or 'stdout', or a string directly
    if isinstance(resp, dict):
        print(resp.get('output') or resp.get('stdout') or '')
    else:
        print(str(resp))
except Exception:
    print('')
" 2>/dev/null) || TOOL_RESPONSE=""

  # Only proceed on success: output must contain a GitHub pull URL
  case "$TOOL_RESPONSE" in
    *"github.com/"*"/pull/"*);;
    *) exit 0 ;;
  esac

  PR_NUMBER=$(printf '%s' "$TOOL_RESPONSE" | grep -oE '/pull/([0-9]+)' | head -1 | grep -oE '[0-9]+' || echo "")
  # Title is not in the gh pr create stdout; bead ID won't be parsed for this shape.
  PR_TITLE=""
fi

# Bail if we couldn't parse a PR number
[[ -n "$PR_NUMBER" ]] || exit 0

# --- State directory and today's bead ---
LIB_SCRIPT="$(dirname "$0")/huddle-lib.sh"
[[ -f "$LIB_SCRIPT" ]] || exit 0
# shellcheck source=huddle-lib.sh disable=SC1091
source "$LIB_SCRIPT"
TODAY_BEAD=$(huddle_today_bead_id 2>/dev/null) || exit 0
[[ -n "$TODAY_BEAD" ]] || exit 0

# --- Dedup: skip if today's bead already mentions this PR ---
EXISTING=$(bd comments "$TODAY_BEAD" --json 2>/dev/null | jq -r '.[].text' 2>/dev/null | grep -F "PR #${PR_NUMBER}" || echo "")
if [[ -n "$EXISTING" ]]; then
  exit 0
fi

# --- Parse PinPoint bead ID from PR title (convention: trailing "(PP-xxx)") ---
BEAD_ID=""
if [[ -n "$PR_TITLE" ]]; then
  BEAD_ID=$(printf '%s' "$PR_TITLE" | grep -oE '\(PP-[a-z0-9]+\)' | tail -1 | tr -d '()' || echo "")
fi

BEAD_PART=""
[[ -n "$BEAD_ID" ]] && BEAD_PART=" ($BEAD_ID)"
TITLE_PART=""
[[ -n "$PR_TITLE" ]] && TITLE_PART=": $PR_TITLE"

SIGN="${HUDDLE_NAME:-huddle-auto}"
MSG="Opened PR #${PR_NUMBER}${BEAD_PART}${TITLE_PART}. —${SIGN}"

# --- Post (or dry-run) ---
if [[ "${HUDDLE_DRY_RUN:-}" == "1" ]]; then
  printf '%s\n' "$MSG"
  exit 0
fi

bd comments add "$TODAY_BEAD" "$MSG" >/dev/null 2>&1 || true

exit 0
