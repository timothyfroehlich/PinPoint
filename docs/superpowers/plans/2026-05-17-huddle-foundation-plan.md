# Huddle Foundation Implementation Plan

> **Post-implementation note:** This plan as-written assumed state lived at
> `~/.config/pinpoint/huddle-*`. During Task 7's review pass, the state
> location was refactored to `<main-worktree>/.claude/huddle/` with
> unprefixed filenames (`session-names.json`, `last-seen-<hash>`,
> `config.json`, `rotation.lock`). See commit `ba80786e` and the updated
> design spec / SKILL.md for the shipped layout. The plan body below is
> preserved as a historical record of the original approach.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the foundation portion of the huddle coordination system (PR #1357): rename the current `cvh-*` plumbing to `huddle-*`, add subagent-skip guards, introduce the rotation-check helper as a stub, ship self-documenting hooks, and package the system as a project skill.

**Architecture:** All work stays on branch `feat/cvh-poll-hook-PP-bgj9`. The branch is later renamed (or the PR title is updated) to reflect the new name; commits are squashed at merge time. The renamed scripts continue to live under `scripts/hooks/`. The new `huddle-rotation-check.sh` is a no-op stub returning "no rotation needed" — it exists so both hooks can `source` it without changing their integration point when the real rotation logic ships in the follow-up PR. Self-documenting hooks reference a new project skill at `.agent/skills/pinpoint-huddle/SKILL.md`.

**Tech Stack:** Bash 3.2+ (macOS default), Python 3 (already used for JSON parsing), `jq`, `bd` (PinPoint's beads issue tracker), `shellcheck`.

---

## Working assumptions

- Current branch is `feat/cvh-poll-hook-PP-bgj9` at HEAD `39658677` (after the spec commits).
- The existing scripts (`scripts/hooks/cvh-poll.sh`, `cvh-session-start.sh`, `cvh-whoami.sh`) work and have already passed Copilot review.
- User-level live test installation exists at `~/.claude/hooks/cvh-*.sh` and `~/.claude/settings.json` (per Tim's authorization). These need to be updated in lockstep with the project-level rename so the live PP-cvh polling keeps working through the rename.
- `~/.config/pinpoint/cvh-session-names.json` contains real session→name mappings (Slingshot, Spinner, Plunger). The rename must preserve this data.
- No new tests are added at the unit-test level for hooks (they're bash scripts with no test harness in this repo). "Tests" are smoke tests: pipe a mock payload, verify stdout/exit code.

---

## Task 1: Bulk rename cvh-_ → huddle-_ (scripts + settings + config files + bd memory + user-level)

**Files:**

- Rename: `scripts/hooks/cvh-poll.sh` → `scripts/hooks/huddle-poll.sh`
- Rename: `scripts/hooks/cvh-session-start.sh` → `scripts/hooks/huddle-session-start.sh`
- Rename: `scripts/hooks/cvh-whoami.sh` → `scripts/hooks/huddle-whoami.sh`
- Modify: `.claude/settings.json` (hook command paths)
- Rename: `~/.claude/hooks/cvh-poll.sh` → `~/.claude/hooks/huddle-poll.sh`
- Rename: `~/.claude/hooks/cvh-session-start.sh` → `~/.claude/hooks/huddle-session-start.sh`
- Rename: `~/.claude/hooks/cvh-whoami.sh` → `~/.claude/hooks/huddle-whoami.sh`
- Modify: `~/.claude/settings.json` (hook command paths)
- Rename: `~/.config/pinpoint/cvh-session-names.json` → `~/.config/pinpoint/huddle-session-names.json`
- Rename: `~/.config/pinpoint/cvh-last-seen-*` → `~/.config/pinpoint/huddle-last-seen-*`
- Modify: bd memory key `reference-cvh-coordination-hooks` → `reference-huddle-coordination-hooks`

This is a mechanical rename. No behavior changes. All `cvh-*` text references inside the scripts (comments, error messages, header docs) also change to `huddle-*`.

- [ ] **Step 1.1: Snapshot the live config file state**

Run:

```bash
ls -la ~/.config/pinpoint/ > /tmp/huddle-rename-pre.txt
cat ~/.config/pinpoint/cvh-session-names.json
```

Capture the names map — we'll verify it survives the rename.

- [ ] **Step 1.2: git-mv the three project scripts**

Run (from the worktree root):

```bash
git mv scripts/hooks/cvh-poll.sh         scripts/hooks/huddle-poll.sh
git mv scripts/hooks/cvh-session-start.sh scripts/hooks/huddle-session-start.sh
git mv scripts/hooks/cvh-whoami.sh        scripts/hooks/huddle-whoami.sh
```

- [ ] **Step 1.3: Replace every `cvh-` and `cvh_` reference inside the renamed scripts**

Strings to replace in each of the three renamed scripts:

- `cvh-poll.sh` → `huddle-poll.sh`
- `cvh-session-start.sh` → `huddle-session-start.sh`
- `cvh-whoami.sh` → `huddle-whoami.sh`
- `cvh-self-` (filename prefix in legacy fallback) → leave as-is (legacy compat for now)
- `cvh-session-names.json` → `huddle-session-names.json`
- `cvh-last-seen-` → `huddle-last-seen-`
- "PP-cvh" (the bead reference) → leave as-is in the immediate term; PP-cvh is still the active coordination bead under PR #1357. The follow-up rotation PR migrates to the new root bead.
- Comments referencing "cvh-" by way of naming the system → "huddle"
- Error messages like `cvh-poll.sh: ...` → `huddle-poll.sh: ...`

Open each file with Edit and replace. Verify no stray `cvh-` references remain in script names:

```bash
rg 'cvh-(poll|session-start|whoami)' scripts/hooks/
```

Expected: empty output.

The legacy `cvh-self-<session_id>` filename is intentionally preserved as a compat fallback so existing per-session files (already on disk from PP-bgj9's earlier commits) keep working until they age out.

- [ ] **Step 1.4: Update `.claude/settings.json` hook paths**

Open `.claude/settings.json`. Find the two hook entries:

- `UserPromptSubmit` → `command: "bash \"${CLAUDE_PROJECT_DIR:-.}\"/scripts/hooks/cvh-poll.sh"`
- `SessionStart` → `command: "bash \"${CLAUDE_PROJECT_DIR:-.}\"/scripts/hooks/cvh-session-start.sh"`

Change both `cvh-` to `huddle-`. Verify:

```bash
python3 -c "import json; d=json.load(open('.claude/settings.json')); print('Project hooks:'); [print(' ', e['hooks'][0]['command']) for k in d['hooks'] for e in d['hooks'][k] if e.get('hooks')]"
```

Expected: hook commands now reference `huddle-poll.sh` and `huddle-session-start.sh`.

- [ ] **Step 1.5: Rename + sync user-level scripts**

Run:

```bash
mv ~/.claude/hooks/cvh-poll.sh          ~/.claude/hooks/huddle-poll.sh
mv ~/.claude/hooks/cvh-session-start.sh ~/.claude/hooks/huddle-session-start.sh
mv ~/.claude/hooks/cvh-whoami.sh        ~/.claude/hooks/huddle-whoami.sh
```

Then re-sync each user-level copy from the project-level renamed script (so the in-file text is also updated):

```bash
cp scripts/hooks/huddle-poll.sh          ~/.claude/hooks/huddle-poll.sh
cp scripts/hooks/huddle-session-start.sh ~/.claude/hooks/huddle-session-start.sh
cp scripts/hooks/huddle-whoami.sh        ~/.claude/hooks/huddle-whoami.sh
```

- [ ] **Step 1.6: Update `~/.claude/settings.json` hook paths**

Use the Edit tool against `~/.claude/settings.json`. Find the `UserPromptSubmit` block:

```json
"command": "bash ~/.claude/hooks/cvh-poll.sh",
```

Change to:

```json
"command": "bash ~/.claude/hooks/huddle-poll.sh",
```

Find the `SessionStart` block's huddle entry (it's the second hook in the `hooks` array under SessionStart, alongside `bd prime`):

```json
"command": "bash ~/.claude/hooks/cvh-session-start.sh",
```

Change to:

```json
"command": "bash ~/.claude/hooks/huddle-session-start.sh",
```

Verify:

```bash
python3 -c "import json; d=json.load(open('/Users/froeht/.claude/settings.json')); print('User SessionStart:'); [print(' ', h['command']) for e in d['hooks']['SessionStart'] for h in e['hooks']]; print('User UserPromptSubmit:'); [print(' ', h['command']) for e in d['hooks']['UserPromptSubmit'] for h in e['hooks']]"
```

Expected: all hook commands now reference `huddle-*.sh`. JSON parses without error.

- [ ] **Step 1.7: Rename ~/.config/pinpoint/ files**

Run:

```bash
mv ~/.config/pinpoint/cvh-session-names.json ~/.config/pinpoint/huddle-session-names.json
for f in ~/.config/pinpoint/cvh-last-seen-*; do
  [[ -f "$f" ]] || continue
  newname=$(echo "$f" | sed 's|cvh-last-seen-|huddle-last-seen-|')
  mv "$f" "$newname"
done
ls ~/.config/pinpoint/huddle-*
```

Expected: at least `huddle-session-names.json` and one or more `huddle-last-seen-*` files exist.

The `cvh-self-<session_id>` files (legacy per-session name files) are NOT renamed — they're a back-compat fallback path the scripts still recognize and they age out naturally.

- [ ] **Step 1.8: Verify session-names mapping survived**

Run:

```bash
cat ~/.config/pinpoint/huddle-session-names.json
```

Expected: same content as the pre-rename snapshot from Step 1.1 — Slingshot, Spinner, Plunger entries intact.

- [ ] **Step 1.9: Smoke test — run the poll hook with a mock payload**

Run:

```bash
echo '{"session_id":"e4b7c48e-f77f-412e-9fc7-8a85b3259dc8","hook_event_name":"UserPromptSubmit"}' | bash scripts/hooks/huddle-poll.sh
echo "exit=$?"
```

Expected: exit 0. Output may be empty (no new comments) or contain a `## New PP-cvh coordination comments` block — both acceptable. Critically, no errors like `cvh-poll.sh: command not found` or `huddle-poll.sh: jq: command not found`.

- [ ] **Step 1.10: Smoke test — run the session-start hook with a mock payload**

Run:

```bash
echo '{"session_id":"e4b7c48e-f77f-412e-9fc7-8a85b3259dc8","hook_event_name":"SessionStart","source":"startup"}' | bash scripts/hooks/huddle-session-start.sh
echo "exit=$?"
```

Expected: exit 0. Output contains a `## Huddle identity` or `## PP-cvh identity` block (the body text still references PP-cvh; we update that in a later task). Critically, no errors.

- [ ] **Step 1.11: Shellcheck the three renamed scripts**

Run:

```bash
shellcheck scripts/hooks/huddle-poll.sh scripts/hooks/huddle-session-start.sh scripts/hooks/huddle-whoami.sh
echo "exit=$?"
```

Expected: exit 0, no output. (SC2016 info-level warnings about literal Markdown backticks may appear; those are intentional and have `# shellcheck disable=SC2016` directives.)

- [ ] **Step 1.12: Update bd memory**

Run:

```bash
bd forget reference-cvh-coordination-hooks
bd memories | grep -E 'cvh|huddle' || echo "(no remaining cvh references)"
```

Then write a fresh memory under the new key. The content from `reference-cvh-coordination-hooks` is in the spec at §1-§10; rewrite it briefly with the new names:

```bash
bd remember --key reference-huddle-coordination-hooks "$(cat <<'EOF'
The "huddle" coordination system (formerly named cvh) is wired via three project-level hooks:

- scripts/hooks/huddle-session-start.sh — SessionStart hook. On every session start (except subagents and compaction), announces the session_id and its registered name, OR tells the agent to register a descriptive name based on the current task.
- scripts/hooks/huddle-poll.sh — UserPromptSubmit hook. On every user prompt, polls PP-cvh for new coordination comments and injects any unseen ones (filtered by the current session's name).
- scripts/hooks/huddle-rotation-check.sh — shared helper; currently a stub that always returns "no rotation needed". Replaced with a real date-compare in the follow-up rotation PR.

Sign-off convention: —Claude-<YourName> (em-dash, canonical). The filter ALSO accepts the shorthand —<YourName> for typo tolerance.

Mapping file: ~/.config/pinpoint/huddle-session-names.json — JSON object of {session_id: name}. Inspect via `bash scripts/hooks/huddle-whoami.sh list`. Survives across restarts and compactions.

Helper: scripts/hooks/huddle-whoami.sh has subcommands whoami | register | list | discover.

PR #1357 (PP-bgj9) shipped this foundation. The follow-up rotation PR adds daily-bead rolling, summarization, and bootstrap.

For full design: docs/superpowers/specs/2026-05-17-huddle-system-design.md
EOF
)"
```

Expected: `bd memories | grep huddle` shows the new key; `bd memories | grep cvh` returns no results.

- [ ] **Step 1.13: Commit**

Run:

```bash
git status
git add scripts/hooks/huddle-poll.sh scripts/hooks/huddle-session-start.sh scripts/hooks/huddle-whoami.sh .claude/settings.json
git commit -m "$(cat <<'EOF'
refactor(huddle): rename cvh-* → huddle-* across scripts, settings, config (PP-bgj9)

Mechanical rename of the coordination system from "cvh" (after the bead ID
PP-cvh) to "huddle" (semantic name). All script names, file paths, in-script
references, hook command paths in .claude/settings.json, and the
~/.claude/settings.json live install paths are updated in one atomic move.
~/.config/pinpoint/cvh-* state files are also renamed to huddle-*.

No behavior changes. PP-cvh remains the active coordination bead under this
PR; the follow-up rotation PR migrates to a fresh huddle root bead.

The legacy `cvh-self-<session_id>` per-session files are deliberately NOT
renamed — they're a back-compat fallback the scripts still recognize and
they age out naturally as sessions re-register under huddle-session-names.json.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push
```

Expected: clean commit with the renamed files, push succeeds.

---

## Task 2: Subagent-skip guard in both hooks

**Files:**

- Modify: `scripts/hooks/huddle-poll.sh` (top, after `set -euo pipefail`)
- Modify: `scripts/hooks/huddle-session-start.sh` (top, after `set -euo pipefail`)

Subagent dispatches (`Agent({...})`) create new Claude Code sessions with their own SessionStart and UserPromptSubmit hook firings. We don't want subagents participating in huddle — they're ephemeral. Detection: `transcript_path` contains `/subagents/`.

- [ ] **Step 2.1: Add the guard to huddle-poll.sh**

Open `scripts/hooks/huddle-poll.sh` with Edit. Locate the existing block:

```bash
# Fail-open on missing dependencies — this hook runs on every UserPromptSubmit
# and MUST NOT block a user prompt because jq or python3 aren't installed.
# (bd is also required but its absence is handled inline at the call site.)
for dep in jq python3; do
  command -v "$dep" >/dev/null 2>&1 || exit 0
done
```

Insert this block immediately AFTER the `for dep in jq python3; do ...; done` loop (so deps are verified before parsing stdin, but subagent detection runs early):

```bash
# Skip subagent sessions. Subagent transcripts live under <project>/<session>/subagents/<agent>.jsonl
# rather than <project>/<session>.jsonl. Subagents are ephemeral and must not
# participate in huddle coordination — they neither poll nor inject.
INPUT=""
if [[ ! -t 0 ]]; then
  INPUT=$(cat)
fi
TRANSCRIPT_PATH=""
if [[ -n "$INPUT" ]]; then
  TRANSCRIPT_PATH=$(
    printf '%s' "$INPUT" | python3 -c "
import sys, json
try:
    print(json.load(sys.stdin).get('transcript_path') or '')
except Exception:
    print('')
" 2>/dev/null
  ) || TRANSCRIPT_PATH=""
fi
case "$TRANSCRIPT_PATH" in
  */subagents/*) exit 0 ;;
esac
```

**Important:** the existing script reads stdin into `INPUT` later in the file. The block above consumes stdin. Find the existing `INPUT=$(cat)` block (the one parsing session_id) and DELETE the duplicate read — replace it with code that re-uses the `$INPUT` already captured above. Find this existing block:

```bash
# --- Read UserPromptSubmit hook JSON from stdin (best-effort) ---
INPUT=""
if [[ ! -t 0 ]]; then
  INPUT=$(cat)
fi

SESSION_ID=""
if [[ -n "$INPUT" ]]; then
  SESSION_ID=$(
    printf '%s' "$INPUT" | python3 -c "
import sys, json
try:
    print(json.load(sys.stdin).get('session_id') or '')
except Exception:
    print('')
" 2>/dev/null
  ) || SESSION_ID=""
fi
```

Replace with:

```bash
# --- Extract session_id from the stdin payload already captured above ---
SESSION_ID=""
if [[ -n "$INPUT" ]]; then
  SESSION_ID=$(
    printf '%s' "$INPUT" | python3 -c "
import sys, json
try:
    print(json.load(sys.stdin).get('session_id') or '')
except Exception:
    print('')
" 2>/dev/null
  ) || SESSION_ID=""
fi
```

- [ ] **Step 2.2: Smoke test the subagent skip on huddle-poll.sh**

Run:

```bash
echo '{"session_id":"sub-test","transcript_path":"/Users/froeht/.claude/projects/-Users-froeht-Code-PinPoint/abc/subagents/agent-xyz.jsonl","hook_event_name":"UserPromptSubmit"}' \
  | bash scripts/hooks/huddle-poll.sh
echo "exit=$?"
```

Expected: exit 0, **empty stdout** (the subagent skip fires before any injection logic).

Then verify non-subagents still get the normal path:

```bash
echo '{"session_id":"e4b7c48e-f77f-412e-9fc7-8a85b3259dc8","transcript_path":"/Users/froeht/.claude/projects/-Users-froeht-Code-PinPoint/e4b7c48e-f77f-412e-9fc7-8a85b3259dc8.jsonl","hook_event_name":"UserPromptSubmit"}' \
  | bash scripts/hooks/huddle-poll.sh
echo "exit=$?"
```

Expected: exit 0, output is either empty (no new comments) or a `## New PP-cvh coordination comments` block.

- [ ] **Step 2.3: Add the guard to huddle-session-start.sh**

Open `scripts/hooks/huddle-session-start.sh` with Edit. Locate the existing block:

```bash
set -euo pipefail

STATE_DIR="$HOME/.config/pinpoint"
NAMES_JSON="$STATE_DIR/huddle-session-names.json"
mkdir -p "$STATE_DIR"

# Read stdin JSON (best-effort; never fail SessionStart on parse errors)
INPUT=""
if [[ ! -t 0 ]]; then
  INPUT=$(cat)
fi
```

Insert the subagent skip immediately after `INPUT=$(cat)` is captured but BEFORE the existing `SESSION_ID` extraction. Add this new block:

```bash
# Skip subagent sessions (see huddle-poll.sh for rationale).
TRANSCRIPT_PATH=""
if [[ -n "$INPUT" ]]; then
  TRANSCRIPT_PATH=$(
    printf '%s' "$INPUT" | python3 -c "
import sys, json
try:
    print(json.load(sys.stdin).get('transcript_path') or '')
except Exception:
    print('')
" 2>/dev/null
  ) || TRANSCRIPT_PATH=""
fi
case "$TRANSCRIPT_PATH" in
  */subagents/*) exit 0 ;;
esac
```

- [ ] **Step 2.4: Smoke test the subagent skip on huddle-session-start.sh**

Run:

```bash
echo '{"session_id":"sub-test","transcript_path":"/Users/froeht/.claude/projects/-Users-froeht-Code-PinPoint/abc/subagents/agent-xyz.jsonl","hook_event_name":"SessionStart","source":"startup"}' \
  | bash scripts/hooks/huddle-session-start.sh
echo "exit=$?"
```

Expected: exit 0, **empty stdout**.

Then non-subagent:

```bash
echo '{"session_id":"e4b7c48e-f77f-412e-9fc7-8a85b3259dc8","transcript_path":"/Users/froeht/.claude/projects/-Users-froeht-Code-PinPoint/e4b7c48e-f77f-412e-9fc7-8a85b3259dc8.jsonl","hook_event_name":"SessionStart","source":"startup"}' \
  | bash scripts/hooks/huddle-session-start.sh
echo "exit=$?"
```

Expected: exit 0, output contains `## Huddle identity` (or `## PP-cvh identity`) block.

- [ ] **Step 2.5: Re-sync user-level scripts**

Run:

```bash
cp scripts/hooks/huddle-poll.sh          ~/.claude/hooks/huddle-poll.sh
cp scripts/hooks/huddle-session-start.sh ~/.claude/hooks/huddle-session-start.sh
```

- [ ] **Step 2.6: Shellcheck both modified scripts**

Run:

```bash
shellcheck scripts/hooks/huddle-poll.sh scripts/hooks/huddle-session-start.sh
echo "exit=$?"
```

Expected: exit 0, no output (or SC2016 info-only).

- [ ] **Step 2.7: Commit**

```bash
git add scripts/hooks/huddle-poll.sh scripts/hooks/huddle-session-start.sh
git commit -m "$(cat <<'EOF'
feat(huddle): skip subagent sessions in both hooks (PP-bgj9)

Subagent dispatches (Agent({...})) create new Claude Code sessions with
their own SessionStart and UserPromptSubmit hook firings. They're ephemeral
and shouldn't participate in huddle — they neither poll for new comments
nor announce identity.

Detection: transcript_path contains "/subagents/" in subagent transcripts
(<project>/<session>/subagents/<agent>.jsonl) vs leaf transcripts for
top-level sessions (<project>/<session>.jsonl).

Both hooks now check transcript_path immediately after capturing stdin
and exit 0 silently if the path matches the subagent pattern.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push
```

---

## Task 3: Create huddle-rotation-check.sh stub

**Files:**

- Create: `scripts/hooks/huddle-rotation-check.sh`

A no-op stub that defines `huddle_rotation_needed()` returning 1 (no rotation needed). The hooks will source this file in Task 4. When the follow-up rotation PR ships, the real implementation lands here — no changes needed in the calling hooks.

- [ ] **Step 3.1: Write the file**

Write `scripts/hooks/huddle-rotation-check.sh` with this exact content:

```bash
#!/usr/bin/env bash
# huddle-rotation-check.sh — shared helper sourced by huddle-poll.sh and
# huddle-session-start.sh. Defines a single function `huddle_rotation_needed`
# that returns 0 if a coordination-bead rotation is needed, 1 otherwise.
#
# This file is a STUB in PR #1357 (the foundation PR). It always returns 1
# ("no rotation needed") because rotation isn't implemented yet — PP-cvh is
# still the single coordination bead. The real date-compare logic lands in
# the follow-up rotation PR, at which point this stub is replaced with the
# implementation described in §5.3 of:
#   docs/superpowers/specs/2026-05-17-huddle-system-design.md
#
# Design intent for the eventual real implementation:
#   - Read ~/.config/pinpoint/huddle.config.json for root_bead_id
#   - bd show <root> --json to extract today_bead.date from notes
#   - Compare to $(date +%F) (local date)
#   - Return 0 if mismatch (rotation needed), 1 if match (no rotation needed)
#
# Calling pattern in both hooks:
#   source "$(dirname "$0")/huddle-rotation-check.sh"
#   if huddle_rotation_needed; then
#     # emit "rotation needed" notice and skip subsequent steps
#   fi
#
# Until the real implementation lands, this stub keeps the hooks running
# the existing polling/identity logic unchanged.

# shellcheck disable=SC2317  # function is sourced and called by callers
huddle_rotation_needed() {
  return 1
}
```

- [ ] **Step 3.2: Smoke test — source and call**

Run:

```bash
( source scripts/hooks/huddle-rotation-check.sh
  if huddle_rotation_needed; then
    echo "rotation needed"
  else
    echo "no rotation needed"
  fi )
```

Expected: `no rotation needed`.

- [ ] **Step 3.3: Shellcheck**

Run:

```bash
shellcheck scripts/hooks/huddle-rotation-check.sh
echo "exit=$?"
```

Expected: exit 0, no output.

- [ ] **Step 3.4: Commit**

```bash
git add scripts/hooks/huddle-rotation-check.sh
git commit -m "$(cat <<'EOF'
feat(huddle): add huddle-rotation-check.sh as a no-op stub (PP-bgj9)

Establishes the integration point for the eventual rotation system without
shipping rotation in this PR. Both huddle-poll.sh and huddle-session-start.sh
will source this file in the next commit and call huddle_rotation_needed.
Returns 1 (no rotation needed) unconditionally; the follow-up rotation PR
replaces the stub with the real date-compare logic per the design spec at
docs/superpowers/specs/2026-05-17-huddle-system-design.md §5.3.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push
```

---

## Task 4: Wire rotation-check into both hooks

**Files:**

- Modify: `scripts/hooks/huddle-poll.sh`
- Modify: `scripts/hooks/huddle-session-start.sh`

Both hooks `source` the rotation-check helper and call `huddle_rotation_needed`. Since the stub always returns 1, no rotation notice is ever emitted in this PR — but the integration is in place.

- [ ] **Step 4.1: Wire into huddle-poll.sh**

Open `scripts/hooks/huddle-poll.sh`. Locate the existing block right after the subagent skip and dependency checks:

```bash
case "$TRANSCRIPT_PATH" in
  */subagents/*) exit 0 ;;
esac

# --- Extract session_id from the stdin payload already captured above ---
```

Insert AFTER the subagent skip but BEFORE the session_id extraction:

```bash
# --- Rotation check (stub in PR #1357; real check in follow-up rotation PR) ---
ROTATION_CHECK_SCRIPT="$(dirname "$0")/huddle-rotation-check.sh"
if [[ -f "$ROTATION_CHECK_SCRIPT" ]]; then
  # shellcheck source=huddle-rotation-check.sh
  source "$ROTATION_CHECK_SCRIPT"
  if huddle_rotation_needed; then
    # Real "rotation needed" output lands in the follow-up PR. For now this
    # branch is unreachable (stub returns 1).
    printf '## ⚠️ Huddle rotation needed\n\n'
    printf 'See docs/superpowers/specs/2026-05-17-huddle-system-design.md §7.2\n'
    exit 0
  fi
fi
```

- [ ] **Step 4.2: Smoke test huddle-poll.sh still works**

Run:

```bash
echo '{"session_id":"e4b7c48e-f77f-412e-9fc7-8a85b3259dc8","transcript_path":"/Users/froeht/.claude/projects/-Users-froeht-Code-PinPoint/e4b7c48e-f77f-412e-9fc7-8a85b3259dc8.jsonl","hook_event_name":"UserPromptSubmit"}' \
  | bash scripts/hooks/huddle-poll.sh
echo "exit=$?"
```

Expected: exit 0. Output is either empty or a coordination-comments block — same as before wiring. The rotation-needed notice should NOT appear because the stub returns 1.

- [ ] **Step 4.3: Wire into huddle-session-start.sh**

Open `scripts/hooks/huddle-session-start.sh`. Locate the existing block after the subagent skip:

```bash
case "$TRANSCRIPT_PATH" in
  */subagents/*) exit 0 ;;
esac

SESSION_ID=""
SOURCE=""
```

Insert AFTER the subagent skip but BEFORE `SESSION_ID=""`:

```bash
# --- Rotation check (stub in PR #1357; real check in follow-up rotation PR) ---
ROTATION_CHECK_SCRIPT="$(dirname "$0")/huddle-rotation-check.sh"
if [[ -f "$ROTATION_CHECK_SCRIPT" ]]; then
  # shellcheck source=huddle-rotation-check.sh
  source "$ROTATION_CHECK_SCRIPT"
  if huddle_rotation_needed; then
    # Real "rotation needed" output lands in the follow-up PR. For now this
    # branch is unreachable (stub returns 1).
    printf '## ⚠️ Huddle rotation needed\n\n'
    printf 'See docs/superpowers/specs/2026-05-17-huddle-system-design.md §7.2\n'
    exit 0
  fi
fi
```

- [ ] **Step 4.4: Smoke test huddle-session-start.sh still works**

Run:

```bash
echo '{"session_id":"e4b7c48e-f77f-412e-9fc7-8a85b3259dc8","transcript_path":"/Users/froeht/.claude/projects/-Users-froeht-Code-PinPoint/e4b7c48e-f77f-412e-9fc7-8a85b3259dc8.jsonl","hook_event_name":"SessionStart","source":"startup"}' \
  | bash scripts/hooks/huddle-session-start.sh
echo "exit=$?"
```

Expected: exit 0. Output contains identity block. Rotation-needed notice does NOT appear.

- [ ] **Step 4.5: Re-sync user-level scripts**

Run:

```bash
cp scripts/hooks/huddle-poll.sh          ~/.claude/hooks/huddle-poll.sh
cp scripts/hooks/huddle-session-start.sh ~/.claude/hooks/huddle-session-start.sh
# Also copy the rotation-check helper so user-level hooks can source it
cp scripts/hooks/huddle-rotation-check.sh ~/.claude/hooks/huddle-rotation-check.sh
```

- [ ] **Step 4.6: Shellcheck**

```bash
shellcheck scripts/hooks/huddle-poll.sh scripts/hooks/huddle-session-start.sh
echo "exit=$?"
```

Expected: exit 0.

- [ ] **Step 4.7: Commit**

```bash
git add scripts/hooks/huddle-poll.sh scripts/hooks/huddle-session-start.sh
git commit -m "$(cat <<'EOF'
feat(huddle): wire rotation-check stub into both hooks (PP-bgj9)

Both hooks now source huddle-rotation-check.sh and call huddle_rotation_needed
before their main logic. The current stub always returns 1 (no rotation
needed), so behavior is unchanged for the foundation PR. The integration
point exists so the follow-up rotation PR can replace the stub without
changing the calling hooks.

The "rotation needed" branch is reachable but currently dead code (no path
triggers it). It emits a brief notice pointing at the design spec; the
final user-facing notice lands in the follow-up.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push
```

---

## Task 5: Create `.agent/skills/pinpoint-huddle/SKILL.md` (self-documenting docs)

**Files:**

- Create: `.agent/skills/pinpoint-huddle/SKILL.md`

The single authoritative documentation for the huddle system that agents read. Replaces the bd memory's role of "explain the system" — bd memory will reference this file rather than duplicating its content.

- [ ] **Step 5.1: Create the directory**

Run:

```bash
mkdir -p .agent/skills/pinpoint-huddle
```

- [ ] **Step 5.2: Write the SKILL.md**

Write `.agent/skills/pinpoint-huddle/SKILL.md` with this exact content:

```markdown
# pinpoint-huddle

> **Use when:** you see a huddle SessionStart announcement or want to understand
> the inter-session coordination system. Triggers on "huddle", "PP-cvh",
> "coordination bead", "identity announcement", "rotation needed".

The huddle system is a context-efficient channel between parallel Claude Code
sessions working on PinPoint. Each session learns what other sessions did
recently, posts its own updates, and filters out its own echoes — all without
consuming thousands of tokens at every session start.

## What you'll see at session start

The `huddle-session-start.sh` hook (registered in `~/.claude/settings.json`)
fires when your session opens. It outputs one of two blocks into your context:

### Identity announcement (you're registered)

    ## Huddle identity

    Your session_id: `<UUID>`
    Registered as: **Claude-<Name>** (self-filter active for your own posts)

    If this scrolls out of context later, recall your name with:
        bash scripts/hooks/huddle-whoami.sh whoami <UUID>

You're ready. The poll hook (next section) will filter out comments you
yourself posted. Sign your PP-cvh comments with `—Claude-<YourName>` (em-dash,
canonical).

### Registration needed (you're new)

    ## Huddle identity — registration needed

    Your session_id: `<UUID>`

    When you receive your first user prompt, derive a short descriptive name
    for yourself from what you're being asked to do. ...

Read the full notice, derive a name from your first user prompt, and register:

    bash scripts/hooks/huddle-whoami.sh register <YourName> <session_id>

**Naming rules:**

- Short, descriptive of the work (CamelCase, ASCII, under ~20 chars)
- Examples: `WorktreeHookFix`, `TestAudit`, `DesignBible`, `DocsSync`, `RotationDesign`
- DO NOT use bead IDs or PR numbers (they don't help Tim recognize sessions)
- DO NOT use generic labels like `Worker1`
- If the name's taken, the helper suggests variations; pick one and retry

## What you'll see on every user prompt

The `huddle-poll.sh` hook (registered as UserPromptSubmit) fires before each
user turn. It polls the active coordination bead for new comments and injects
them as a system-reminder block:

    ## New PP-cvh coordination comments (N)

    **<author>** (<timestamp>):
    <comment text>
    ...

Comments signed by your own session (matching `—Claude-<YourName>` or
`—<YourName>`) are filtered out — you won't see your own posts re-injected.

If nothing's new since your last turn, no block appears (zero tokens).

## How to post coordination updates

Use `bd comments add PP-cvh "..."` with your sign-off. Example:

    bd comments add PP-cvh "Merged PR #1361 (PP-pno7 worktree hook fix). Sync main if you have active branches. —Claude-Slingshot"

Things worth posting:

- A PR you merged ("Merged PR #N (bead X). Sync main if you have active branches.")
- A PR you opened ("Opened PR #N (bead X): brief title.")
- A bead you filed for a non-obvious finding ("Filed PP-XXXX: <finding>.")
- A coordination need ("Working on file Y in branch Z; flag if conflict.")

Things NOT worth posting:

- Every single commit
- Internal debugging chatter
- "I started working on X" (only post merge/discovery; agents read each
  other's outputs after the fact, not real-time)

## Scripts

| Script                                   | Trigger               | Purpose                                                |
| ---------------------------------------- | --------------------- | ------------------------------------------------------ |
| `scripts/hooks/huddle-poll.sh`           | UserPromptSubmit      | Inject new PP-cvh comments since last_seen             |
| `scripts/hooks/huddle-session-start.sh`  | SessionStart          | Identity announcement; rotation check (currently stub) |
| `scripts/hooks/huddle-whoami.sh`         | manual                | Register/lookup/list/discover session→name mappings    |
| `scripts/hooks/huddle-rotation-check.sh` | sourced by both hooks | Date-compare for daily rotation (stub in PR #1357)     |

## State files (all under `~/.config/pinpoint/`)

| File                           | Purpose                                                      |
| ------------------------------ | ------------------------------------------------------------ |
| `huddle-session-names.json`    | `{session_id: name}` map (canonical)                         |
| `huddle-last-seen-<path-hash>` | Per-checkout poll cursor (most-recent injected `created_at`) |
| `huddle-rotation.lock`         | flock target (rotation PR only)                              |
| `huddle.config.json`           | Root bead ID + schema version (rotation PR only)             |

## Self-filter rules

- Comments are filtered out by exact suffix match on the **em-dash** form: either `—Claude-<YourName>` (canonical, em-dash + "Claude-" + name) or `—<YourName>` (shorthand).
- The em-dash (U+2014) distinguishes from hyphen-minus: `—Claude-Spinner` does NOT end with `—Spinner` because the byte preceding "Spinner" is a hyphen-minus in "Claude-Spinner", not an em-dash. So no false positives.
- If your name's mapping gets pruned (the rotation PR adds a 14-day inactivity prune) and your own past posts start re-injecting, just re-register: `bash scripts/hooks/huddle-whoami.sh register <Name> <session_id>`.

## Subagent sessions

Subagent sessions (any `Agent({...})` dispatch) are skipped entirely. Detection:
`transcript_path` contains `/subagents/<agent-id>.jsonl`. Both hooks exit 0
without output for subagents. Subagents shouldn't register names or post on
PP-cvh — they're ephemeral.

## What this PR (foundation) doesn't yet include

- **Daily rotation:** PP-cvh remains the single coordination bead. The follow-up
  rotation PR adds daily summary beads, monthly rollups, and a rotation
  subagent that runs at the first session of a new local day.
- **Stale name pruning:** the 14-day name-freeing happens during rotation; not
  yet active.
- **Bootstrap:** the huddle root bead doesn't exist yet because rotation isn't
  shipped. PP-cvh acts as the implicit root.

Full design at `docs/superpowers/specs/2026-05-17-huddle-system-design.md`.
```

- [ ] **Step 5.3: Commit**

```bash
git add .agent/skills/pinpoint-huddle/SKILL.md
git commit -m "$(cat <<'EOF'
docs(huddle): add pinpoint-huddle skill describing the coordination system (PP-bgj9)

Single authoritative reference for agents and humans. Covers: what the
SessionStart announcement looks like, how to register a descriptive name,
how to post coordination updates, sign-off conventions and self-filter
mechanics, subagent behavior, and what's deferred to the follow-up rotation
PR. The bd memory reference-huddle-coordination-hooks now points here
rather than duplicating content.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push
```

---

## Task 6: Update hook output text to reference the skill

**Files:**

- Modify: `scripts/hooks/huddle-session-start.sh` (output templates)

The identity and registration-needed notices currently say "...full design at docs/...". Update to point at the skill: "...full reference: invoke the `pinpoint-huddle` skill or read `.agent/skills/pinpoint-huddle/SKILL.md`."

- [ ] **Step 6.1: Update the "registered" branch**

Open `scripts/hooks/huddle-session-start.sh`. Find:

```bash
if [[ -n "$NAME" ]]; then
  printf '## Huddle identity\n\n'
  # shellcheck disable=SC2016  # backticks are literal Markdown, not command substitution
  printf 'Your session_id: `%s`\n' "$SESSION_ID"
  printf 'Registered as: **Claude-%s** (self-filter active for your own posts)\n\n' "$NAME"
  printf 'If this scrolls out of context later, recall your name with:\n\n'
  printf '    bash scripts/hooks/huddle-whoami.sh whoami %s\n' "$SESSION_ID"
```

Note: the actual current text may still say `## PP-cvh identity`. If so, also change `PP-cvh` to `Huddle` and `Huddle identity — registration needed` likewise. Update to:

```bash
if [[ -n "$NAME" ]]; then
  printf '## Huddle identity\n\n'
  # shellcheck disable=SC2016  # backticks are literal Markdown, not command substitution
  printf 'Your session_id: `%s`\n' "$SESSION_ID"
  printf 'Registered as: **Claude-%s** (self-filter active for your own posts)\n\n' "$NAME"
  printf 'If this scrolls out of context later, recall your name with:\n'
  printf '    bash scripts/hooks/huddle-whoami.sh whoami %s\n\n' "$SESSION_ID"
  printf 'Full reference: `.agent/skills/pinpoint-huddle/SKILL.md`\n'
```

- [ ] **Step 6.2: Update the "registration needed" branch**

In the same file, find the `else` branch:

```bash
else
  printf '## Huddle identity — registration needed\n\n'
  # shellcheck disable=SC2016  # backticks are literal Markdown, not command substitution
  printf 'Your session_id: `%s`\n\n' "$SESSION_ID"
  printf 'You are not yet registered in the PP-cvh self-filter map.\n'
  ...
```

Update the trailing text to add a SKILL reference:

```bash
else
  printf '## Huddle identity — registration needed\n\n'
  # shellcheck disable=SC2016  # backticks are literal Markdown, not command substitution
  printf 'Your session_id: `%s`\n\n' "$SESSION_ID"
  printf 'You are not yet registered in the huddle self-filter map.\n\n'
  printf 'When you receive your first user prompt, derive a short descriptive name\n'
  printf 'for yourself from what you'\''re being asked to do. The name should help Tim\n'
  printf 'recognize at a glance what each parallel Claude is working on.\n\n'
  printf 'Examples:\n'
  printf '  WorktreeHookFix  fixing a worktree hook\n'
  printf '  TestAudit        auditing test coverage\n'
  printf '  DesignBible      working on the design bible\n'
  printf '  DocsSync         keeping docs aligned\n\n'
  printf 'Format: CamelCase, ASCII letters only, under ~20 chars.\n\n'
  printf 'Register with:\n'
  printf '    bash scripts/hooks/huddle-whoami.sh register <YourName> %s\n\n' "$SESSION_ID"
  printf 'If the name is taken, the helper suggests variations.\n'
  printf 'Full reference: `.agent/skills/pinpoint-huddle/SKILL.md`\n'
fi
```

Replace any existing "registration needed" block in the file with the above (the existing block has slightly different text — use the new version).

- [ ] **Step 6.3: Smoke test — registered branch**

Run:

```bash
echo '{"session_id":"e4b7c48e-f77f-412e-9fc7-8a85b3259dc8","transcript_path":"/Users/froeht/.claude/projects/-Users-froeht-Code-PinPoint/e4b7c48e-f77f-412e-9fc7-8a85b3259dc8.jsonl","hook_event_name":"SessionStart","source":"startup"}' \
  | bash scripts/hooks/huddle-session-start.sh
```

Expected output:

```
## Huddle identity

Your session_id: `e4b7c48e-f77f-412e-9fc7-8a85b3259dc8`
Registered as: **Claude-Slingshot** (self-filter active for your own posts)

If this scrolls out of context later, recall your name with:
    bash scripts/hooks/huddle-whoami.sh whoami e4b7c48e-f77f-412e-9fc7-8a85b3259dc8

Full reference: `.agent/skills/pinpoint-huddle/SKILL.md`
```

- [ ] **Step 6.4: Smoke test — registration-needed branch**

Run:

```bash
echo '{"session_id":"new-session-not-in-map","transcript_path":"/Users/froeht/.claude/projects/-Users-froeht-Code-PinPoint/new-session-not-in-map.jsonl","hook_event_name":"SessionStart","source":"startup"}' \
  | bash scripts/hooks/huddle-session-start.sh
```

Expected: output contains `## Huddle identity — registration needed`, mentions deriving a name from the first prompt, mentions `huddle-whoami.sh register`, and ends with the SKILL.md reference.

- [ ] **Step 6.5: Re-sync user-level**

```bash
cp scripts/hooks/huddle-session-start.sh ~/.claude/hooks/huddle-session-start.sh
```

- [ ] **Step 6.6: Shellcheck**

```bash
shellcheck scripts/hooks/huddle-session-start.sh
echo "exit=$?"
```

Expected: exit 0 (info-level SC2016 OK).

- [ ] **Step 6.7: Commit**

```bash
git add scripts/hooks/huddle-session-start.sh
git commit -m "$(cat <<'EOF'
docs(huddle): hook output references pinpoint-huddle skill (PP-bgj9)

Identity and registration-needed notices now point agents at
.agent/skills/pinpoint-huddle/SKILL.md for the full reference. Each notice
is self-contained (the agent doesn't need to read the skill to register a
name and start participating), but agents who want details know where to
look.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
git push
```

---

## Task 7: Final verification + ready-for-review

**Files:** none (verification only)

- [ ] **Step 7.1: Run `pnpm run check`**

```bash
pnpm run check
```

Expected: 1136 tests pass, shellcheck clean, lint clean, typecheck clean. Same baseline as previous commits — these changes don't touch TypeScript or test code.

- [ ] **Step 7.2: Inspect all renamed files**

```bash
rg 'cvh-(poll|session-start|whoami)' scripts/hooks/ .claude/ .agent/ docs/
echo "exit=$?"
```

Expected: no matches for the script-name references. (References to "PP-cvh" as the historical bead name are still allowed in docs and comments.)

- [ ] **Step 7.3: Verify the new files are tracked**

```bash
git ls-files scripts/hooks/huddle-poll.sh scripts/hooks/huddle-session-start.sh scripts/hooks/huddle-whoami.sh scripts/hooks/huddle-rotation-check.sh .agent/skills/pinpoint-huddle/SKILL.md
```

Expected: all 5 paths printed. None missing.

- [ ] **Step 7.4: Verify user-level scripts are in sync**

```bash
diff scripts/hooks/huddle-poll.sh          ~/.claude/hooks/huddle-poll.sh
diff scripts/hooks/huddle-session-start.sh ~/.claude/hooks/huddle-session-start.sh
diff scripts/hooks/huddle-whoami.sh        ~/.claude/hooks/huddle-whoami.sh
diff scripts/hooks/huddle-rotation-check.sh ~/.claude/hooks/huddle-rotation-check.sh
```

Expected: all four diffs empty (files identical).

- [ ] **Step 7.5: Verify the live user-level settings.json points at huddle-\***

```bash
python3 -c "
import json
d = json.load(open('/Users/froeht/.claude/settings.json'))
for evt in ['UserPromptSubmit', 'SessionStart']:
    for entry in d['hooks'].get(evt, []):
        for h in entry['hooks']:
            print(f\"{evt}: {h['command']}\")"
```

Expected: every command referencing the huddle scripts uses `huddle-` paths. (The `bd prime` entry under SessionStart is unchanged.)

- [ ] **Step 7.6: Verify project-level settings.json**

```bash
python3 -c "
import json
d = json.load(open('.claude/settings.json'))
for evt in ['UserPromptSubmit', 'SessionStart']:
    for entry in d['hooks'].get(evt, []):
        for h in entry['hooks']:
            print(f\"{evt}: {h['command']}\")"
```

Expected: hook commands use `huddle-` paths.

- [ ] **Step 7.7: Live end-to-end test from this session**

The hooks fire on every user prompt and at session start. The next time you send any user message, the UserPromptSubmit hook fires with the renamed `huddle-poll.sh`. If it works, you should see either no injection (no new comments) or a normal `## New PP-cvh coordination comments` block — same as before the rename. If you see an error message like "huddle-poll.sh: command not found" or similar, Step 1.6 didn't sync the settings.json properly.

You can also force a smoke test manually with the same payload structure:

```bash
echo '{"session_id":"e4b7c48e-f77f-412e-9fc7-8a85b3259dc8","transcript_path":"/Users/froeht/.claude/projects/-Users-froeht-Code-PinPoint/e4b7c48e-f77f-412e-9fc7-8a85b3259dc8.jsonl","hook_event_name":"UserPromptSubmit"}' \
  | bash ~/.claude/hooks/huddle-poll.sh
echo "exit=$?"
```

Expected: exit 0; output matches the project-level smoke test in Step 1.9.

- [ ] **Step 7.8: Check Copilot comments on PR #1357**

```bash
./scripts/workflow/copilot-comments.sh 1357
```

Address any new findings with fix-up commits or `respond-to-copilot.sh` replies (signed `—Claude-Slingshot`). Don't proceed to ready-for-review while comments are unresolved.

- [ ] **Step 7.9: Label ready-for-review (when CI green + Copilot clean)**

```bash
bash scripts/workflow/label-ready.sh 1357
```

Expected: the script's four gates (CI green, no unresolved Copilot threads, Copilot review current, no merge conflict) all pass; the `ready-for-review` label is applied. The PR is now ready for Tim's merge.

If a gate fails, the script tells you which one. Fix the underlying issue (push another commit, address Copilot, etc.) and re-run.

- [ ] **Step 7.10: Post merge-ready notice on PP-cvh**

```bash
bd comments add PP-cvh "Labeled PR #1357 (bead PP-bgj9) ready for review: huddle foundation (cvh→huddle rename, plugin skeleton, subagent skip, rotation-check stub, pinpoint-huddle skill). The rotation system is the follow-up PR. —Claude-Slingshot"
```

---

## Self-Review

**Spec coverage check** against `docs/superpowers/specs/2026-05-17-huddle-system-design.md` §12 "Implementation Split" → "PR #1357 (in flight, 'foundation')":

| Spec line item                                                                        | Task                                                                                                                |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Rename cvh-_ → huddle-_                                                               | Task 1                                                                                                              |
| Plugin packaging skeleton (SKILL.md, README, settings.json snippet, directory layout) | Task 5 (SKILL.md) — README and explicit settings.json snippet folded into SKILL.md; directory layout already exists |
| Self-documenting hooks                                                                | Task 6                                                                                                              |
| The four current hooks (poll, session-start, whoami, rotation-check stub)             | Tasks 1+3                                                                                                           |
| Copilot fixes already accepted                                                        | Already in prior commits; verified in Step 7.2                                                                      |
| Sign-off filter accepts both forms                                                    | Already in prior commits                                                                                            |
| Subagent skip via transcript_path check                                               | Task 2                                                                                                              |
| Migration NOT included                                                                | Confirmed by absence — PP-cvh stays                                                                                 |

**Placeholder scan:** no TBD, no "implement later", no `add appropriate error handling`, no "similar to Task N" — each task has the actual content.

**Type consistency:** the function `huddle_rotation_needed` is defined in Task 3 (returns 1) and called in Task 4 (with `if huddle_rotation_needed; then`). Match. The state file naming convention (`huddle-session-names.json`, `huddle-last-seen-<hash>`) is consistent between Task 1 (rename) and Task 5 (SKILL.md reference).

No gaps found.

---
