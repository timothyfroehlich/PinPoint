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
    ROOT_JSON_CHECK=$(bd show "$ROOT_ID" --json 2>/dev/null) || ROOT_JSON_CHECK="[]"
    ROOT_STATUS=$(printf '%s' "$ROOT_JSON_CHECK" | jq -r '.[0].status // "missing"' 2>/dev/null || echo "missing")
    if [[ "$ROOT_STATUS" != "missing" ]]; then
      printf 'Huddle already bootstrapped.\n'
      printf '  Root bead: %s (status: %s)\n' "$ROOT_ID" "$ROOT_STATUS"
      NOTES_STR=$(printf '%s' "$ROOT_JSON_CHECK" | jq -r '.[0].notes // ""' 2>/dev/null || echo "")

      # --- Notes validation ---
      # Validate that notes JSON is present, parseable, and has required keys.
      # If not, self-heal by reconstructing from existing children.
      NOTES_VALID=false
      if [[ -n "$NOTES_STR" ]]; then
        NOTES_CHECK=$(printf '%s' "$NOTES_STR" | python3 -c "
import sys, json
try:
    n = json.loads(sys.stdin.read())
    required = ['schema_version', 'today_bead', 'monthly_bead']
    missing = [k for k in required if k not in n]
    today_id = (n.get('today_bead') or {}).get('id', '')
    monthly_id = (n.get('monthly_bead') or {}).get('id', '')
    if missing or not today_id or not monthly_id:
        print('invalid')
    else:
        print('ok:' + today_id + ':' + monthly_id)
except Exception:
    print('invalid')
" 2>/dev/null || echo "invalid")
        if [[ "$NOTES_CHECK" == ok:* ]]; then
          NOTES_VALID=true
          TODAY_BEAD="${NOTES_CHECK#ok:}"
          TODAY_BEAD="${TODAY_BEAD%%:*}"
          MONTHLY_BEAD="${NOTES_CHECK##*:}"
        fi
      fi

      if [[ "$NOTES_VALID" == true ]]; then
        printf '  Today daily: %s\n' "$TODAY_BEAD"
        printf '  Monthly:     %s\n' "$MONTHLY_BEAD"
        exit 0
      fi

      # --- Self-heal: notes are missing or invalid ---
      printf '\nWARNING: Root notes were missing or invalid — attempting recovery from existing children.\n'
      printf '  (This is the self-heal path triggered by the 2026-05-20 incident on PP-lt12.)\n\n'

      TODAY=$(date +%F)
      MONTH=$(date +%Y-%m)
      NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

      # Query children of root bead to find today's daily and this month's monthly.
      CHILDREN_JSON=$(bd children "$ROOT_ID" --json 2>/dev/null) || CHILDREN_JSON="[]"

      RECOVER_IDS=$(printf '%s' "$CHILDREN_JSON" | python3 -c "
import sys, json
children = json.loads(sys.stdin.read())
today = sys.argv[1]
month = sys.argv[2]
today_id = ''
monthly_id = ''
today_date = ''
monthly_month = ''
for c in children:
    title = c.get('title', '')
    status = c.get('status', '')
    if status == 'closed':
        continue
    if title == 'Huddle daily ' + today:
        today_id = c.get('id', '')
        today_date = today
    if title == 'Huddle monthly ' + month:
        monthly_id = c.get('id', '')
        monthly_month = month
print(today_id + ':' + today_date + ':' + monthly_id + ':' + monthly_month)
" "$TODAY" "$MONTH" 2>/dev/null || echo "::::")

      RECOVER_TODAY_ID="${RECOVER_IDS%%:*}"
      REST="${RECOVER_IDS#*:}"
      RECOVER_TODAY_DATE="${REST%%:*}"
      REST="${REST#*:}"
      RECOVER_MONTHLY_ID="${REST%%:*}"
      RECOVER_MONTHLY_MONTH="${REST##*:}"

      if [[ -z "$RECOVER_TODAY_ID" ]]; then
        printf 'ERROR: Recovery failed — could not find an open "Huddle daily %s" child under %s.\n' "$TODAY" "$ROOT_ID" >&2
        printf 'Manual action required: create the daily bead and write root notes manually.\n' >&2
        printf 'See: bash scripts/hooks/huddle-bootstrap.sh (full bootstrap from scratch).\n' >&2
        exit 1
      fi
      if [[ -z "$RECOVER_MONTHLY_ID" ]]; then
        printf 'ERROR: Recovery failed — could not find an open "Huddle monthly %s" child under %s.\n' "$MONTH" "$ROOT_ID" >&2
        printf 'Manual action required: create the monthly bead and write root notes manually.\n' >&2
        exit 1
      fi

      # Rebuild and write root notes JSON from recovered children.
      RECOVERED_NOTES=$(python3 -c "
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
" "$RECOVER_TODAY_ID" "$RECOVER_TODAY_DATE" "$RECOVER_MONTHLY_ID" "$RECOVER_MONTHLY_MONTH" "$NOW")

      bd update "$ROOT_ID" --notes "$RECOVERED_NOTES"

      printf 'Recovery complete.\n'
      printf '  Root notes were missing/invalid — recovered from existing children.\n'
      printf '  Root bead:   %s\n' "$ROOT_ID"
      printf '  Today daily: %s (%s)\n' "$RECOVER_TODAY_ID" "$RECOVER_TODAY_DATE"
      printf '  Monthly:     %s (%s)\n' "$RECOVER_MONTHLY_ID" "$RECOVER_MONTHLY_MONTH"
      exit 0
    fi
    printf 'Warning: root bead %s is missing or inaccessible; re-bootstrapping.\n' "$ROOT_ID"
  fi
fi

# --- Discover-and-adopt: never fork a duplicate root across machines ---
# Before creating a fresh root, check the synced beads DB for an existing
# "Huddle coordination root" epic (huddle_discover_root pulls first). On a
# second machine or a re-clone the root already exists remotely; adopt it by
# writing config.json instead of creating a duplicate. Only fall through to
# creation when discovery genuinely finds none (true first-ever bootstrap).
# After adopting, re-run this script to validate/self-heal the adopted root's
# notes via the idempotency path above.
EXISTING_ROOT=$(huddle_discover_root 2>/dev/null) || EXISTING_ROOT=""
if [[ -n "$EXISTING_ROOT" ]]; then
  printf 'Found existing huddle root %s in the synced beads DB — adopting it (no duplicate created).\n' "$EXISTING_ROOT"
  python3 -c "
import json, sys
print(json.dumps({'schema_version': 1, 'root_bead_id': sys.argv[1]}, indent=2))
" "$EXISTING_ROOT" > "$CONFIG_FILE"
  printf 'Wrote %s → %s. Re-run this script to validate the adopted root'\''s notes.\n' "$CONFIG_FILE" "$EXISTING_ROOT"
  exit 0
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
