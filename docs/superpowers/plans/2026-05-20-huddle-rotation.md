# Huddle Rotation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement daily bead rotation for the huddle coordination system — creating `huddle-bootstrap.sh`, a real `huddle-rotation-check.sh`, and `huddle-rotate.sh` (phase A shell only); wire existing hooks to use the new bead hierarchy instead of hardcoded PP-cvh; update SKILL.md and spec paths.

**Architecture:** Bootstrap creates a root epic + today's daily + this month's monthly in the bd database, writes `.agents/huddle/config.json` with the root bead ID, and stores a JSON notes blob on the root bead that tracks active bead pointers. Rotation (phase A) acquires a flock/lockf lock, re-checks the date inside the lock, creates new daily/monthly beads atomically by updating root notes, then exits — the LLM-driven summarization (phase B) is documented as a subagent dispatch template in SKILL.md rather than implemented as shell. Both existing hooks (`huddle-poll.sh` and `huddle-session-start.sh`) are updated to read `today_bead.id` from config rather than hardcoding PP-cvh.

**Tech Stack:** Bash (set -euo pipefail, shellcheck), `jq` for JSON, `bd` CLI (beads issue tracker), `flock`/`lockf` (platform-detected, same pattern as `worktree-create.sh`), `python3` for JSON parsing in hooks (already used), `pnpm run check` (shellcheck included).

---

## File Map

| Action  | Path                                                        | Responsibility                                                                                                           |
| ------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Create  | `scripts/hooks/huddle-bootstrap.sh`                         | One-time idempotent init: root epic + daily + monthly + config.json                                                      |
| Create  | `scripts/hooks/huddle-rotate.sh`                            | Phase A atomic rotation (shell only): lock → recheck → create beads → update root notes → pointer comments               |
| Replace | `scripts/hooks/huddle-rotation-check.sh`                    | Real date-compare: reads config.json + root notes, returns 0 if rotation needed                                          |
| Modify  | `scripts/hooks/huddle-poll.sh`                              | Replace hardcoded `PP-cvh` with `today_bead.id` from config; add bootstrap-not-ready fast path                           |
| Modify  | `scripts/hooks/huddle-session-start.sh`                     | Insert bootstrap-needed branch before identity; add summary injection step                                               |
| Modify  | `.agents/skills/pinpoint-huddle/SKILL.md`                   | Document bootstrap, rotation, rotation subagent dispatch template, update state paths, remove "not yet included" section |
| Modify  | `docs/superpowers/specs/2026-05-17-huddle-system-design.md` | Replace all `.claude/huddle/` with `.agents/huddle/`                                                                     |

---

## Task 1: Replace huddle-rotation-check.sh stub with real implementation

**Files:**

- Replace: `scripts/hooks/huddle-rotation-check.sh`

The real implementation reads `config.json` → `root_bead_id`, then reads the root bead's notes JSON via `bd show <root> --json`, extracts `today_bead.date`, and compares to `$(date +%F)`. Returns 0 (rotation needed) if they differ; 1 if they match. If config.json is missing or root bead is unreachable, returns 1 (no rotation needed) so hooks degrade gracefully.

- [ ] **Step 1.1: Write the new huddle-rotation-check.sh**

Write the following content to `scripts/hooks/huddle-rotation-check.sh` (replacing the stub entirely):

```bash
#!/usr/bin/env bash
# shellcheck disable=SC2250  # unbraced $vars are consistent throughout this codebase
# huddle-rotation-check.sh — shared helper sourced by huddle-poll.sh and
# huddle-session-start.sh. Defines a single function `huddle_rotation_needed`
# that returns 0 if a coordination-bead rotation is needed, 1 otherwise.
#
# Design: reads <STATE_DIR>/config.json for root_bead_id, then reads the root
# bead's notes JSON via `bd show <root> --json`, extracts today_bead.date, and
# compares to $(date +%F) (local date). Returns 0 if mismatch (rotation
# needed), 1 if match (no rotation needed) or if config is missing/unreadable
# (hooks degrade gracefully — only SessionStart emits the user-visible notice).
#
# Called as:
#   source "$(dirname "$0")/huddle-rotation-check.sh"
#   if huddle_rotation_needed; then
#     # emit rotation notice
#   fi
#
# Requires huddle-lib.sh to already be sourced (STATE_DIR must be set by the
# caller before sourcing this file, OR this file sources the lib itself if
# STATE_DIR is unset).

# Ensure STATE_DIR is set. If the caller already sourced huddle-lib.sh and
# set STATE_DIR, we skip re-sourcing. Otherwise we source the lib ourselves.
# shellcheck disable=SC2317  # function is sourced and called by callers
huddle_rotation_needed() {
  local state_dir config_file root_id root_json today_bead_date today

  # Resolve state dir (re-use caller's STATE_DIR if already set)
  if [[ -n "${STATE_DIR:-}" ]]; then
    state_dir="$STATE_DIR"
  else
    local lib_script
    lib_script="$(dirname "${BASH_SOURCE[0]}")/huddle-lib.sh"
    [[ -f "$lib_script" ]] || return 1
    # shellcheck source=huddle-lib.sh disable=SC1091
    source "$lib_script"
    state_dir=$(huddle_state_dir) || return 1
  fi

  config_file="$state_dir/config.json"
  [[ -f "$config_file" ]] || return 1  # not bootstrapped → no rotation needed

  root_id=$(jq -r '.root_bead_id // ""' "$config_file" 2>/dev/null)
  [[ -n "$root_id" ]] || return 1

  # Fetch the root bead's notes JSON. bd show outputs a JSON array; we pick
  # the first element's `notes` field. If bd is unavailable or notes is empty,
  # fail open (return 1 = no rotation needed).
  root_json=$(bd show "$root_id" --json 2>/dev/null) || return 1
  today_bead_date=$(printf '%s' "$root_json" | jq -r '.[0].notes // "" | if . == "" then "" else (fromjson? // {}) | .today_bead.date // "" end' 2>/dev/null) || return 1
  [[ -n "$today_bead_date" ]] || return 1

  today=$(date +%F)
  if [[ "$today_bead_date" != "$today" ]]; then
    return 0  # rotation needed
  fi
  return 1  # up to date
}
```

- [ ] **Step 1.2: Run shellcheck on the new script**

```bash
shellcheck scripts/hooks/huddle-rotation-check.sh
```

Expected: no errors or warnings.

- [ ] **Step 1.3: Verify pnpm run check passes**

```bash
pnpm run check
```

Expected: all checks pass (shellcheck runs as part of the check suite).

- [ ] **Step 1.4: Commit**

```bash
git add scripts/hooks/huddle-rotation-check.sh
git commit -m "feat(workflow): implement real huddle-rotation-check.sh (PP-m4ki)"
```

---

## Task 2: Write huddle-bootstrap.sh

**Files:**

- Create: `scripts/hooks/huddle-bootstrap.sh`

Bootstrap is idempotent: re-running on an already-bootstrapped repo prints status and exits 0 without creating duplicate beads.

Flow:

1. Source `huddle-lib.sh`, resolve `STATE_DIR`.
2. Check if `config.json` already exists. If yes, verify the root bead is still open → print status and exit 0.
3. Create root epic: `bd create -t epic --title "Huddle coordination root" --description "..."` — capture ID.
4. Create today's daily bead as child: `bd create -t task --parent <root> --title "Huddle daily $(date +%F)"` — capture ID.
5. Create this month's monthly bead as child: `bd create -t task --parent <root> --title "Huddle monthly $(date +%Y-%m)"` — capture ID.
6. Build notes JSON (schema per §4.2 of the spec) and write it to the root bead: `bd update <root> --notes '<json>'`.
7. Write `config.json`: `{"schema_version":1,"root_bead_id":"<root>"}`.
8. Print success summary.

- [ ] **Step 2.1: Write huddle-bootstrap.sh**

```bash
#!/usr/bin/env bash
# shellcheck disable=SC2250  # unbraced $vars are consistent throughout this codebase
# huddle-bootstrap.sh — one-time initialization of the huddle coordination system.
#
# Creates:
#   - root epic bead (open forever, never closes)
#   - today's first daily bead (child of root)
#   - this month's first monthly bead (child of root)
#   - <STATE_DIR>/config.json with root_bead_id
#   - root bead notes JSON (§4.2 schema)
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
    # Verify root bead still exists and is open
    ROOT_STATUS=$(bd show "$ROOT_ID" --json 2>/dev/null | jq -r '.[0].status // "missing"' 2>/dev/null || echo "missing")
    if [[ "$ROOT_STATUS" != "missing" ]]; then
      printf 'Huddle already bootstrapped.\n'
      printf '  Root bead: %s (status: %s)\n' "$ROOT_ID" "$ROOT_STATUS"
      NOTES_JSON=$(bd show "$ROOT_ID" --json 2>/dev/null | jq -r '.[0].notes // ""' 2>/dev/null || echo "")
      if [[ -n "$NOTES_JSON" ]]; then
        TODAY_BEAD=$(printf '%s' "$NOTES_JSON" | python3 -c "import sys,json; n=json.load(sys.stdin); print(n.get('today_bead',{}).get('id','unknown'))" 2>/dev/null || echo "unknown")
        MONTHLY_BEAD=$(printf '%s' "$NOTES_JSON" | python3 -c "import sys,json; n=json.load(sys.stdin); print(n.get('monthly_bead',{}).get('id','unknown'))" 2>/dev/null || echo "unknown")
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

Historical archive: PP-cvh contains coordination activity prior to $(date +%Y-%m-%d).

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
printf 'Run `bash scripts/hooks/huddle-whoami.sh register <YourName> <session_id>` to register yourself.\n'
```

Save this to `scripts/hooks/huddle-bootstrap.sh`.

- [ ] **Step 2.2: Run shellcheck**

```bash
shellcheck scripts/hooks/huddle-bootstrap.sh
```

Expected: no errors or warnings.

- [ ] **Step 2.3: Smoke-test idempotency (dry run without a real bd)**

Run the script with `--dry-run` understanding that it will actually call `bd create` in a real environment. Instead, verify the script structure parses correctly:

```bash
bash -n scripts/hooks/huddle-bootstrap.sh
```

Expected: no syntax errors (bash -n parses without executing).

- [ ] **Step 2.4: Run pnpm run check**

```bash
pnpm run check
```

Expected: all checks pass.

- [ ] **Step 2.5: Commit**

```bash
git add scripts/hooks/huddle-bootstrap.sh
git commit -m "feat(workflow): add huddle-bootstrap.sh idempotent init (PP-m4ki)"
```

---

## Task 3: Write huddle-rotate.sh (phase A — shell atomic only)

**Files:**

- Create: `scripts/hooks/huddle-rotate.sh`

Phase A performs the atomic shell work: acquire lock, re-check date inside lock, create new beads, update root notes, post pointer comments, print old bead IDs to stdout. Phase B (LLM summarization) is NOT done in this script — it is dispatched separately as a subagent and documented in SKILL.md Task 7.

Lock strategy (same platform-detection pattern as `scripts/hooks/worktree-create.sh`): detect `lockf` (macOS) or `flock` (Linux) and use whichever is available, 60s timeout.

- [ ] **Step 3.1: Check worktree-create.sh for the exact lock pattern to copy**

```bash
grep -A 20 'lockf\|flock' scripts/hooks/worktree-create.sh | head -40
```

This shows the exact platform-detection pattern used by PP-bg45. Copy that pattern into rotate.sh.

- [ ] **Step 3.2: Write huddle-rotate.sh**

```bash
#!/usr/bin/env bash
# shellcheck disable=SC2250  # unbraced $vars are consistent throughout this codebase
# huddle-rotate.sh — daily coordination bead rotation (phase A: shell atomic).
#
# Phase A (this script) does the atomic shell work:
#   1. Acquire lock on <STATE_DIR>/rotation.lock (60s timeout)
#   2. Re-check date inside lock (exit 0 if peer already rotated)
#   3. Create new daily bead (+ monthly if month rolled) under root
#   4. Atomically update root notes JSON with new pointers
#   5. Post "→ continued in <new-bead>" comments on old beads (best-effort)
#   6. Print OLD_TODAY_ID (and OLD_MONTHLY_ID if rolled) to stdout
#
# Phase B (LLM summarization, closing, name-prune) is done by the dispatching
# subagent after reading phase A stdout. Template in SKILL.md §7.2 (rotation
# subagent dispatch).
#
# Crash-safety: steps 1-4 are the "make consistent" path. If the process dies
# between step 4 and step 6, root notes already point to new beads — system is
# consistent. Old bead has no summary, but the next rotation's subagent can
# back-fill it before proceeding.
#
# Usage:
#   output=$(bash scripts/hooks/huddle-rotate.sh)
#   OLD_TODAY_ID=$(printf '%s\n' "$output" | grep '^OLD_TODAY=' | cut -d= -f2)
#   OLD_MONTHLY_ID=$(printf '%s\n' "$output" | grep '^OLD_MONTHLY=' | cut -d= -f2)
#
# Exits 0 (no-op) if rotation is not needed (peer already rotated inside lock).

set -euo pipefail

for dep in jq bd python3; do
  command -v "$dep" >/dev/null 2>&1 || {
    printf 'huddle-rotate.sh: %s not found\n' "$dep" >&2
    exit 1
  }
done

LIB_SCRIPT="$(dirname "$0")/huddle-lib.sh"
[[ -f "$LIB_SCRIPT" ]] || { printf 'huddle-rotate.sh: huddle-lib.sh not found\n' >&2; exit 1; }
# shellcheck source=huddle-lib.sh disable=SC1091
source "$LIB_SCRIPT"
STATE_DIR=$(huddle_state_dir) || { printf 'huddle-rotate.sh: not in a git checkout\n' >&2; exit 1; }

CONFIG_FILE="$STATE_DIR/config.json"
[[ -f "$CONFIG_FILE" ]] || { printf 'huddle-rotate.sh: not bootstrapped — run huddle-bootstrap.sh first\n' >&2; exit 1; }

ROOT_ID=$(jq -r '.root_bead_id // ""' "$CONFIG_FILE" 2>/dev/null)
[[ -n "$ROOT_ID" ]] || { printf 'huddle-rotate.sh: config.json missing root_bead_id\n' >&2; exit 1; }

LOCK_FILE="$STATE_DIR/rotation.lock"

# Platform-detected locking (same pattern as worktree-create.sh PP-bg45).
# lockf(1) on macOS, flock(1) on Linux. Both provide exclusive lock with timeout.
if command -v lockf >/dev/null 2>&1; then
  # macOS: lockf -t <timeout> <file> <cmd> [args...]
  _run_locked() {
    lockf -t 60 "$LOCK_FILE" bash -c "$1"
  }
elif command -v flock >/dev/null 2>&1; then
  # Linux: flock -x -w <timeout> <file> <cmd> [args...]
  _run_locked() {
    flock -x -w 60 "$LOCK_FILE" bash -c "$1"
  }
else
  printf 'huddle-rotate.sh: neither lockf nor flock found — cannot safely rotate\n' >&2
  exit 1
fi

# The rotation body runs inside the lock. We pass it as a here-string through
# bash -c so the lock covers the entire operation atomically.
# Variables needed inside the locked body are exported first.
export ROOT_ID STATE_DIR CONFIG_FILE

ROTATION_OUTPUT=$(_run_locked '
set -euo pipefail

# Re-check date inside the lock (idempotency: peer may have rotated first)
ROOT_JSON=$(bd show "$ROOT_ID" --json 2>/dev/null) || exit 0
NOTES_STR=$(printf "%s" "$ROOT_JSON" | jq -r ".[0].notes // \"\"" 2>/dev/null) || exit 0
[[ -n "$NOTES_STR" ]] || { printf "huddle-rotate.sh: root bead has no notes — was bootstrap run?\n" >&2; exit 1; }

TODAY_BEAD_DATE=$(printf "%s" "$NOTES_STR" | python3 -c "
import sys, json
n = json.load(sys.stdin)
print(n.get(\"today_bead\", {}).get(\"date\", \"\"))
" 2>/dev/null) || exit 0

TODAY=$(date +%F)
if [[ "$TODAY_BEAD_DATE" == "$TODAY" ]]; then
  # Peer already rotated — no-op
  exit 0
fi

# Parse current pointers from notes
OLD_TODAY_ID=$(printf "%s" "$NOTES_STR" | python3 -c "
import sys, json
n = json.load(sys.stdin)
print(n.get(\"today_bead\", {}).get(\"id\", \"\"))
" 2>/dev/null)
OLD_MONTHLY_ID=$(printf "%s" "$NOTES_STR" | python3 -c "
import sys, json
n = json.load(sys.stdin)
print(n.get(\"monthly_bead\", {}).get(\"id\", \"\"))
" 2>/dev/null)
OLD_MONTH=$(printf "%s" "$NOTES_STR" | python3 -c "
import sys, json
n = json.load(sys.stdin)
print(n.get(\"monthly_bead\", {}).get(\"month\", \"\"))
" 2>/dev/null)
RECENT_DAILIES=$(printf "%s" "$NOTES_STR" | python3 -c "
import sys, json
n = json.load(sys.stdin)
print(json.dumps(n.get(\"recent_dailies\", [])))
" 2>/dev/null)
SETTINGS=$(printf "%s" "$NOTES_STR" | python3 -c "
import sys, json
n = json.load(sys.stdin)
print(json.dumps(n.get(\"settings\", {\"n_dailies_to_inject\": 5, \"day_boundary_tz\": \"local\", \"stale_name_cutoff_days\": 14})))
" 2>/dev/null)

CURRENT_MONTH=$(date +%Y-%m)
MONTH_ROLLED=0
if [[ "$OLD_MONTH" != "$CURRENT_MONTH" ]]; then
  MONTH_ROLLED=1
fi

# Create new daily bead (orphan — not live until root notes updated)
NEW_TODAY_ID=$(bd create -t task \
  --parent "$ROOT_ID" \
  --title "Huddle daily $TODAY" \
  --description "Active coordination bead for $TODAY. Agents post updates here. At midnight rotation this bead gets a categorized summary and closes." \
  --silent)

NEW_MONTHLY_ID="$OLD_MONTHLY_ID"
if [[ "$MONTH_ROLLED" -eq 1 ]]; then
  NEW_MONTHLY_ID=$(bd create -t task \
    --parent "$ROOT_ID" \
    --title "Huddle monthly $CURRENT_MONTH" \
    --description "Monthly coordination summary for $CURRENT_MONTH. Receives aggregated summaries of daily beads when they close." \
    --silent)
fi

NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Build new recent_dailies: prepend new today entry, cap at 20
NEW_RECENT=$(python3 -c "
import sys, json
existing = json.loads(sys.argv[1])
new_entry = {\"id\": sys.argv[2], \"date\": sys.argv[3]}
combined = [new_entry] + existing
print(json.dumps(combined[:20]))
" "$RECENT_DAILIES" "$NEW_TODAY_ID" "$TODAY")

# Build new notes JSON
NEW_NOTES=$(python3 -c "
import sys, json
notes = {
    \"schema_version\": 1,
    \"today_bead\": {\"id\": sys.argv[1], \"date\": sys.argv[2]},
    \"monthly_bead\": {\"id\": sys.argv[3], \"month\": sys.argv[4]},
    \"recent_dailies\": json.loads(sys.argv[5]),
    \"settings\": json.loads(sys.argv[6]),
    \"last_rotation\": sys.argv[7]
}
print(json.dumps(notes))
" "$NEW_TODAY_ID" "$TODAY" "$NEW_MONTHLY_ID" "$CURRENT_MONTH" "$NEW_RECENT" "$SETTINGS" "$NOW")

# ATOMIC: update root pointers — after this, system is consistent
bd update "$ROOT_ID" --notes "$NEW_NOTES"

# Post continuation comments on old beads (best-effort: failures do not abort)
if [[ -n "$OLD_TODAY_ID" ]]; then
  bd comments add "$OLD_TODAY_ID" "→ continued in $NEW_TODAY_ID (rotation $(date +%F))" 2>/dev/null || true
fi
if [[ "$MONTH_ROLLED" -eq 1 ]] && [[ -n "$OLD_MONTHLY_ID" ]]; then
  bd comments add "$OLD_MONTHLY_ID" "→ continued in $NEW_MONTHLY_ID (month rolled to $CURRENT_MONTH)" 2>/dev/null || true
fi

# Output old bead IDs for phase B (LLM summarization)
printf "OLD_TODAY=%s\n" "$OLD_TODAY_ID"
if [[ "$MONTH_ROLLED" -eq 1 ]]; then
  printf "OLD_MONTHLY=%s\n" "$OLD_MONTHLY_ID"
  printf "OLD_MONTH=%s\n" "$OLD_MONTH"
fi
printf "NEW_TODAY=%s\n" "$NEW_TODAY_ID"
printf "NEW_MONTHLY=%s\n" "$NEW_MONTHLY_ID"
printf "ROTATION_DATE=%s\n" "$TODAY"
')

# Print phase A output to stdout (phase B subagent reads this)
printf '%s\n' "$ROTATION_OUTPUT"
```

Save to `scripts/hooks/huddle-rotate.sh`.

- [ ] **Step 3.3: Run shellcheck**

```bash
shellcheck scripts/hooks/huddle-rotate.sh
```

Expected: no errors or warnings. If shellcheck complains about variables inside the `bash -c` heredoc body (passed as a string literal), those are in a string — they're intentional. Address any real issues.

- [ ] **Step 3.4: Verify bash syntax**

```bash
bash -n scripts/hooks/huddle-rotate.sh
```

Expected: no syntax errors.

- [ ] **Step 3.5: Run pnpm run check**

```bash
pnpm run check
```

Expected: all checks pass.

- [ ] **Step 3.6: Commit**

```bash
git add scripts/hooks/huddle-rotate.sh
git commit -m "feat(workflow): add huddle-rotate.sh phase-A atomic rotation (PP-m4ki)"
```

---

## Task 4: Update huddle-poll.sh to read today_bead from config

**Files:**

- Modify: `scripts/hooks/huddle-poll.sh`

Two changes:

1. After state-dir resolution, check if `config.json` exists. If not, exit 0 silently (SessionStart handles the user-visible bootstrap notice).
2. Replace `bd comments PP-cvh --json` (line ~204) with: read `today_bead.id` from `config.json` → root notes, then `bd comments <today_bead_id> --json`.
3. Update the "rotation needed" output branch to emit the full §7.2 template (not the stub placeholder).
4. Update the comment at the top of the output block from `## New PP-cvh coordination comments (N)` to `## New huddle coordination comments (N)` (removing the hardcoded PP-cvh reference).

- [ ] **Step 4.1: Read the current huddle-poll.sh to identify the exact lines to change**

Re-read `scripts/hooks/huddle-poll.sh` lines 144–260 to confirm exact text before editing.

- [ ] **Step 4.2: Replace the hardcoded PP-cvh fetch and add bootstrap check**

After the `STATE_DIR` resolution and `mkdir -p "$STATE_DIR"` block (around line 182), add a bootstrap check:

```bash
# --- Bootstrap check ---
# If config.json is missing, the system hasn't been bootstrapped yet.
# Exit silently — huddle-session-start.sh emits the user-visible bootstrap notice.
CONFIG_FILE="$STATE_DIR/config.json"
if [[ ! -f "$CONFIG_FILE" ]]; then
  exit 0
fi
ROOT_ID=$(jq -r '.root_bead_id // ""' "$CONFIG_FILE" 2>/dev/null)
if [[ -z "$ROOT_ID" ]]; then
  exit 0
fi
```

Then replace the rotation needed output (around line 149–156) with the full §7.2 template:

```bash
  if huddle_rotation_needed; then
    STORED_DATE=""
    if [[ -f "$CONFIG_FILE" ]]; then
      NOTES_STR=$(bd show "$ROOT_ID" --json 2>/dev/null | jq -r '.[0].notes // ""' 2>/dev/null || echo "")
      if [[ -n "$NOTES_STR" ]]; then
        STORED_DATE=$(printf '%s' "$NOTES_STR" | python3 -c "
import sys, json
try:
    n = json.loads(sys.stdin.read())
    print(n.get('today_bead', {}).get('date', ''))
except Exception:
    print('')
" 2>/dev/null || echo "")
      fi
    fi
    NOW_DATE=$(date +%F)
    printf '## ⚠️ Huddle rotation needed\n\n'
    printf 'The active coordination bead points to date %s, but today is %s.\n' "$STORED_DATE" "$NOW_DATE"
    printf 'Before continuing, dispatch the rotation subagent.\n\n'
    printf 'See .agents/skills/pinpoint-huddle/SKILL.md for the dispatch template.\n'
    exit 0
  fi
```

Then replace the hardcoded `bd comments PP-cvh --json` line (~line 204) and update the output header:

Old line:

```bash
COMMENTS_JSON="$(bd comments PP-cvh --json 2>/dev/null)" || { exit 0; }
```

New — read `today_bead.id` from root notes:

```bash
# Read today_bead.id from root notes
ROOT_JSON=$(bd show "$ROOT_ID" --json 2>/dev/null) || { exit 0; }
NOTES_STR=$(printf '%s' "$ROOT_JSON" | jq -r '.[0].notes // ""' 2>/dev/null) || { exit 0; }
[[ -n "$NOTES_STR" ]] || { exit 0; }
TODAY_BEAD_ID=$(printf '%s' "$NOTES_STR" | python3 -c "
import sys, json
try:
    n = json.loads(sys.stdin.read())
    print(n.get('today_bead', {}).get('id', ''))
except Exception:
    print('')
" 2>/dev/null) || { exit 0; }
[[ -n "$TODAY_BEAD_ID" ]] || { exit 0; }

COMMENTS_JSON="$(bd comments "$TODAY_BEAD_ID" --json 2>/dev/null)" || { exit 0; }
```

And update the output header (line ~256):
Old:

```bash
printf '## New PP-cvh coordination comments (%d)\n\n' "$COUNT"
```

New:

```bash
printf '## New huddle coordination comments (%d)\n\n' "$COUNT"
```

- [ ] **Step 4.3: Run shellcheck**

```bash
shellcheck scripts/hooks/huddle-poll.sh
```

Expected: no errors.

- [ ] **Step 4.4: Run pnpm run check**

```bash
pnpm run check
```

Expected: all checks pass.

- [ ] **Step 4.5: Commit**

```bash
git add scripts/hooks/huddle-poll.sh
git commit -m "feat(workflow): wire huddle-poll.sh to today_bead from config (PP-m4ki)"
```

---

## Task 5: Update huddle-session-start.sh with bootstrap-needed branch and summary injection

**Files:**

- Modify: `scripts/hooks/huddle-session-start.sh`

Three changes:

1. After subagent skip and before the rotation check, add a bootstrap-needed branch: if `config.json` is missing (or `root_bead_id` is blank), emit the §7.1 "bootstrap needed" notice and exit.
2. Replace the rotation needed stub output (lines ~81-87) with the full §7.2 template (matching what huddle-poll.sh uses).
3. After the identity announcement (before the final `exit 0`), add summary injection (§5.1 step 5): read `monthly_bead.id` and `recent_dailies` from root notes, fetch their descriptions, emit them as context. Suppressed if `source == "compact"` (already suppressed via the early-exit at line ~113).

- [ ] **Step 5.1: Locate the exact insertion points**

Re-read `scripts/hooks/huddle-session-start.sh`. The bootstrap-needed block goes right after `mkdir -p "$STATE_DIR"` (line 49) and before the rotation check (line 75).

- [ ] **Step 5.2: Add bootstrap-needed branch**

After the `mkdir -p "$STATE_DIR"` line (line 49), insert:

```bash
# --- Bootstrap check ---
CONFIG_FILE="$STATE_DIR/config.json"
ROOT_ID=""
if [[ ! -f "$CONFIG_FILE" ]]; then
  printf '## ⚠️ Huddle not bootstrapped\n\n'
  printf 'The huddle coordination system is not set up yet. It maintains a daily bead\n'
  printf 'for agents to coordinate on, summarizes each day'\''s chatter into ~50-token\n'
  printf 'digests so it stays cheap to read, and rotates at local midnight.\n\n'
  printf 'To bootstrap, run:\n'
  printf '    bash scripts/hooks/huddle-bootstrap.sh\n\n'
  printf 'That creates the root bead, today'\''s daily, this month'\''s monthly, and writes\n'
  MAIN_ROOT=$(git rev-parse --git-common-dir 2>/dev/null | xargs -I{} dirname {} 2>/dev/null || echo "<main-worktree>")
  printf '%s/.agents/huddle/config.json with the IDs. Re-running is safe.\n' "$MAIN_ROOT"
  exit 0
fi
ROOT_ID=$(jq -r '.root_bead_id // ""' "$CONFIG_FILE" 2>/dev/null)
if [[ -z "$ROOT_ID" ]]; then
  # Corrupt config — treat as not bootstrapped
  printf '## ⚠️ Huddle not bootstrapped\n\n'
  printf 'config.json exists but has no root_bead_id. Re-run:\n'
  printf '    bash scripts/hooks/huddle-bootstrap.sh\n'
  exit 0
fi
```

- [ ] **Step 5.3: Replace rotation-needed stub with full template**

Replace lines ~81-87:

```bash
    # Real "rotation needed" output lands in the follow-up PR. For now this
    # branch is unreachable (stub returns 1).
    printf '## ⚠️ Huddle rotation needed\n\n'
    printf 'See docs/superpowers/specs/2026-05-17-huddle-system-design.md §7.2\n'
    exit 0
```

With:

```bash
    STORED_DATE=""
    NOTES_STR=$(bd show "$ROOT_ID" --json 2>/dev/null | jq -r '.[0].notes // ""' 2>/dev/null || echo "")
    if [[ -n "$NOTES_STR" ]]; then
      STORED_DATE=$(printf '%s' "$NOTES_STR" | python3 -c "
import sys, json
try:
    n = json.loads(sys.stdin.read())
    print(n.get('today_bead', {}).get('date', ''))
except Exception:
    print('')
" 2>/dev/null || echo "")
    fi
    NOW_DATE=$(date +%F)
    printf '## ⚠️ Huddle rotation needed\n\n'
    printf 'The active coordination bead points to date %s, but today is %s.\n' "$STORED_DATE" "$NOW_DATE"
    printf 'Before continuing, dispatch the rotation subagent — it will summarize\n'
    printf 'the previous day, create today'\''s bead, update pointers, and post\n'
    printf '"continued in" markers on closed beads.\n\n'
    printf 'Dispatch template in .agents/skills/pinpoint-huddle/SKILL.md.\n'
    exit 0
```

- [ ] **Step 5.4: Add summary injection after identity block**

After the closing `fi` of the identity block (after line ~151 where the `else` branch ends, before the final `exit 0`), add:

```bash
# --- Summary injection (§5.1 step 5) ---
# Inject monthly summary + N most-recent daily bead descriptions.
# Suppressed on compact (already returned early above).
# Fails open: any bd error exits silently, not noisily.
ROOT_JSON=$(bd show "$ROOT_ID" --json 2>/dev/null) || { exit 0; }
NOTES_STR=$(printf '%s' "$ROOT_JSON" | jq -r '.[0].notes // ""' 2>/dev/null) || { exit 0; }
if [[ -z "$NOTES_STR" ]]; then
  exit 0
fi

N_DAILIES=$(printf '%s' "$NOTES_STR" | python3 -c "
import sys, json
try:
    n = json.loads(sys.stdin.read())
    print(n.get('settings', {}).get('n_dailies_to_inject', 5))
except Exception:
    print(5)
" 2>/dev/null || echo "5")

MONTHLY_BEAD_ID=$(printf '%s' "$NOTES_STR" | python3 -c "
import sys, json
try:
    n = json.loads(sys.stdin.read())
    print(n.get('monthly_bead', {}).get('id', ''))
except Exception:
    print('')
" 2>/dev/null || echo "")

RECENT_DAILIES=$(printf '%s' "$NOTES_STR" | python3 -c "
import sys, json
try:
    n = json.loads(sys.stdin.read())
    items = n.get('recent_dailies', [])
    for item in items:
        print(item.get('id', '') + '\t' + item.get('date', ''))
except Exception:
    pass
" 2>/dev/null || echo "")

# Only emit the summary block if we have something to show
HAS_CONTENT=0

if [[ -n "$MONTHLY_BEAD_ID" ]]; then
  MONTHLY_DESC=$(bd show "$MONTHLY_BEAD_ID" --json 2>/dev/null | jq -r '.[0].description // ""' 2>/dev/null || echo "")
  if [[ -n "$MONTHLY_DESC" && "$MONTHLY_DESC" != "null" ]]; then
    HAS_CONTENT=1
  fi
fi

if [[ -n "$RECENT_DAILIES" ]]; then
  # Quick check — if we can read at least one daily, we have content
  FIRST_ID=$(printf '%s\n' "$RECENT_DAILIES" | head -1 | cut -f1)
  if [[ -n "$FIRST_ID" ]]; then
    HAS_CONTENT=1
  fi
fi

if [[ "$HAS_CONTENT" -eq 0 ]]; then
  exit 0
fi

printf '\n## Huddle recent activity\n\n'

if [[ -n "$MONTHLY_BEAD_ID" && -n "${MONTHLY_DESC:-}" && "$MONTHLY_DESC" != "null" ]]; then
  MONTHLY_TITLE=$(bd show "$MONTHLY_BEAD_ID" --json 2>/dev/null | jq -r '.[0].title // ""' 2>/dev/null || echo "Monthly summary")
  printf '### %s\n\n%s\n\n' "$MONTHLY_TITLE" "$MONTHLY_DESC"
fi

if [[ -n "$RECENT_DAILIES" ]]; then
  DAILY_COUNT=0
  while IFS=$'\t' read -r daily_id daily_date; do
    [[ -z "$daily_id" ]] && continue
    [[ "$DAILY_COUNT" -ge "$N_DAILIES" ]] && break
    DAILY_DESC=$(bd show "$daily_id" --json 2>/dev/null | jq -r '.[0].description // ""' 2>/dev/null || echo "")
    if [[ -n "$DAILY_DESC" && "$DAILY_DESC" != "null" ]]; then
      printf '### Daily %s (%s)\n\n%s\n\n' "$daily_date" "$daily_id" "$DAILY_DESC"
    fi
    DAILY_COUNT=$(( DAILY_COUNT + 1 ))
  done <<< "$RECENT_DAILIES"
fi
```

- [ ] **Step 5.5: Run shellcheck**

```bash
shellcheck scripts/hooks/huddle-session-start.sh
```

Expected: no errors.

- [ ] **Step 5.6: Verify bash syntax**

```bash
bash -n scripts/hooks/huddle-session-start.sh
```

Expected: no syntax errors.

- [ ] **Step 5.7: Run pnpm run check**

```bash
pnpm run check
```

Expected: all checks pass.

- [ ] **Step 5.8: Commit**

```bash
git add scripts/hooks/huddle-session-start.sh
git commit -m "feat(workflow): bootstrap-needed + summary injection in session-start (PP-m4ki)"
```

---

## Task 6: Update the spec — replace .claude/huddle/ with .agents/huddle/

**Files:**

- Modify: `docs/superpowers/specs/2026-05-17-huddle-system-design.md`

The spec was written before PR #1390 moved state from `.claude/huddle/` to `.agents/huddle/`. Replace all occurrences. Also update §8.1 mapping storage path (`.claude/huddle/session-names.json` → `.agents/huddle/session-names.json`).

- [ ] **Step 6.1: Find all occurrences of the old path**

```bash
grep -n '\.claude/huddle' docs/superpowers/specs/2026-05-17-huddle-system-design.md
```

This shows every line that needs updating.

- [ ] **Step 6.2: Replace all occurrences (use rg/sed or Edit tool)**

Replace every instance of `.claude/huddle/` with `.agents/huddle/` in the spec file. Also update the §2 state list which says `<main-worktree>/.claude/huddle/` → `<main-worktree>/.agents/huddle/`.

Also: update §4.3 header from `(<main-worktree>/.claude/huddle/config.json)` to `(<main-worktree>/.agents/huddle/config.json)`.

Also update §7.1 bootstrap notice template (which has the config path in example text) to use `.agents/huddle/config.json`.

- [ ] **Step 6.3: Verify no .claude/huddle references remain**

```bash
grep -c '\.claude/huddle' docs/superpowers/specs/2026-05-17-huddle-system-design.md
```

Expected: `0`.

- [ ] **Step 6.4: Run pnpm run check**

```bash
pnpm run check
```

Expected: all checks pass.

- [ ] **Step 6.5: Commit**

```bash
git add docs/superpowers/specs/2026-05-17-huddle-system-design.md
git commit -m "docs(spec): update huddle spec paths .claude/ -> .agents/ (PP-m4ki)"
```

---

## Task 7: Update SKILL.md with bootstrap, rotation, and dispatch template

**Files:**

- Modify: `.agents/skills/pinpoint-huddle/SKILL.md`

Rewrite the SKILL.md to reflect the full implemented system. Key additions:

1. Update description/frontmatter to remove PP-cvh references and mention the bead hierarchy.
2. Add a "Bootstrap" section: when to run it, what it creates, idempotency.
3. Add a "Rotation subagent dispatch" section (§7.2 template): exact `Agent({...})` call pattern, what the subagent should do for phase B (summarize old bead → write description → write notes → close → prune names).
4. Update "Scripts" table to include the two new scripts.
5. Update "State files" table — change `.claude/huddle/` to `.agents/huddle/`.
6. Update "How to post coordination updates" to use `today_bead.id` from config instead of `PP-cvh`.
7. Remove the "What this PR doesn't yet include" section.

- [ ] **Step 7.1: Write the updated SKILL.md**

Write the full updated content. Key sections:

**Frontmatter** — update description to mention daily rotation and root bead hierarchy.

**Bootstrap section** (new, after "What you'll see at session start"):

```markdown
## Bootstrap

The huddle system must be bootstrapped once per local clone before it activates.
If you see the "not bootstrapped" notice at session start, run:

    bash scripts/hooks/huddle-bootstrap.sh

This creates:

- A root epic bead (permanent — never closes)
- Today's daily bead (child of root — accepts coordination comments)
- This month's monthly bead (child of root — collects daily summaries)
- `.agents/huddle/config.json` with the root bead ID

Re-running is safe — it's a no-op if already bootstrapped.
```

**Rotation needed section** (new, after "What you'll see at session start"):

````markdown
## Rotation needed

When the `today_bead.date` in root notes doesn't match today's local date, hooks
emit a "rotation needed" notice. **You must dispatch a rotation subagent before
continuing your work.** Use this exact dispatch:

    Agent({
      subagent_type: "claude",
      model: "claude-sonnet-4-5",
      prompt: "<see §7.2 template below>"
    })

### Rotation subagent prompt template (§7.2)

Paste this as the subagent's `prompt`:

---

You are the huddle rotation subagent. Your job is to rotate the daily coordination bead.

**Phase A (run the shell script):**

```bash
output=$(bash scripts/hooks/huddle-rotate.sh)
echo "$output"
```
````

Parse the output for:

- `OLD_TODAY=<id>` — yesterday's daily bead
- `OLD_MONTHLY=<id>` — last month's monthly bead (only if month rolled)
- `NEW_TODAY=<id>` — today's fresh daily bead
- `NEW_MONTHLY=<id>` — current monthly bead

If the script exits 0 with no output, a peer already rotated — exit immediately (rotation was a no-op).

**Phase B (LLM summarization — do this only if phase A produced OLD_TODAY):**

1. Fetch OLD_TODAY's comments: `bd comments <OLD_TODAY> --json`
2. Write a tight categorized summary into OLD_TODAY's description:
   - Categories: Merged/Ships, In-flight, Discoveries, Blockers
   - ~30-50 tokens per category; omit empty categories
   - Format: markdown bullet list per category
   - Run: `bd update <OLD_TODAY> --description "<summary>"`
3. Archive raw comments into OLD_TODAY's notes (for forensics):
   - Format: JSON array of {author, created_at, text}
   - Run: `bd update <OLD_TODAY> --notes '<json-array>'`
4. Close OLD_TODAY: `bd close <OLD_TODAY>`
5. If month rolled (OLD_MONTHLY present):
   - Fetch OLD_MONTHLY's comments (or read recent daily descriptions for the month)
   - Write monthly summary into OLD_MONTHLY's description
   - Close OLD_MONTHLY: `bd close <OLD_MONTHLY>`
6. Prune stale session names (§8.4):
   - Read `.agents/huddle/session-names.json`
   - For each entry, scan the last 14 days of huddle content for `—<name>` or `—Claude-<name>`
   - Evict entries with no match in 14 days; write the pruned map back

## After phase B, report: "Rotation complete. OLD_TODAY=<id> closed. NEW_TODAY=<id> active."

````

**Scripts table** — add `huddle-bootstrap.sh` and `huddle-rotate.sh` rows.

**State files** — change `.claude/huddle/` → `.agents/huddle/` throughout.

**How to post** — update from `bd comments add PP-cvh "..."` to:
```markdown
Use `bd comments add <today_bead_id> "..."` with your sign-off. To find today's bead ID:
    bd show $(jq -r '.root_bead_id' "$(bash scripts/hooks/huddle-lib.sh | ...)")
````

Or simpler: hook output already shows the today_bead ID at rotation time.

Remove the "What this PR doesn't yet include" section entirely.

- [ ] **Step 7.2: Run pnpm run check**

```bash
pnpm run check
```

Expected: all checks pass.

- [ ] **Step 7.3: Commit**

```bash
git add .agents/skills/pinpoint-huddle/SKILL.md
git commit -m "docs(skill): update pinpoint-huddle SKILL.md with rotation lifecycle (PP-m4ki)"
```

---

## Task 8: Final integration check and PR open

**Files:** None (verification + PR)

- [ ] **Step 8.1: Run the full check suite**

```bash
pnpm run check
```

Expected: all checks pass including shellcheck on all modified/created scripts.

- [ ] **Step 8.2: Verify shellcheck on all new/modified scripts**

```bash
shellcheck scripts/hooks/huddle-bootstrap.sh \
           scripts/hooks/huddle-rotate.sh \
           scripts/hooks/huddle-rotation-check.sh \
           scripts/hooks/huddle-poll.sh \
           scripts/hooks/huddle-session-start.sh
```

Expected: no errors.

- [ ] **Step 8.3: Verify spec paths updated**

```bash
grep -c '\.claude/huddle' docs/superpowers/specs/2026-05-17-huddle-system-design.md
```

Expected: `0`.

- [ ] **Step 8.4: Verify SKILL.md no longer mentions PP-cvh as the active bead**

```bash
grep 'PP-cvh' .agents/skills/pinpoint-huddle/SKILL.md
```

Expected: any remaining references should be in the historical archive context only (e.g. "PP-cvh contains activity prior to..."), not as the active coordination target.

- [ ] **Step 8.5: Open PR via pinpoint-pr-workflow skill**

Use the `pinpoint-pr-workflow` skill to push the branch, open the PR, and start CI monitoring.

PR title: `feat(workflow): huddle rotation — daily bead hierarchy + bootstrap (PP-m4ki)`

PR body should summarize:

- Implements `huddle-bootstrap.sh` (idempotent init: root epic + daily + monthly + config.json)
- Implements `huddle-rotate.sh` phase A (atomic shell: lock + recheck + create beads + update root notes)
- Replaces `huddle-rotation-check.sh` stub with real date-compare
- Wires `huddle-poll.sh` and `huddle-session-start.sh` to read `today_bead.id` from config instead of hardcoded PP-cvh
- Adds summary injection to session-start (monthly desc + N recent daily descs)
- Updates `SKILL.md` with bootstrap + rotation subagent dispatch template
- Updates spec paths from `.claude/huddle/` to `.agents/huddle/`

- [ ] **Step 8.6: After CI green + Copilot review, merge via gate enforcer**

```bash
bash scripts/workflow/merge-pr.sh <PR_NUMBER>
```

- [ ] **Step 8.7: After merge, post PP-cvh merge notice**

```bash
# Register as rotation implementer if not already
bash scripts/hooks/huddle-whoami.sh register Claude-RotationImpl <session_id>

# Post merge notice to today's bead (or PP-cvh until bootstrap runs post-merge)
bd comments add PP-cvh "Merged PR #<N> (PP-m4ki): huddle rotation — daily bead hierarchy, bootstrap, phase-A rotate, hooks wired to config. Bootstrap with \`bash scripts/hooks/huddle-bootstrap.sh\`. —Claude-RotationImpl"
```

- [ ] **Step 8.8: Close PP-m4ki**

```bash
bd close PP-m4ki
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement                                                                                   | Task                                                      |
| -------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `huddle-bootstrap.sh` — create root + daily + monthly + config.json, idempotent                    | Task 2                                                    |
| `huddle-rotation-check.sh` — real date compare                                                     | Task 1                                                    |
| `huddle-rotate.sh` — phase A atomic (lock + recheck + create + update pointers + pointer comments) | Task 3                                                    |
| `huddle-rotate.sh` — phase B via subagent template in SKILL.md                                     | Task 7                                                    |
| `huddle-poll.sh` — replace PP-cvh with today_bead.id from config                                   | Task 4                                                    |
| `huddle-session-start.sh` — bootstrap-needed branch (§7.1)                                         | Task 5                                                    |
| `huddle-session-start.sh` — summary injection (§5.1 step 5)                                        | Task 5                                                    |
| SKILL.md — document bootstrap, rotation, dispatch template                                         | Task 7                                                    |
| Spec paths `.claude/` → `.agents/`                                                                 | Task 6                                                    |
| PP-cvh stays open as historical archive (no close)                                                 | Task 8 step 8.7 (comment only)                            |
| shellcheck clean                                                                                   | Tasks 1–5 step N.3, Task 8 step 8.2                       |
| pnpm run check passes                                                                              | All tasks                                                 |
| Migration: new root carries "historical archive" pointer                                           | Task 2 (bootstrap creates root description with the text) |

All acceptance criteria from PP-m4ki are covered.

**Notes on phase B (LLM summarization):**
Per the bead description's "Script-vs-LLM responsibility split", phase B (summarize old bead, archive, close, name-prune) cannot be done in shell. Task 3 outputs OLD_TODAY/OLD_MONTHLY IDs on stdout; the dispatch template in Task 7 tells the rotation subagent what to do with them. This is the correct split.

**Concurrency and crash-safety:**

- Lock acquisition is 60s timeout (same as spec §6 step 1)
- Re-check inside lock prevents double rotation (§9.4)
- Phase A exits if root notes say today_bead.date is already today
- If crash between step 4 and 6 of phase A: root notes are consistent (new bead is live); old bead lacks pointer comment only — next rotation will still see the old bead closed without summary and can back-fill (spec §9.5)
