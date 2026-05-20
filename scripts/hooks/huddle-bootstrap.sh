#!/usr/bin/env bash
# shellcheck disable=SC2250  # unbraced $vars are consistent throughout this codebase
# huddle-bootstrap.sh — one-time initialization of the huddle coordination system.
#
# Creates:
#   - root epic bead (open forever, never closes)
#   - today's first daily bead (child of root)
#   - this month's first monthly bead (child of root)
#   - <STATE_DIR>/config.json with root_bead_id
#   - root bead notes JSON (§4.2 schema from huddle system design spec)
#
# Idempotent: re-running on an already-bootstrapped project prints status and
# exits 0 without creating duplicate beads.
#
# Usage: bash scripts/hooks/huddle-bootstrap.sh

set -euo pipefail

# --- Dependency check ---
for dep in jq bd python3; do
  command -v "$dep" >/dev/null 2>&1 || {
    printf 'huddle-bootstrap.sh: %s not found — please install it\n' "$dep" >&2
    exit 1
  }
done

# --- State directory ---
LIB_SCRIPT="$(dirname "$0")/huddle-lib.sh"
if [[ ! -f "$LIB_SCRIPT" ]]; then
  printf 'huddle-bootstrap.sh: huddle-lib.sh not found at %s\n' "$LIB_SCRIPT" >&2
  exit 1
fi
# shellcheck source=huddle-lib.sh disable=SC1091
source "$LIB_SCRIPT"
STATE_DIR=$(huddle_state_dir) || {
  printf 'huddle-bootstrap.sh: not inside a git checkout; cannot resolve huddle state dir\n' >&2
  exit 1
}
mkdir -p "$STATE_DIR"

CONFIG_FILE="$STATE_DIR/config.json"

# --- Idempotency check ---
if [[ -f "$CONFIG_FILE" ]]; then
  ROOT_ID=$(jq -r '.root_bead_id // ""' "$CONFIG_FILE" 2>/dev/null)
  if [[ -n "$ROOT_ID" ]]; then
    # Verify root bead still exists and is accessible
    ROOT_STATUS=$(bd show "$ROOT_ID" --json 2>/dev/null | jq -r '.[0].status // "missing"' 2>/dev/null || echo "missing")
    if [[ "$ROOT_STATUS" != "missing" ]]; then
      printf 'Huddle already bootstrapped.\n'
      printf '  Root bead: %s (status: %s)\n' "$ROOT_ID" "$ROOT_STATUS"
      NOTES_STR=$(bd show "$ROOT_ID" --json 2>/dev/null | jq -r '.[0].notes // ""' 2>/dev/null || echo "")
      if [[ -n "$NOTES_STR" ]]; then
        TODAY_BEAD=$(printf '%s' "$NOTES_STR" | python3 -c "
import sys, json
try:
    n = json.loads(sys.stdin.read())
    print(n.get('today_bead', {}).get('id', 'unknown'))
except Exception:
    print('unknown')
" 2>/dev/null || echo "unknown")
        MONTHLY_BEAD=$(printf '%s' "$NOTES_STR" | python3 -c "
import sys, json
try:
    n = json.loads(sys.stdin.read())
    print(n.get('monthly_bead', {}).get('id', 'unknown'))
except Exception:
    print('unknown')
" 2>/dev/null || echo "unknown")
        printf '  Today daily: %s\n' "$TODAY_BEAD"
        printf '  Monthly:     %s\n' "$MONTHLY_BEAD"
      fi
      exit 0
    fi
    printf 'Warning: root bead %s is missing or inaccessible; re-bootstrapping.\n' "$ROOT_ID"
  fi
fi

TODAY=$(date +%F)
MONTH=$(date +%Y-%m)
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

printf 'Bootstrapping huddle coordination system...\n'

# --- Create root epic ---
printf '  Creating root epic...\n'
ROOT_DESCRIPTION="Huddle coordination root — the permanent parent bead for all daily and monthly coordination beads.

This bead never closes. Daily beads (children) are created each day; monthly beads (children) are created each month. After rotation, daily beads carry a categorized summary of the day's coordination activity in their description and a raw archive in their notes field.

Historical archive: PP-cvh contains coordination activity prior to $TODAY.

State is stored in this bead's notes field as JSON (schema v1); use \`bd show <this-id> --json\` to inspect."

ROOT_ID=$(bd create -t epic \
  --title "Huddle coordination root" \
  --description "$ROOT_DESCRIPTION" \
  --silent)
printf '  Root epic:     %s\n' "$ROOT_ID"

# --- Create today's daily bead ---
printf '  Creating today'\''s daily bead...\n'
TODAY_ID=$(bd create -t task \
  --parent "$ROOT_ID" \
  --title "Huddle daily $TODAY" \
  --description "Active coordination bead for $TODAY. Agents post updates here with their sign-off (e.g. —Claude-WorktreeFix). At midnight rotation, this bead gets a categorized summary in its description and a raw archive in its notes, then closes." \
  --silent)
printf '  Today daily:   %s\n' "$TODAY_ID"

# --- Create this month's monthly bead ---
printf '  Creating monthly bead...\n'
MONTHLY_ID=$(bd create -t task \
  --parent "$ROOT_ID" \
  --title "Huddle monthly $MONTH" \
  --description "Monthly coordination summary for $MONTH. Receives aggregated summaries of each day's daily bead when that daily closes." \
  --silent)
printf '  Monthly:       %s\n' "$MONTHLY_ID"

# --- Build and write root notes JSON ---
printf '  Writing root bead notes JSON...\n'
NOTES_JSON=$(python3 -c "
import json, sys
notes = {
    'schema_version': 1,
    'today_bead': {'id': sys.argv[1], 'date': sys.argv[2]},
    'monthly_bead': {'id': sys.argv[3], 'month': sys.argv[4]},
    'recent_dailies': [{'id': sys.argv[1], 'date': sys.argv[2]}],
    'settings': {
        'n_dailies_to_inject': 5,
        'day_boundary_tz': 'local',
        'stale_name_cutoff_days': 14
    },
    'last_rotation': sys.argv[5]
}
print(json.dumps(notes))
" "$TODAY_ID" "$TODAY" "$MONTHLY_ID" "$MONTH" "$NOW")

bd update "$ROOT_ID" --notes "$NOTES_JSON"

# --- Write config.json ---
printf '  Writing config.json...\n'
python3 -c "
import json, sys
config = {'schema_version': 1, 'root_bead_id': sys.argv[1]}
print(json.dumps(config, indent=2))
" "$ROOT_ID" > "$CONFIG_FILE"

printf '\nBootstrap complete!\n'
printf '  Config:    %s\n' "$CONFIG_FILE"
printf '  Root:      %s\n' "$ROOT_ID"
printf '  Today:     %s (%s)\n' "$TODAY_ID" "$TODAY"
printf '  Monthly:   %s (%s)\n' "$MONTHLY_ID" "$MONTH"
printf '\nHooks will now use the new bead hierarchy. PP-cvh remains open as historical archive.\n'
# shellcheck disable=SC2016  # backticks are literal Markdown, not command substitution
printf 'Run `bash scripts/hooks/huddle-whoami.sh register <YourName> <session_id>` to register yourself.\n'
