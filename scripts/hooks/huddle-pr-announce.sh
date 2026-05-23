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
# Dedup: skips posting if today's bead comments already mention "PR #N" (word-bounded).
#
# HUDDLE_DRY_RUN=1: print the would-post text to stdout instead of calling bd.
#   Used by test_huddle_pr_announce.py.
# HUDDLE_PR_TITLE_OVERRIDE: when set, skip the `gh pr view` fetch and use this
#   string as PR_TITLE in the Bash branch. Intended for dry-run tests so no
#   network call is made. Example: HUDDLE_PR_TITLE_OVERRIDE="fix thing (PP-abc1)"
# HUDDLE_FORCE_TITLE_FETCH=1: test-only. Lets the `gh pr view` fetch branch run
#   even under HUDDLE_DRY_RUN=1, so a test can exercise the real fetch path with a
#   fake `gh` on PATH (no network). Production never sets this.
#
# The `gh pr view` title fetch (Bash path) is bounded by a 3s timeout(1)/gtimeout(1)
# when available so a slow/stalled call can't hold this PostToolUse hook toward the
# harness's ~10s timeout; if no timeout binary exists it falls back to a bare gh
# call. Any gh failure is fail-open → empty title → bare message.

set -euo pipefail

# Fail-open on missing dependencies (including bd).
for dep in jq python3 bd; do
  command -v "$dep" >/dev/null 2>&1 || exit 0
done

# --- Read stdin JSON (best-effort, fail-open) ---
INPUT=""
if [[ ! -t 0 ]]; then
  IFS= read -r -d '' INPUT || true
fi

[[ -n "$INPUT" ]] || exit 0

# --- Parse all fields in one python3 invocation (fast path) ---
# Outputs five fields separated by ASCII STX (\x02), a non-whitespace, non-printable
# byte that won't appear in JSON string values (tool names, PR numbers, PR titles are
# all safe). STX avoids bash's IFS whitespace-collapsing on empty fields.
# Fields: tool_name STX tool_cmd STX pr_number STX pr_title STX resp_output
# Any parse failure → five STX → all variables empty → exit 0 at case statement.
_PARSED=$(printf '%s' "$INPUT" | python3 -c "
import sys, json
SEP = chr(2)  # STX — non-whitespace, not in JSON values
try:
    d = json.load(sys.stdin)
    tool_name = d.get('tool_name') or ''
    tool_input = d.get('tool_input') or {}
    tool_cmd = tool_input.get('command') or '' if isinstance(tool_input, dict) else ''
    resp = d.get('tool_response') or {}

    pr_number = ''
    pr_title = ''
    resp_output = ''

    if tool_name == 'mcp__github__create_pull_request':
        if isinstance(resp, str):
            try:
                resp = json.loads(resp)
            except Exception:
                resp = {}
        if isinstance(resp, dict):
            pr_number = str(resp.get('number') or resp.get('pullRequest', {}).get('number') or '')
            pr_title = str(resp.get('title') or resp.get('pullRequest', {}).get('title') or '')
    elif tool_name == 'Bash':
        if isinstance(resp, dict):
            resp_output = str(resp.get('output') or resp.get('stdout') or '')
        elif resp is not None:
            resp_output = str(resp)

    print(SEP.join([tool_name, tool_cmd, pr_number, pr_title, resp_output]))
except Exception:
    print(SEP.join(['', '', '', '', '']))
" 2>/dev/null) || exit 0

# Use STX (\x02) as IFS — it is a non-whitespace byte, so bash `read` treats
# consecutive STX chars as separate empty fields (no collapsing).
# Compatible with bash 3.2 (macOS default) since it requires no `mapfile`.
_STX=$(printf '\002')
OLD_IFS="$IFS"
IFS="$_STX"
# shellcheck disable=SC2162  # -r is intentional; IFS is set above
read -r TOOL_NAME TOOL_CMD PR_NUMBER PR_TITLE TOOL_RESPONSE <<< "$_PARSED"
IFS="$OLD_IFS"

# --- CHEAP EARLY-EXIT: bail unless this is a PR create ---
case "$TOOL_NAME" in
  mcp__github__create_pull_request)
    # MCP path — PR_NUMBER and PR_TITLE already populated above
    ;;
  Bash)
    # Only proceed if the command looks like `gh pr create`
    case "$TOOL_CMD" in
      *"gh pr create"*) ;;
      *) exit 0 ;;
    esac
    # Only proceed on success: output must contain a GitHub pull URL
    case "$TOOL_RESPONSE" in
      *"github.com/"*"/pull/"*);;
      *) exit 0 ;;
    esac
    # Parse PR number from the URL in the output
    PR_NUMBER=$(printf '%s' "$TOOL_RESPONSE" | grep -oE '/pull/([0-9]+)' | head -1 | grep -oE '[0-9]+' || echo "")
    # Fetch PR title (see header comment for the timeout/fail-open contract):
    #   1. HUDDLE_PR_TITLE_OVERRIDE wins (test seam, no network).
    #   2. Otherwise call `gh pr view`, bounded by timeout(1)/gtimeout(1) if present.
    # Network gate: the gh call is skipped under dry-run UNLESS the test opts in via
    # HUDDLE_FORCE_TITLE_FETCH=1 (paired with a fake `gh` on PATH). Production never
    # sets that, so dry-run tests stay network-free.
    if [[ -n "${HUDDLE_PR_TITLE_OVERRIDE:-}" ]]; then
      PR_TITLE="$HUDDLE_PR_TITLE_OVERRIDE"
    elif { [[ "${HUDDLE_DRY_RUN:-}" != "1" ]] || [[ "${HUDDLE_FORCE_TITLE_FETCH:-}" == "1" ]]; } && [[ -n "$PR_NUMBER" ]]; then
      _TIMEOUT=""
      if command -v timeout >/dev/null 2>&1; then
        _TIMEOUT="timeout 3"
      elif command -v gtimeout >/dev/null 2>&1; then
        _TIMEOUT="gtimeout 3"
      fi
      PR_TITLE=$($_TIMEOUT gh pr view "$PR_NUMBER" --json title --jq .title 2>/dev/null || echo "")
    else
      PR_TITLE=""
    fi
    ;;
  *)
    exit 0
    ;;
esac

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
# Use word-boundary grep to avoid PR #12 false-matching inside PR #123.
# Fail-open: if bd or jq error, skip dedup and proceed to post.
EXISTING=$(bd comments "$TODAY_BEAD" --json 2>/dev/null | jq -r '.[].text' 2>/dev/null | grep -E "PR #${PR_NUMBER}([^0-9]|$)" || echo "")
if [[ -n "$EXISTING" ]]; then
  exit 0
fi

# --- Parse PinPoint bead ID from PR title (convention: trailing "(PP-xxx)") ---
# Bead IDs may include dots (e.g. PP-yxw.9), so allow [a-z0-9.] in the capture.
BEAD_ID=""
if [[ -n "$PR_TITLE" ]]; then
  BEAD_ID=$(printf '%s' "$PR_TITLE" | grep -oE '\(PP-[a-z0-9.]+\)' | tail -1 | tr -d '()' || echo "")
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
