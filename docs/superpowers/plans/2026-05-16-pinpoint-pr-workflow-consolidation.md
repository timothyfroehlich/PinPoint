# PinPoint PR Workflow Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate three PR-workflow skills into one MCP-first skill, replace thin gh-CLI wrappers with direct MCP calls, keep scripts only for composite enforcement (merge gate, CI streaming), block direct merges via hook.

**Architecture:** MCP for per-operation reads/writes through agent skill instructions. Scripts for composite gate-then-action enforcement that can't trust the agent to be careful. Single skill replaces three. Hook ensures direct merge calls are routed through `merge-pr.sh`.

**Tech Stack:** bash (`set -euo pipefail`), Python 3 (pr-watch.py only), Node.js .cjs hooks, gh CLI 2.x, GitHub MCP server v0.32+ via `claude-plugins-official/github` plugin, jq, fd, rg.

**Spec:** `docs/superpowers/specs/2026-05-16-pinpoint-pr-workflow-consolidation-design.md`

**Bead:** PP-d4bf (repurpose; original scope was a stepping stone, this supersedes)

---

## Phase 0: Preconditions

These tasks set up the environment before code changes. They MUST complete in order.

### Task 0.1: Add labels+actions toolsets to MCP config

**Files:**

- Modify: `~/.claude/settings.json` (user global)

- [ ] **Step 1: Read current global settings**

```bash
cat ~/.claude/settings.json 2>/dev/null || echo "{}"
```

Capture the existing `mcpServers` block (if any). If the file doesn't exist or is empty, start fresh with `{}`.

- [ ] **Step 2: Add the MCP override**

If `mcpServers` block doesn't exist, add this entry:

```json
{
  "mcpServers": {
    "plugin:github:github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/",
      "headers": {
        "Authorization": "Bearer ${GITHUB_PERSONAL_ACCESS_TOKEN}",
        "X-MCP-Toolsets": "actions,labels"
      }
    }
  }
}
```

If `mcpServers` already exists, add or update the `plugin:github:github` entry to include the `X-MCP-Toolsets` header. Preserve all other entries.

- [ ] **Step 3: Validate JSON syntax**

```bash
jq empty ~/.claude/settings.json && echo "valid"
```

Expected: `valid`. If error, fix syntax before continuing.

### Task 0.2: Restart Claude Code and verify new tools

**Files:** none

- [ ] **Step 1: Fully exit Claude Code**

Quit the application. `/reload-plugins` is not sufficient — env vars + MCP config must be re-read at process start.

- [ ] **Step 2: Relaunch Claude Code in the same shell session**

The shell must already have `GITHUB_PERSONAL_ACCESS_TOKEN` set (verified earlier via `gh auth token`).

- [ ] **Step 3: Verify new MCP tools loaded**

In the new session, call ToolSearch:

```
ToolSearch query="select:mcp__plugin_github_github__actions_list,mcp__plugin_github_github__get_job_logs" max_results=2
```

Expected: both tools return schemas. If "No matching deferred tools found", the toolset config didn't take effect — debug before continuing.

Also verify labels toolset by searching for any label-add tool:

```
ToolSearch query="label" max_results=10
```

Look for any `mcp__plugin_github_github__*label*` tool. If `labels` toolset added dedicated PR label tools, they appear here.

### Task 0.3: Smoke test critical MCP tools

**Files:** none

- [ ] **Step 1: Verify `get_job_logs` on a failed PR job**

PR #1357 has E2E Full Tests (Chromium) failure at job_id `76349845322`.

```
mcp__plugin_github_github__get_job_logs(
  owner: "timothyfroehlich",
  repo: "PinPoint",
  job_id: 76349845322,
  failed_only: true,
  return_content: true,
  tail_lines: 50
)
```

Expected: returns truncated failure logs. If "tool not loaded" or schema error, the actions toolset isn't active.

- [ ] **Step 2: Verify `issue_write(method: "update")` can manipulate PR labels**

Create a throwaway label on a closed PR (e.g., PR #1342 is merged; safe to test):

```
mcp__plugin_github_github__issue_write(
  method: "update",
  owner: "timothyfroehlich",
  repo: "PinPoint",
  issue_number: 1342,
  labels: ["test-label-delete-me"]
)
```

Expected: success. Then immediately clean up by setting labels back to original:

```
mcp__plugin_github_github__issue_write(
  method: "update",
  owner: "timothyfroehlich",
  repo: "PinPoint",
  issue_number: 1342,
  labels: []
)
```

Verify via `gh pr view 1342 --json labels` that labels are back to empty (or original state). **CRITICAL**: this confirms PR labels work via the issues endpoint as documented in the spec. If it fails, the skill must instruct agents to use `gh pr edit --add-label` as fallback.

### Task 0.4: Close PR #1355 and delete its branch

**Files:** none (GitHub-side actions)

- [ ] **Step 1: Comment on PR #1355 explaining supersession**

```bash
gh pr comment 1355 --body "Superseded by the PR workflow consolidation spec at \`docs/superpowers/specs/2026-05-16-pinpoint-pr-workflow-consolidation-design.md\`. The shared-gates extraction + claude-merge.sh design from this PR is being rebuilt as part of a larger consolidation (MCP-first, skill consolidation, hook for direct-merge blocking). Closing this PR; new PR will open shortly on \`feat/pinpoint-pr-workflow-consolidation-PP-d4bf\`."
```

- [ ] **Step 2: Close PR #1355**

```bash
gh pr close 1355
```

- [ ] **Step 3: Delete the old branch locally and remotely**

```bash
git fetch origin
git branch -D feat/claude-merge-shared-gates-PP-d4bf 2>/dev/null || true
git push origin --delete feat/claude-merge-shared-gates-PP-d4bf
```

Expected: branch deleted. If "remote ref does not exist", the branch was already gone — continue.

### Task 0.5: Provision implementation worktree and claim bead

**Important**: per AGENTS.md §2.2 rule #5, the root checkout is read-only — all work happens in worktrees. The executor (subagent-driven-development or executing-plans) is responsible for invoking `superpowers:using-git-worktrees` to create the worktree at execution start. The branch and worktree are created together.

**Files:** none

- [ ] **Step 1: Confirm worktree provisioning**

Verify you (the executor) are NOT in the root checkout. Run:

```bash
test -d .git && echo "ROOT CHECKOUT — STOP, worktree required" || echo "WORKTREE OK"
```

If output is `ROOT CHECKOUT — STOP`, invoke `superpowers:using-git-worktrees` to create the implementation worktree before continuing.

- [ ] **Step 2: Verify worktree branch**

```bash
git branch --show-current
```

Expected: `feat/pinpoint-pr-workflow-consolidation-PP-d4bf` (or whatever branch the worktree was provisioned on; rename via `git branch -m` if needed).

- [ ] **Step 3: Verify upstream tracking**

```bash
git branch -vv | grep $(git branch --show-current)
```

Expected: shows `[origin/feat/pinpoint-pr-workflow-consolidation-PP-d4bf]`. If no upstream, push to set it: `git push -u origin <branch>`.

- [ ] **Step 4: Update PP-d4bf bead**

```bash
bd update PP-d4bf --status=in_progress
bd update PP-d4bf --notes="Repurposing per spec at docs/superpowers/specs/2026-05-16-pinpoint-pr-workflow-consolidation-design.md. Implementation branch: feat/pinpoint-pr-workflow-consolidation-PP-d4bf. Old PR #1355 closed."
```

---

## Phase 1: Extract `_pr-gates.sh` shared helper

The gates are bash functions sourced by `merge-pr.sh` and potentially other scripts. Pure functions: emit structured status, return 0/non-zero. No `--force` awareness internally; caller interprets.

### Task 1.1: Create `_pr-gates.sh` with COPILOT_LOGINS and 4 gate functions

**Files:**

- Create: `scripts/workflow/_pr-gates.sh`

- [ ] **Step 1: Write the script**

```bash
#!/usr/bin/env bash
# Shared PR gate functions. Sourced by merge-pr.sh and other workflow scripts.
# Each gate function prints structured status to stdout and returns 0 (pass) or non-zero (fail).
# Callers interpret --force/--dry-run semantics; gates are pure status reporters.
#
# Status token vocabulary:
#   PASS: <gate>: <state>     — gate passed
#   FAIL: <gate>: <state>     — gate failed (blocks)
#   WAIT: <gate>: <state>     — transient state, retry suggested
#   BLOCK: <gate>: <state>    — state mismatch, user action needed
#   WARN: <gate>: <state>     — proceeding with notice
#   SKIP: <gate>: <reason>    — gate doesn't apply

set -euo pipefail

# Canonical Copilot reviewer login allowlist. Source of truth for all PinPoint workflow scripts.
readonly COPILOT_LOGINS=("copilot-pull-request-reviewer" "copilot-pull-request-reviewer[bot]")

# Threshold: if Copilot review is stale by more than this many seconds since head push,
# WARN-and-proceed instead of WAIT. Covers GitHub silently-skipped review_requested events
# (observed in PR #1342 and PR #1326).
readonly COPILOT_CURRENCY_THRESHOLD=600

# Parse owner/repo dynamically — avoid hardcoded slug.
_repo_slug() {
  gh repo view --json nameWithOwner --jq .nameWithOwner
}

# Gate 1: CI Gate check has SUCCESS conclusion.
check_ci() {
  local pr=$1
  local rollup
  rollup=$(gh pr view "$pr" --json statusCheckRollup --jq '.statusCheckRollup[] | select(.name=="CI Gate")')
  if [ -z "$rollup" ]; then
    echo "FAIL: ci: CI Gate check not found"
    return 1
  fi
  local status conclusion
  status=$(jq -r '.status' <<< "$rollup")
  conclusion=$(jq -r '.conclusion' <<< "$rollup")
  if [ "$status" != "COMPLETED" ]; then
    echo "WAIT: ci: CI Gate status=$status"
    return 2
  fi
  case "$conclusion" in
    SUCCESS|NEUTRAL|SKIPPED)
      echo "PASS: ci: CI Gate conclusion=$conclusion"
      return 0
      ;;
    CANCELLED)
      echo "FAIL: ci: CI Gate cancelled"
      return 1
      ;;
    *)
      echo "FAIL: ci: CI Gate conclusion=$conclusion"
      return 1
      ;;
  esac
}

# Gate 2: Latest Copilot review is newer than the PR head commit.
# If head is newer than the latest Copilot review:
#   - elapsed < COPILOT_CURRENCY_THRESHOLD → WAIT
#   - elapsed >= threshold → WARN (proceed)
check_copilot_currency() {
  local pr=$1
  local owner_repo head_sha head_date latest_review elapsed now
  owner_repo=$(_repo_slug)

  # Get head SHA and committer date in one call.
  local pr_data
  pr_data=$(gh pr view "$pr" --json headRefOid)
  head_sha=$(jq -r '.headRefOid' <<< "$pr_data")
  head_date=$(gh api "repos/${owner_repo}/commits/${head_sha}" --jq '.commit.committer.date')

  # Get latest Copilot review timestamp via paginated reviews (jq slurp fixes per-page jq bug).
  latest_review=$(gh api --paginate "repos/${owner_repo}/pulls/${pr}/reviews" \
    | jq -s --argjson logins "$(printf '%s\n' "${COPILOT_LOGINS[@]}" | jq -R . | jq -s .)" \
        '[.[] | flatten | .[] | select(.user.login as $l | $logins | index($l))] | sort_by(.submitted_at) | last | .submitted_at // empty')

  if [ -z "$latest_review" ]; then
    echo "SKIP: currency: no Copilot reviews exist for this PR"
    return 0
  fi

  # macOS vs Linux date parsing with TZ=UTC normalization.
  local head_epoch review_epoch now_epoch
  if date -d "$head_date" +%s >/dev/null 2>&1; then
    head_epoch=$(date -d "$head_date" +%s)
    review_epoch=$(date -d "$latest_review" +%s)
  else
    head_epoch=$(TZ=UTC date -jf "%Y-%m-%dT%H:%M:%SZ" "${head_date%Z}Z" +%s)
    review_epoch=$(TZ=UTC date -jf "%Y-%m-%dT%H:%M:%SZ" "${latest_review%Z}Z" +%s)
  fi
  now_epoch=$(date -u +%s)

  if [ "$review_epoch" -ge "$head_epoch" ]; then
    echo "PASS: currency: latest Copilot review covers head commit"
    return 0
  fi

  elapsed=$((now_epoch - head_epoch))
  if [ "$elapsed" -lt "$COPILOT_CURRENCY_THRESHOLD" ]; then
    echo "WAIT: currency: ${elapsed}s since head push, Copilot review pending"
    return 2
  fi
  echo "WARN: currency: head ${elapsed}s old, Copilot review ${COPILOT_CURRENCY_THRESHOLD}s+ stale"
  return 0
}

# Gate 3: Zero unresolved Copilot threads. Uses GraphQL with cursor pagination.
check_unresolved_threads() {
  local pr=$1
  local owner_repo cursor=""
  local unresolved=0
  local has_next=true
  owner_repo=$(_repo_slug)
  local owner repo
  owner=$(cut -d/ -f1 <<< "$owner_repo")
  repo=$(cut -d/ -f2 <<< "$owner_repo")

  while [ "$has_next" = "true" ]; do
    local after_arg=""
    [ -n "$cursor" ] && after_arg=", after: \"$cursor\""
    local resp
    resp=$(gh api graphql -f query="
      query {
        repository(owner: \"$owner\", name: \"$repo\") {
          pullRequest(number: $pr) {
            reviewThreads(first: 100$after_arg) {
              pageInfo { hasNextPage endCursor }
              nodes { isResolved comments(first: 1) { nodes { author { login } } } }
            }
          }
        }
      }")
    local page_unresolved
    page_unresolved=$(jq --argjson logins "$(printf '%s\n' "${COPILOT_LOGINS[@]}" | jq -R . | jq -s .)" \
      '[.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved == false) | select(.comments.nodes[0].author.login as $l | $logins | index($l))] | length' <<< "$resp")
    unresolved=$((unresolved + page_unresolved))
    has_next=$(jq -r '.data.repository.pullRequest.reviewThreads.pageInfo.hasNextPage' <<< "$resp")
    cursor=$(jq -r '.data.repository.pullRequest.reviewThreads.pageInfo.endCursor // empty' <<< "$resp")
  done

  if [ "$unresolved" -eq 0 ]; then
    echo "PASS: threads: 0 unresolved Copilot threads"
    return 0
  fi
  echo "FAIL: threads: $unresolved unresolved Copilot threads"
  return 1
}

# Gate 4: PR has no merge conflict. UNKNOWN returned once; caller may retry.
check_no_merge_conflict() {
  local pr=$1
  local mergeable
  mergeable=$(gh pr view "$pr" --json mergeable --jq .mergeable)
  case "$mergeable" in
    MERGEABLE)
      echo "PASS: no_conflict: MERGEABLE"
      return 0
      ;;
    CONFLICTING)
      echo "BLOCK: no_conflict: CONFLICTING — resolve conflict and re-push"
      return 1
      ;;
    UNKNOWN)
      echo "WAIT: no_conflict: GitHub still computing merge status"
      return 2
      ;;
    *)
      echo "FAIL: no_conflict: unexpected mergeable=$mergeable"
      return 1
      ;;
  esac
}
```

- [ ] **Step 2: Smoke test sourcing**

```bash
bash -c 'source scripts/workflow/_pr-gates.sh && echo "sourced clean"'
```

Expected: `sourced clean` and exit 0. If syntax errors, fix and rerun.

- [ ] **Step 3: Smoke test each gate against PR #1342 (merged)**

```bash
bash -c 'source scripts/workflow/_pr-gates.sh && check_ci 1342'
bash -c 'source scripts/workflow/_pr-gates.sh && check_copilot_currency 1342'
bash -c 'source scripts/workflow/_pr-gates.sh && check_unresolved_threads 1342'
bash -c 'source scripts/workflow/_pr-gates.sh && check_no_merge_conflict 1342'
```

Expected for PR #1342 (a clean merged PR):

- `check_ci`: PASS or fail depending on what statusCheckRollup returns post-merge (PR is closed). May produce FAIL or empty data; that's an artifact of merged-PR state, not a bug.
- `check_copilot_currency`: PASS or WARN.
- `check_unresolved_threads`: PASS (0 unresolved on a merged PR or some old comments depending).
- `check_no_merge_conflict`: may return UNKNOWN/FAIL on a merged PR — that's expected; merged PRs return non-MERGEABLE.

The point of these tests is verifying the FUNCTIONS execute without bash errors. The pass/fail of the gates themselves on a merged PR isn't the success criterion.

- [ ] **Step 4: Run shellcheck**

```bash
shellcheck scripts/workflow/_pr-gates.sh
```

Expected: clean (no output). Fix any warnings.

- [ ] **Step 5: Commit**

```bash
git add scripts/workflow/_pr-gates.sh
git commit -m "feat(workflow): extract _pr-gates.sh shared helper with 4 gate functions (PP-d4bf)"
```

---

## Phase 2: Build `merge-pr.sh` (rename + rebuild from PR #1355's claude-merge.sh)

`merge-pr.sh` is the composite enforcer: re-evaluates all 4 gates, merges if all pass, removes the `ready-for-review` label on failure.

### Task 2.1: Write `merge-pr.sh`

**Files:**

- Create: `scripts/workflow/merge-pr.sh`

- [ ] **Step 1: Write the script**

```bash
#!/usr/bin/env bash
# merge-pr.sh — composite gate-then-merge enforcer.
# Re-evaluates all 4 PR gates at merge time (TOCTOU safety vs label-time gates),
# squash-merges with --match-head-sha if all pass, removes ready-for-review label on failure.
#
# Usage: merge-pr.sh <PR> [--dry-run] [--force]
#   --dry-run  Print would-do summary, take no action.
#   --force    Bypass threads + currency gates ONLY. CI + no_conflict gates always run.
#
# Authorship check has no --force bypass; this script operates only on PRs you authored.

set -euo pipefail

PR=""
DRY_RUN=false
FORCE=false

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --force)   FORCE=true ;;
    *) [ -z "$PR" ] && PR="$arg" || { echo "Error: unexpected argument $arg" >&2; exit 1; } ;;
  esac
done

if [ -z "$PR" ] || ! [[ "$PR" =~ ^[0-9]+$ ]]; then
  echo "Usage: $0 <PR> [--dry-run] [--force]" >&2
  exit 1
fi

# shellcheck source=./_pr-gates.sh
source "$(dirname "$0")/_pr-gates.sh"

# --- Authorship gate (no --force bypass) ---
PR_INFO=$(gh pr view "$PR" --json author,title,url,labels,headRefOid,mergeable)
PR_AUTHOR=$(jq -r .author.login <<< "$PR_INFO")
PR_TITLE=$(jq -r .title <<< "$PR_INFO")
PR_URL=$(jq -r .url <<< "$PR_INFO")
PR_LABELS=$(jq -r '.labels | map(.name) | join(",")' <<< "$PR_INFO")
PR_HEAD_SHA=$(jq -r .headRefOid <<< "$PR_INFO")
CURRENT_USER=$(gh api user --jq .login)

if [ "$PR_AUTHOR" != "$CURRENT_USER" ]; then
  echo "REFUSE: merge-pr.sh only operates on your own PRs (PR author: $PR_AUTHOR, you: $CURRENT_USER)" >&2
  exit 1
fi

echo "Target: PR #$PR — $PR_TITLE"
echo "URL: $PR_URL"
echo "Head SHA: $PR_HEAD_SHA"

# --- Run all 4 gates, collect statuses ---
GATE_FAILURES=()

run_gate() {
  local name=$1 fn=$2 enforced=$3
  local output rc
  output=$("$fn" "$PR") || rc=$?
  rc=${rc:-0}
  echo "$output"
  if [ "$rc" -ne 0 ]; then
    if [ "$FORCE" = "true" ] && [ "$enforced" = "false" ]; then
      echo "  (--force: $name gate non-pass, but bypass allowed)"
    else
      GATE_FAILURES+=("$name")
    fi
  fi
}

run_gate ci check_ci true
run_gate currency check_copilot_currency false
run_gate threads check_unresolved_threads false
run_gate no_conflict check_no_merge_conflict true

# --- Decide ---
if [ ${#GATE_FAILURES[@]} -gt 0 ]; then
  echo "RESULT: ${#GATE_FAILURES[@]} gate(s) failed: ${GATE_FAILURES[*]}"
  if [ "$DRY_RUN" = "true" ]; then
    echo "DRY RUN: would remove ready-for-review label if present"
    exit 1
  fi
  # Remove label if present
  if [[ ",$PR_LABELS," == *",ready-for-review,"* ]]; then
    echo "Removing ready-for-review label..."
    gh pr edit "$PR" --remove-label ready-for-review 2>/dev/null || true
  fi
  exit 1
fi

echo "RESULT: all gates passed"
if [ "$DRY_RUN" = "true" ]; then
  echo "DRY RUN: would run: gh pr merge $PR --squash --delete-branch --match-head-sha=$PR_HEAD_SHA"
  exit 0
fi

# --- Execute merge ---
# Bypass the block-direct-merge hook by setting the sentinel; hook deletes it on fire.
touch .claude-merge-bypass
gh pr merge "$PR" --squash --delete-branch --match-head-sha="$PR_HEAD_SHA"
echo "MERGED: PR #$PR"
```

- [ ] **Step 2: Make executable**

```bash
chmod +x scripts/workflow/merge-pr.sh
```

NOTE: `chmod` may be auto-denied at the Claude Code permission layer per Tim's global instructions. If denied, ask Tim to run `chmod +x scripts/workflow/merge-pr.sh && git update-index --chmod=+x scripts/workflow/merge-pr.sh` manually. Continue with the next step in the meantime.

- [ ] **Step 3: Run shellcheck**

```bash
shellcheck scripts/workflow/merge-pr.sh
```

Fix any warnings.

- [ ] **Step 4: Smoke test --dry-run against PR #1342 (merged, safe target)**

```bash
bash scripts/workflow/merge-pr.sh 1342 --dry-run
```

Expected output structure:

- `Target: PR #1342 — fix(deps): bump sanitize-html...`
- 4 gate lines (PASS/FAIL/WAIT/BLOCK as appropriate for a closed merged PR)
- `RESULT: N gate(s) failed: ...` OR `RESULT: all gates passed`
- `DRY RUN: would...` line

If `REFUSE: merge-pr.sh only operates on your own PRs`, the authorship check is correctly enforcing.

- [ ] **Step 5: Verify --force behavior (still --dry-run)**

```bash
bash scripts/workflow/merge-pr.sh 1342 --dry-run --force
```

Expected: any currency/threads failures show `(--force: <gate> gate non-pass, but bypass allowed)`. CI/no_conflict gates still strict.

- [ ] **Step 6: Commit**

```bash
git add scripts/workflow/merge-pr.sh
git commit -m "feat(workflow): add merge-pr.sh composite enforcer (replaces claude-merge.sh, PP-d4bf)"
```

---

## Phase 3: Clean kept scripts

### Task 3.1: Refactor `pr-watch.py` — strip advisory text and dedup `gh run list`

**Files:**

- Modify: `scripts/workflow/pr-watch.py:147`, `:183`, `:293`, `:374-421`

- [ ] **Step 1: Strip advisory text on line 147**

Find: `merge_detail += " (resolve via `git fetch origin && git merge origin/main`)"`
Replace with: deletion (just leave `merge_detail = f"mergeStateStatus={merge_state}"`).

- [ ] **Step 2: Strip advisory text on line 183**

Find: `emit("Use --force to watch anyway, or fix the items above.")`
Replace with: deletion. The audit-failed signal is the FAIL/PASS line above; agents read that.

- [ ] **Step 3: Strip advisory text on line 293**

Find: `emit(f"Run: ./scripts/workflow/copilot-comments.sh {pr}")`
Replace with: deletion. The agent's skill explains what to do when a new Copilot review is detected.

- [ ] **Step 4: Dedupe `gh run list` calls (lines 374-421)**

In the fallback block where `active` is empty, the code re-fetches `gh run list --limit 50 --branch X --json ...`. Refactor to cache the last iteration's result in a variable and reuse:

```python
# After the startup retry loop, if `active` is empty:
# `runs` (from the last successful list call) is reused for the completed-runs fallback
# instead of fetching again.
```

Specifically: rename the loop variable so it survives the loop, then use it in the fallback block instead of re-issuing `gh run list`.

- [ ] **Step 5: Run pr-watch.py audit against PR #1357**

```bash
./scripts/workflow/pr-watch.py --audit 1357
```

Expected: structured PASS/FAIL output, no `(resolve via ...)` advice, no "Use --force" advice, no "Run: ./scripts/workflow/copilot-comments.sh" advice.

- [ ] **Step 6: Commit**

```bash
git add scripts/workflow/pr-watch.py
git commit -m "refactor(workflow): strip advisory text and dedup gh run list call in pr-watch.py (PP-d4bf)"
```

### Task 3.2: Refactor `pr-dashboard.sh` — dynamic slug + cap-100 + source `_pr-gates.sh`

**Files:**

- Modify: `scripts/workflow/pr-dashboard.sh`

- [ ] **Step 1: Replace hardcoded slug with dynamic detection**

Find any line containing `timothyfroehlich/PinPoint` (or `$OWNER`/`$REPO` defined at the top).
Replace the OWNER/REPO definition with:

```bash
OWNER_REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
OWNER=$(cut -d/ -f1 <<< "$OWNER_REPO")
REPO=$(cut -d/ -f2 <<< "$OWNER_REPO")
```

- [ ] **Step 2: Source `_pr-gates.sh` to get COPILOT_LOGINS**

Add at the top after `set -euo pipefail`:

```bash
# shellcheck source=./_pr-gates.sh
source "$(dirname "$0")/_pr-gates.sh"
```

Then replace any inline Copilot allowlist definition (e.g., a tuple or inline strings in jq filters) with references to `${COPILOT_LOGINS[@]}`. For jq filters that previously inlined the logins, build a JSON array argument:

```bash
LOGINS_JSON=$(printf '%s\n' "${COPILOT_LOGINS[@]}" | jq -R . | jq -s .)
```

Then in jq: `--argjson logins "$LOGINS_JSON"` and `select($logins | index(.user.login))`.

- [ ] **Step 3: Add `--limit 100` to `gh pr list`**

Find: `gh pr list --state open --json number ...`
Replace with: `gh pr list --state open --limit 100 --json number ...`

- [ ] **Step 4: Smoke test**

```bash
./scripts/workflow/pr-dashboard.sh
```

Expected: same table as before, but no hardcoded slug visible in the script, COPILOT_LOGINS sourced, all open PRs listed up to 100.

- [ ] **Step 5: Run shellcheck**

```bash
shellcheck scripts/workflow/pr-dashboard.sh
```

- [ ] **Step 6: Commit**

```bash
git add scripts/workflow/pr-dashboard.sh
git commit -m "refactor(workflow): dynamic slug + limit 100 + source _pr-gates.sh in pr-dashboard.sh (PP-d4bf)"
```

### Task 3.3: Check `orchestration-status.sh` for stale references

**Files:**

- Modify: `scripts/workflow/orchestration-status.sh` (if needed)

- [ ] **Step 1: Search for references to soon-to-be-deleted scripts**

```bash
rg 'copilot-comments|respond-to-copilot|resolve-copilot-threads|label-ready' scripts/workflow/orchestration-status.sh
```

Expected: any matches must be removed or updated.

- [ ] **Step 2: If matches found, remove or replace**

Replace any `label-ready.sh` reference with a note pointing to the new skill OR remove the section if it was an advisory line. Replace `copilot-comments.sh` references with mentions of MCP tools per the skill.

If no matches found: skip to Step 3.

- [ ] **Step 3: Smoke test**

```bash
./scripts/workflow/orchestration-status.sh
```

Expected: runs without errors, produces the usual session-start summary.

- [ ] **Step 4: Commit (only if changes made)**

```bash
git add scripts/workflow/orchestration-status.sh
git commit -m "refactor(workflow): remove references to deleted scripts in orchestration-status.sh (PP-d4bf)"
```

---

## Phase 4: Delete obsolete scripts

### Task 4.1: Delete `copilot-comments.sh`, `respond-to-copilot.sh`, `resolve-copilot-threads.sh`, `label-ready.sh`

**Files:**

- Delete: `scripts/workflow/copilot-comments.sh`
- Delete: `scripts/workflow/respond-to-copilot.sh`
- Delete: `scripts/workflow/resolve-copilot-threads.sh`
- Delete: `scripts/workflow/label-ready.sh`

- [ ] **Step 1: Verify no in-repo references survive**

```bash
rg 'copilot-comments\.sh|respond-to-copilot\.sh|resolve-copilot-threads\.sh|label-ready\.sh' --type-not=jsonl --type-not=md
```

If matches found in code (not in docs/specs), fix the callers first BEFORE deleting. Match in docs/specs is fine — those reference the historical state.

For markdown matches: separately note them; will be cleaned in Phase 8 cross-reference updates.

- [ ] **Step 2: Delete the files**

```bash
git rm scripts/workflow/copilot-comments.sh
git rm scripts/workflow/respond-to-copilot.sh
git rm scripts/workflow/resolve-copilot-threads.sh
git rm scripts/workflow/label-ready.sh
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(workflow): delete copilot-comments/respond-to-copilot/resolve-copilot-threads/label-ready scripts (PP-d4bf)

These are replaced by direct MCP calls in the new pinpoint-pr-workflow skill:
- copilot-comments.sh → pull_request_read(method: \"get_review_comments\")
- respond-to-copilot.sh → add_reply_to_pull_request_comment + pull_request_review_write(method: \"resolve_thread\")
- resolve-copilot-threads.sh → deleted outright; bulk-aging is the wrong tool
- label-ready.sh → skill applies label via issue_write after running gates; merge-pr.sh is the enforcer"
```

### Task 4.2: Update `scripts/workflow/AGENTS.md`

**Files:**

- Modify: `scripts/workflow/AGENTS.md`

- [ ] **Step 1: Read current content to identify sections to update**

```bash
cat scripts/workflow/AGENTS.md
```

- [ ] **Step 2: Update the Scripts tables**

Remove rows for deleted scripts. Add rows for:

- `merge-pr.sh <PR>` — Re-evaluates all 4 gates and squash-merges if all pass. Removes ready-for-review label on failure. `--dry-run` to preview, `--force` to bypass threads+currency gates only.
- `_pr-gates.sh` — Shared bash helper sourced by merge-pr.sh. Defines COPILOT_LOGINS and four gate functions.

Update the row for label-ready: REMOVE.

- [ ] **Step 3: Add a "Status Token Vocabulary" section**

Add after the Scripts tables:

```markdown
## Status Token Vocabulary

Scripts emit machine-parseable status with these prefixes:

| Token    | Meaning                                                                   | Action                        |
| -------- | ------------------------------------------------------------------------- | ----------------------------- |
| `PASS:`  | Gate passed                                                               | Continue                      |
| `FAIL:`  | Hard failure                                                              | Block; fix underlying issue   |
| `WAIT:`  | Transient state (e.g., GitHub computing mergeable)                        | Retry; may resolve on its own |
| `BLOCK:` | State mismatch requiring user action (e.g., merge conflict)               | Resolve, push, retry          |
| `WARN:`  | Permitted to proceed with notice (e.g., Copilot review stale > threshold) | Continue, but informed        |
| `SKIP:`  | Gate doesn't apply (e.g., no Copilot reviews exist)                       | Continue                      |

The agent reads these tokens from script stdout to decide next steps. Scripts never emit prescriptive advice; the skill (pinpoint-pr-workflow) documents what to do for each token.
```

- [ ] **Step 4: Add an "MCP vs Script" decision table**

Add after the status token section:

```markdown
## MCP vs Script — When to use which

The new pinpoint-pr-workflow skill defaults to MCP tools for per-operation reads and writes. Scripts handle composite enforcement.

| Operation                                      | Use MCP                                                                           | Use Script                                    |
| ---------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------- |
| Read PR metadata, reviews, threads, check_runs | `pull_request_read(method: ...)`                                                  | —                                             |
| Reply to a Copilot thread                      | `add_reply_to_pull_request_comment` + `pull_request_review_write(resolve_thread)` | —                                             |
| Apply/remove PR label                          | `issue_write(method: "update", labels: [...])`                                    | —                                             |
| Re-request Copilot review                      | `request_copilot_review`                                                          | —                                             |
| Get failed CI logs                             | `get_job_logs(failed_only, tail_lines)`                                           | —                                             |
| Stream CI runs in real time                    | —                                                                                 | `pr-watch.py`                                 |
| Merge a PR                                     | —                                                                                 | `merge-pr.sh` (direct merges blocked by hook) |
| Composite gate evaluation                      | —                                                                                 | `merge-pr.sh` (sources `_pr-gates.sh`)        |

MCP field-naming gotcha: responses use snake_case (`is_resolved`, `submitted_at`, `head.sha`). GraphQL we previously used was camelCase.
```

- [ ] **Step 5: Update "Key Design Decisions" section**

Replace existing decisions with refreshed list reflecting mechanical-output principle and MCP-first stance:

```markdown
## Key Design Decisions

- **MCP first for reads and per-op writes**: typed tool calls beat shell-escaped gh CLI for the agent's use cases. Scripts wrap composite enforcement that can't be a single API call.
- **Mechanical script output**: scripts emit status (FAIL, WAIT, BLOCK, WARN, SKIP, PASS), never prescriptive advice. The skill documents what to do per token.
- **Direct merge blocked**: `gh pr merge` and MCP `merge_pull_request` are blocked by the `.claude/hooks/block-direct-merge.cjs` PreToolUse hook. Use `merge-pr.sh` to enforce gate re-checks. Bypass via `.claude-merge-bypass` sentinel file (single-use, deleted on hook fire).
- **Fail closed on Copilot API errors**: gates that can't determine state exit non-zero. Use `--force` to bypass (threads + currency gates only).
- **Pagination correctness**: `_pr-gates.sh` uses GraphQL cursor pagination for `reviewThreads` (no `first: 100` truncation) and `--paginate` + `jq -s` for REST list endpoints.
- **Single source of truth**: COPILOT_LOGINS defined in `_pr-gates.sh`, sourced by other bash scripts. pr-watch.py keeps an inline tuple with a comment pointing to `_pr-gates.sh` as canonical.
```

- [ ] **Step 6: Commit**

```bash
git add scripts/workflow/AGENTS.md
git commit -m "docs(workflow): update AGENTS.md for MCP-first architecture (PP-d4bf)"
```

---

## Phase 5: Add merge-blocking hook

### Task 5.1: Create `.claude/hooks/block-direct-merge.cjs`

**Files:**

- Create: `.claude/hooks/block-direct-merge.cjs`

- [ ] **Step 1: Write the hook**

```javascript
#!/usr/bin/env node
// .claude/hooks/block-direct-merge.cjs
// PreToolUse hook: blocks direct PR merge calls.
// Bypass: presence of .claude-merge-bypass file in repo root (single-use, deleted on fire).

const fs = require("node:fs");
const path = require("node:path");

let input = "";
process.stdin.on("data", (c) => (input += c));
process.stdin.on("end", () => {
  let payload;
  try {
    payload = JSON.parse(input);
  } catch {
    // Malformed payload — fail open to avoid breaking other hooks.
    process.exit(0);
  }

  const tool = payload.tool_name || "";
  const toolInput = payload.tool_input || {};

  let isMergeAttempt = false;
  let detail = "";

  if (tool === "Bash") {
    const cmd = String(toolInput.command || "");
    // Match `gh pr merge` (with optional flags), but not `gh pr merge --help` (rare).
    if (/\bgh\s+pr\s+merge\b/.test(cmd) && !/--help\b/.test(cmd)) {
      isMergeAttempt = true;
      detail = "gh pr merge";
    }
    // Match raw API merge: `gh api -X PUT .../pulls/N/merge` or `curl .../merge`
    if (/\bgh\s+api\s+.*-X\s+(PUT|POST)\b.*\/pulls\/\d+\/merge\b/.test(cmd)) {
      isMergeAttempt = true;
      detail = "gh api PUT .../merge";
    }
  } else if (tool === "mcp__plugin_github_github__merge_pull_request") {
    isMergeAttempt = true;
    detail = "MCP merge_pull_request";
  }

  if (!isMergeAttempt) {
    process.exit(0);
  }

  // Check for bypass sentinel.
  const cwd = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const sentinel = path.join(cwd, ".claude-merge-bypass");
  if (fs.existsSync(sentinel)) {
    // Allow this merge; consume the sentinel.
    try {
      fs.unlinkSync(sentinel);
    } catch {}
    process.exit(0);
  }

  // Block.
  console.error(
    `Direct merge blocked: ${detail}. Use scripts/workflow/merge-pr.sh <PR> to enforce gate re-checks. ` +
      `Override with: touch .claude-merge-bypass (single-use sentinel, auto-deleted on hook fire).`
  );
  process.exit(2);
});
```

- [ ] **Step 2: Wire in `.claude/settings.json` PreToolUse section**

Read current settings.json:

```bash
jq '.hooks.PreToolUse' .claude/settings.json
```

Add a new entry under `hooks.PreToolUse` that matches both `Bash` and the MCP merge tool. Use `jq` for the edit:

```bash
jq '.hooks.PreToolUse |= . + [
  {
    "matcher": "Bash|mcp__plugin_github_github__merge_pull_request",
    "hooks": [
      {
        "type": "command",
        "command": "node .claude/hooks/block-direct-merge.cjs",
        "timeout": 5000
      }
    ]
  }
]' .claude/settings.json > .claude/settings.json.tmp && mv .claude/settings.json.tmp .claude/settings.json
```

Verify:

```bash
jq '.hooks.PreToolUse[-1]' .claude/settings.json
```

Expected: the new entry visible.

- [ ] **Step 3: Smoke test — confirm hook blocks**

In a fresh Bash invocation (the hook fires on the next Bash tool call):

```bash
echo "test gh pr merge command should be blocked"
```

This should run normally (not a merge command). Then attempt:

```bash
gh pr merge 99999 --squash --delete-branch
```

(Use a non-existent PR number so even if the block fails, no merge happens.) Expected: blocking error from hook, exit code 2, never reaches gh CLI. If hook fires and blocks: PASS.

- [ ] **Step 4: Smoke test — bypass sentinel**

```bash
touch .claude-merge-bypass
ls .claude-merge-bypass && echo "sentinel exists"
# Run a no-op gh pr merge attempt (will fail at gh CLI level since PR is fake, but hook should NOT block):
gh pr merge 99999 --squash --delete-branch 2>&1 | head -5
ls .claude-merge-bypass 2>&1 || echo "sentinel deleted"
```

Expected: hook allows; gh CLI errors due to fake PR; sentinel is deleted.

- [ ] **Step 5: Verify MCP merge is also blocked**

This requires an actual MCP merge_pull_request call attempt; for safety, skip live test or use against a closed PR (`merge_pull_request` will fail at the API level for closed PRs, but the hook should fire first). Document expected behavior in commit message.

- [ ] **Step 6: Commit**

```bash
git add .claude/hooks/block-direct-merge.cjs .claude/settings.json
git commit -m "feat(hooks): add block-direct-merge hook routing through merge-pr.sh (PP-d4bf)"
```

---

## Phase 6: New skill — `pinpoint-pr-workflow`

### Task 6.1: Create the skill file

**Files:**

- Create: `.claude/skills/pinpoint-pr-workflow/SKILL.md`

- [ ] **Step 1: Write the skill**

```markdown
---
name: pinpoint-pr-workflow
description: Full PR lifecycle for PinPoint — commit, push, CI monitoring, Copilot review (via MCP), readiness labeling, gate-enforced merge. Use when committing changes, opening PRs, watching CI, addressing Copilot reviews, or merging.
---

# PinPoint PR Workflow

End-to-end pipeline from "I have changes" to "merged in main". Replaces the deprecated pinpoint-commit, pinpoint-ready-to-review, and pinpoint-github-monitor skills.

## When to use — pick your entry phase

- Uncommitted changes in tree → **Phase 1: Commit**
- Local commits, no PR yet → **Phase 2: PR**
- PR open, CI not yet green-and-clean → **Phase 3: Review**
- `ready-for-review` label applied → **Phase 4: Merge**

---

## Phase 1: Commit

### 1.1 Branch validation

- Verify NOT on main: `git rev-parse --abbrev-ref HEAD` ≠ `main`.
- Verify branch follows naming convention: `feature/*`, `fix/*`, `chore/*`, `docs/*`, `test/*`, `refactor/*`.
- Verify based on current main: `git merge-base HEAD origin/main` is recent.
- Verify NO `git rebase origin/main` ever — commandment 18 (use `git merge origin/main` instead).

### 1.2 Pre-commit validation

Default to `pnpm run check` (~12s; covers type, lint, format, unit tests, yamllint, actionlint, ruff, shellcheck). Use `pnpm run preflight` (full + integration) before commit for non-trivial changes, especially: migrations, security/auth changes, server actions, middleware.

### 1.3 E2E selection

Use this matrix based on `git diff --name-only --staged`:

| Changed file patterns                                                                                | Recommended                                   |
| ---------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `src/app/**/page.tsx`, `src/app/**/layout.tsx`, `src/app/(auth)/**`                                  | `pnpm run e2e:full` (~3-5 min)                |
| `src/components/issues/*`, `src/components/machines/*`, `src/server/actions/*`, `src/lib/supabase/*` | `pnpm run e2e:full`                           |
| `supabase/migrations/*`, `src/server/db/schema.ts`                                                   | `pnpm run preflight` (includes smoke E2E)     |
| `src/components/ui/*`, `src/lib/*` (non-supabase)                                                    | `pnpm run smoke` (~60s; already in preflight) |
| `docs/**`, `*.test.ts`, `*.spec.ts`, `.agent/**`, `scripts/*`                                        | skip additional E2E                           |

### 1.4 Commit message

Conventional commits: `<type>(<scope>): <description>`.

Types: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `style`.

PinPoint scopes: `issues`, `machines`, `auth`, `ui`, `db`, `e2e`, `agents`, `workflow`, `hooks`, `forms`, `notifications`, etc. — use the most-affected area.

### 1.5 Push

If branch has no upstream: `git push -u origin <branch-name>`. Else: `git push`.

Verify upstream tracks the branch itself, NOT main: `git branch -vv` should show `[origin/<your-branch>]`.

---

## Phase 2: PR

### 2.1 Open the PR

Prefer MCP `create_pull_request` for typed argument handling. Or use `gh pr create` if you're already in a shell context.

MCP example:

- Tool: `mcp__plugin_github_github__create_pull_request`
- Args: `owner: "timothyfroehlich"`, `repo: "PinPoint"`, `title: "<title>"`, `body: "<description>"`, `head: "<branch>"`, `base: "main"`, `draft: <true|false>`

### 2.2 PR description template
```

## Summary

- [1-3 bullets summarizing what changed and why]

## Test Plan

- [ ] [bulleted markdown checklist of TODOs for testing the PR]

## Related Issues

Closes #N (if applicable)

```

### 2.3 Draft vs ready

Open as draft if WIP. Mark ready when CI has been run at least once locally.

---

## Phase 3: Review (CI + Copilot + label)

### 3.1 Watch CI

Use Monitor tool with `pr-watch.py`:

```

Monitor(
command: "./scripts/workflow/pr-watch.py <PR>",
description: "CI watch for PR #<PR>",
persistent: false,
timeout_ms: 3600000
)

```

Exit 0 = all passed or stopped for new Copilot review. Exit 1 = failure — read `tmp/gh-monitor/failure-<RUN_ID>.md`.

### 3.2 Read Copilot review state

Use MCP:

```

mcp**plugin_github_github**pull_request_read(
method: "get_review_comments",
owner: "timothyfroehlich",
repo: "PinPoint",
pullNumber: <PR>,
perPage: 100
)

```

Returns array of review threads. Each thread has:
- `is_resolved` (snake_case! not camelCase)
- `is_outdated`
- `comments[]` with `path`, `line`, `body`, `author.login`, `html_url`, and crucially a thread node ID for resolving

Filter to threads where first comment's author is `copilot-pull-request-reviewer` or `copilot-pull-request-reviewer[bot]`.

### 3.3 Address Copilot comments

For each unresolved Copilot thread, evaluate critically. Not all suggestions warrant code changes.

**To fix**: edit code, commit, push. Copilot auto-resolves threads on detecting the fix commit. No reply needed.

**To decline**: post a one-sentence justification reply AND resolve the thread:

1. Reply:
```

mcp**plugin_github_github**add_reply_to_pull_request_comment(
owner: "timothyfroehlich",
repo: "PinPoint",
pullNumber: <PR>,
commentId: <commentId from thread>,
body: "Ignored: <one-sentence justification>. —Claude-<YourName>"
)

```

2. Resolve:
```

mcp**plugin_github_github**pull_request_review_write(
method: "resolve_thread",
threadId: <PRRT_kwDOxxx from thread>,
owner: "timothyfroehlich",
repo: "PinPoint",
pullNumber: <PR>
)

```

(Owner/repo/pullNumber not actually used for resolve_thread but tool requires them per schema.)

Sign replies with your agent name (`—Claude-Plunger`, `—Claude-Spinner`, etc.).

### 3.4 Verify Copilot reviewed the latest commit

This catches the silent-skip case where `update_pull_request_branch` or merge-from-main commits don't trigger Copilot's `review_requested` event (per PR #1342 case).

Compare:
- `pull_request_read(method: "get_reviews")` → latest `submitted_at` for a Copilot review
- `get_commit(sha: <head_sha>)` → `commit.committer.date`

If head is newer than the latest Copilot review:
- Elapsed < 600s → wait, Copilot may still be reviewing
- Elapsed >= 600s → call `request_copilot_review` once; if no review after another 60s, proceed (per the 10-minute threshold in `_pr-gates.sh`)

`merge-pr.sh` re-checks this at merge time, so the skill version is advisory; the script enforces.

### 3.5 Apply `ready-for-review` label

Once CI green + zero unresolved Copilot threads + Copilot reviewed head commit + no merge conflict:

1. Read current labels via `pull_request_read(method: "get")` and extract `.labels[]`.
2. Build new labels array: existing labels + `"ready-for-review"`.
3. Apply:

```

mcp**plugin_github_github**issue_write(
method: "update",
owner: "timothyfroehlich",
repo: "PinPoint",
issue_number: <PR>,
labels: [<existing>, "ready-for-review"]
)

```

NOTE: PR labels are added via the issues endpoint. `labels` parameter is full-replacement, so read current labels first to avoid clobbering.

The label is a hint to Tim that the PR is ready. `merge-pr.sh` re-checks all gates at merge time regardless.

---

## Phase 4: Merge

Direct `gh pr merge` and MCP `merge_pull_request` are blocked by hook. Use `merge-pr.sh`.

### 4.1 Invoke

```

./scripts/workflow/merge-pr.sh <PR>

````

Add `--dry-run` to preview, `--force` to bypass threads + currency gates (CI and no-merge-conflict gates always run).

### 4.2 Interpret output

Script emits structured status tokens:

| Token | Meaning | What to do |
|---|---|---|
| `PASS: <gate>: <state>` | Gate passed | Continue |
| `FAIL: <gate>: <state>` | Gate failed | Fix underlying issue, push, retry |
| `WAIT: <gate>: <state>` | Transient (e.g., GitHub computing mergeable) | Retry merge-pr.sh after a few seconds |
| `BLOCK: <gate>: <state>` | State mismatch requiring action (e.g., merge conflict) | Resolve, push, retry |
| `WARN: <gate>: <state>` | Permitted to proceed with notice | Continue, but be informed |
| `SKIP: <gate>: <reason>` | Gate doesn't apply | Continue |

On any FAIL: script removes `ready-for-review` label if present (the label's contract is "click-merge-without-thinking"; if a gate fails at merge time, that contract is broken). Exit 1.

On all PASS: script captures head SHA, calls `gh pr merge <PR> --squash --delete-branch --match-head-sha=<sha>`. TOCTOU-safe — if a new commit lands between gate check and merge, GitHub rejects the merge (`--match-head-sha` mismatch).

### 4.3 --force escape hatch

Use `--force` when:
- API failure on threads or currency gate where you've manually verified the underlying state is fine
- Copilot has clearly silently-skipped a merge-from-main commit AND you've reviewed the diff manually
- You're aware threads or currency gates would fail and you're explicitly accepting

Do NOT use `--force` when:
- CI is failing (gate doesn't bypass; this is intentional — never merge red CI)
- Merge conflict exists (gate doesn't bypass; conflicts can't be ignored)
- You haven't manually verified the underlying state

### 4.4 Bypass the hook (emergency only)

If you absolutely need to bypass the hook (e.g., merge-pr.sh itself is broken and you have a hotfix to ship):

```bash
touch .claude-merge-bypass
gh pr merge <PR> --squash --delete-branch
````

The sentinel is single-use — deleted on the next merge attempt. Document in commit message WHY you bypassed.

---

## MCP gotchas reference

- **snake_case fields**: responses use `is_resolved`, `submitted_at`, `head.sha`, `commit.committer.date`. Not camelCase.
- **Pagination**: cap `perPage` to 100 on list methods. Use cursor pagination via `after` for GraphQL.
- **Labels are full-replacement**: `issue_write(method: "update", labels: [...])` REPLACES the entire label set. Read current first.
- **`resolve_thread` ignores owner/repo/pullNumber**: only `threadId` matters, but the schema requires the others.
- **Thread IDs**: `PRRT_kwDOxxx` format from `get_review_comments` output.

## Status token reference

Same as in `scripts/workflow/AGENTS.md` and emitted by `merge-pr.sh`, `pr-watch.py`, and `_pr-gates.sh`.

## Cross-reference

- Spec: `docs/superpowers/specs/2026-05-16-pinpoint-pr-workflow-consolidation-design.md`
- Workflow scripts reference: `scripts/workflow/AGENTS.md`
- Subagent dispatch rules (N=1 strict, dispatch from main worktree): see `pinpoint-orchestrator` skill

````

- [ ] **Step 2: Verify LOC under 400**

```bash
wc -l .claude/skills/pinpoint-pr-workflow/SKILL.md
````

Expected: < 400 lines (target 250-350). If over, trim verbose sections.

- [ ] **Step 3: Commit**

```bash
git add .claude/skills/pinpoint-pr-workflow/SKILL.md
git commit -m "feat(skills): add pinpoint-pr-workflow consolidated skill (PP-d4bf)"
```

---

## Phase 7: Delete old skills

### Task 7.1: Delete the three old skill directories

**Files:**

- Delete: `.claude/skills/pinpoint-commit/` (entire dir)
- Delete: `.claude/skills/pinpoint-ready-to-review/` (entire dir)
- Delete: `.claude/skills/pinpoint-github-monitor/` (entire dir)

- [ ] **Step 1: Remove the directories**

```bash
git rm -r .claude/skills/pinpoint-commit
git rm -r .claude/skills/pinpoint-ready-to-review
git rm -r .claude/skills/pinpoint-github-monitor
```

- [ ] **Step 2: Commit**

```bash
git commit -m "feat(skills): delete pinpoint-commit/ready-to-review/github-monitor — superseded by pinpoint-pr-workflow (PP-d4bf)"
```

---

## Phase 8: Cross-reference updates

### Task 8.1: Update root `AGENTS.md` skills table

**Files:**

- Modify: `AGENTS.md` (section 3 skills table)

- [ ] **Step 1: Find the skills table**

```bash
rg -n 'pinpoint-commit|pinpoint-ready-to-review|pinpoint-github-monitor' AGENTS.md
```

Expected: 3 entries in the skills table (around section 3).

- [ ] **Step 2: Replace the 3 entries with 1**

Remove rows for `pinpoint-commit`, `pinpoint-ready-to-review`, `pinpoint-github-monitor`. Add row:

```
| **Workflow**   | `pinpoint-pr-workflow`           | `.claude/skills/pinpoint-pr-workflow/SKILL.md`           | Full PR lifecycle: commit, push, CI watch, Copilot review (via MCP), readiness label, gate-enforced merge. |
```

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md
git commit -m "docs(AGENTS): replace 3 deprecated skill entries with pinpoint-pr-workflow (PP-d4bf)"
```

### Task 8.2: Update `pinpoint-orchestrator/SKILL.md`

**Files:**

- Modify: `.claude/skills/pinpoint-orchestrator/SKILL.md`

- [ ] **Step 1: Remove stale `watch-ci.sh` reference**

```bash
rg -n 'watch-ci\.sh' .claude/skills/pinpoint-orchestrator/SKILL.md
```

Replace any reference to `.agent/skills/pinpoint-commit/scripts/watch-ci.sh` with `pr-watch.py` only (it's the canonical CI watcher).

- [ ] **Step 2: State N=1 rule affirmatively**

```bash
rg -n 'relaxed from PR 1353\|N=1-per-message rule' .claude/skills/pinpoint-orchestrator/SKILL.md
```

If matches: replace the historical reference with affirmative current-rule language:

> **Dispatch rule: One `Agent(isolation: "worktree")` call per message.** Dispatch, confirm the new `.claude/worktrees/agent-<hex>` directory appeared, then dispatch the next.

- [ ] **Step 3: Update skill references**

```bash
rg -n 'pinpoint-commit\|pinpoint-ready-to-review\|pinpoint-github-monitor' .claude/skills/pinpoint-orchestrator/SKILL.md
```

Replace any references with `pinpoint-pr-workflow`.

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/pinpoint-orchestrator/SKILL.md
git commit -m "docs(orchestrator): update stale watch-ci.sh ref and skill names (PP-d4bf)"
```

### Task 8.3: Update `pinpoint-dispatch-e2e-teammate/SKILL.md`

**Files:**

- Modify: `.claude/skills/pinpoint-dispatch-e2e-teammate/SKILL.md`

- [ ] **Step 1: Search for stale references**

```bash
rg -n 'pinpoint-commit\|pinpoint-ready-to-review\|pinpoint-github-monitor\|copilot-comments\.sh\|respond-to-copilot\.sh\|label-ready\.sh\|claude-merge\.sh' .claude/skills/pinpoint-dispatch-e2e-teammate/SKILL.md
```

- [ ] **Step 2: Replace any matches**

Replace skill names with `pinpoint-pr-workflow`. Replace script names with `merge-pr.sh` or MCP tool references per the skill.

- [ ] **Step 3: Commit (if changes made)**

```bash
git add .claude/skills/pinpoint-dispatch-e2e-teammate/SKILL.md
git commit -m "docs(dispatch): update skill and script references (PP-d4bf)"
```

### Task 8.4: Search-wide cleanup for any other stale references

**Files:** various

- [ ] **Step 1: Repo-wide search**

```bash
rg -l 'pinpoint-commit|pinpoint-ready-to-review|pinpoint-github-monitor|copilot-comments\.sh|respond-to-copilot\.sh|resolve-copilot-threads\.sh|label-ready\.sh|claude-merge\.sh' \
  --type-not jsonl --type-not txt --type-not log
```

Expected matches (acceptable; do NOT modify):

- `docs/superpowers/specs/2026-05-16-pinpoint-pr-workflow-consolidation-design.md` (this is the spec for this work)
- `docs/superpowers/plans/2026-05-16-pinpoint-pr-workflow-consolidation.md` (this plan)
- Historical specs (e.g., `2026-03-10-github-hardening-design.md` if it references any deleted scripts — leave as historical record)
- Markdown files with verbatim mentions in past PR descriptions or changelogs

Unexpected matches (MUST fix):

- Any active skill (`.claude/skills/*/SKILL.md`)
- Any active script
- `CLAUDE.md`
- `scripts/workflow/AGENTS.md`

- [ ] **Step 2: Fix unexpected matches**

For each unexpected match, replace the reference per the patterns established in Phases 4, 7, and 8.1-8.3.

- [ ] **Step 3: Commit (if changes made)**

```bash
git add <modified files>
git commit -m "docs: clean up stale references to deleted skills and scripts (PP-d4bf)"
```

---

## Phase 9: Final verification

### Task 9.1: Run preflight

- [ ] **Step 1: Run full preflight**

```bash
pnpm run preflight
```

Expected: PASS. If FAIL, fix and re-run.

### Task 9.2: Smoke test `merge-pr.sh --dry-run` on a real PR

- [ ] **Step 1: Pick a recent open PR (or use PR #1357 if still open)**

```bash
bash scripts/workflow/merge-pr.sh 1357 --dry-run
```

Expected: 4 gates run, structured PASS/FAIL/WAIT/BLOCK/WARN/SKIP tokens emitted, no advisory text. Last line: `DRY RUN: would...`.

### Task 9.3: Smoke test `pr-watch.py` on a PR with failing CI

- [ ] **Step 1: Run audit on PR #1357 (known CI failure)**

```bash
./scripts/workflow/pr-watch.py --audit 1357
```

Expected: structured PASS/FAIL output, no `(resolve via ...)`, no `Use --force`, no `Run: ./scripts/workflow/copilot-comments.sh`.

### Task 9.4: Smoke test hook

- [ ] **Step 1: Verify direct merge blocks**

```bash
gh pr merge 99999 --squash --delete-branch
```

Expected: blocking error from hook, never reaches gh CLI. Exit code 2.

- [ ] **Step 2: Verify bypass sentinel works**

```bash
touch .claude-merge-bypass
gh pr merge 99999 --squash --delete-branch 2>&1 | head -3
test -f .claude-merge-bypass && echo "FAIL: sentinel survived" || echo "PASS: sentinel consumed"
```

Expected: gh CLI gets called (errors at API level on fake PR), sentinel is deleted.

### Task 9.5: Token cost regression check

- [ ] **Step 1: Capture /context output**

In Claude Code, run `/context` and note:

- Skills section total tokens
- MCP tools section total tokens

Compare to baseline (before this change). Skills section should be smaller; MCP catalog should grow by ~10-15k (actions + labels toolsets). Net: should be neutral or negative.

### Task 9.6: Subagent MCP inheritance smoke test

- [ ] **Step 1: Dispatch a minimal read-only subagent**

Use the Agent tool with a tiny prompt:

```
Agent(
  description: "Verify MCP inheritance",
  subagent_type: "investigator",
  model: "sonnet",
  prompt: "Call mcp__plugin_github_github__get_me and report the login field. Nothing else."
)
```

Expected: subagent successfully calls the MCP tool and reports `timothyfroehlich`. If "tool not loaded" or schema error, the subagent doesn't inherit MCP — note in the PR description that MCP-using skill steps may not work in dispatched subagents.

---

## Phase 10: PR

### Task 10.1: Push branch

- [ ] **Step 1: Push final state**

```bash
git push
```

### Task 10.2: Open PR

- [ ] **Step 1: Create PR**

```bash
gh pr create \
  --title "feat(workflow): consolidate PR workflow into single skill + MCP-first scripts (PP-d4bf)" \
  --body "$(cat <<'EOF'
## Summary

Consolidates 3 workflow skills into 1, replaces 4 gh-CLI wrapper scripts with direct MCP calls, keeps composite enforcement scripts (merge-pr.sh, pr-watch.py, pr-dashboard.sh), adds hook blocking direct merges.

## Design

Full spec: docs/superpowers/specs/2026-05-16-pinpoint-pr-workflow-consolidation-design.md

Architecture: MCP for per-operation reads/writes via skill instructions; scripts for composite enforcement that can't trust the agent to be careful; hook ensures merge calls route through merge-pr.sh.

## Changes

- **Skill consolidation**: 3 skills (pinpoint-commit/ready-to-review/github-monitor, ~830 LOC total) → 1 skill (pinpoint-pr-workflow, ~350 LOC).
- **Scripts deleted**: copilot-comments.sh, respond-to-copilot.sh, resolve-copilot-threads.sh, label-ready.sh.
- **Scripts kept + cleaned**: merge-pr.sh (renamed from claude-merge.sh), _pr-gates.sh (shared helper), pr-watch.py (advisory text stripped, gh run list dedup), pr-dashboard.sh (dynamic slug, source _pr-gates.sh).
- **New hook**: .claude/hooks/block-direct-merge.cjs blocks gh pr merge and MCP merge_pull_request, routes through merge-pr.sh. Bypass: .claude-merge-bypass sentinel (single-use).
- **Docs updated**: AGENTS.md skills table, scripts/workflow/AGENTS.md, pinpoint-orchestrator/SKILL.md, pinpoint-dispatch-e2e-teammate/SKILL.md.

## Audit findings addressed

- 4 advisory-text violations in scripts → stripped, replaced with structured status tokens.
- 6+ pagination bugs (silent truncation on >100 threads or >30 reviews) → cursor-based GraphQL pagination + `--paginate` + `jq -s` in REST callers.
- Copilot allowlist duplicated in 8+ places → single COPILOT_LOGINS constant in _pr-gates.sh, sourced by other scripts.
- Currency check duplicated in 3 implementations → single canonical check_copilot_currency in _pr-gates.sh.
- Same GraphQL skeleton in 6 files → centralized in check_unresolved_threads.
- PR #1355's short-circuit regression → all gates run, all failures reported.
- TOCTOU between gate check and merge → --match-head-sha enforced.
- Hardcoded repo slug → dynamic via gh repo view --jq nameWithOwner.

## Test plan

- [x] pnpm run preflight passes
- [x] merge-pr.sh --dry-run emits structured tokens, no advisory text
- [x] pr-watch.py --audit emits structured tokens, no advisory text
- [x] Hook blocks gh pr merge; bypass sentinel works once
- [x] /context shows skill section shrunk, MCP catalog grew ~15k
- [x] Subagent MCP inheritance smoke test passes (or documented if not)

## Supersedes

Closes #1355 (claude-merge + shared gates extraction — superseded by this larger consolidation).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

### Task 10.3: Update bead PP-d4bf

- [ ] **Step 1: Capture PR URL and update bead**

```bash
PR_URL=$(gh pr view --json url --jq .url)
bd update PP-d4bf --notes "PR opened: $PR_URL. Implements spec at docs/superpowers/specs/2026-05-16-pinpoint-pr-workflow-consolidation-design.md."
```

Do NOT close the bead yet — it closes when the PR merges.

---

## Self-review checklist (post-write)

Spec coverage map:

| Spec section                                                | Plan task(s)                                                |
| ----------------------------------------------------------- | ----------------------------------------------------------- |
| 1. MCP Toolset Configuration                                | Task 0.1, 0.2, 0.3                                          |
| 2. Architectural rules                                      | Reflected throughout                                        |
| 3. Script changes — DELETE                                  | Task 4.1                                                    |
| 3. Script changes — RENAME (merge-pr.sh)                    | Task 2.1                                                    |
| 3. Script changes — KEEP+REFACTOR (\_pr-gates.sh)           | Task 1.1                                                    |
| 3. Script changes — KEEP+REFACTOR (pr-watch.py)             | Task 3.1                                                    |
| 3. Script changes — KEEP+REFACTOR (pr-dashboard.sh)         | Task 3.2                                                    |
| 3. Script changes — KEEP+REFACTOR (orchestration-status.sh) | Task 3.3                                                    |
| 4. New hook                                                 | Task 5.1                                                    |
| 5. New skill                                                | Task 6.1                                                    |
| 6. Skill deletions + cross-skill edits                      | Tasks 7.1, 8.1-8.4                                          |
| 7. MCP usage documentation                                  | Embedded in Task 6.1 skill                                  |
| 8. Migration plan / PR strategy                             | Tasks 0.4, 0.5, 10.1, 10.2                                  |
| 9. Verification matrix                                      | Phase 9 (Tasks 9.1-9.6)                                     |
| 10. Out of scope                                            | (not actionable; documented in spec)                        |
| 11. Open follow-ups                                         | (separate beads; mentioned in spec)                         |
| 12. Risk + backout                                          | (covered by per-commit revertability + verification matrix) |

All spec requirements have plan tasks.

## Out of scope (per spec, not implemented here)

- `stale-worktrees.sh` path-filter fix
- `.claude/hooks/` shared helper extraction
- pr-watch.py migration to `get_job_logs` via gh CLI subprocess
- PR #1357 Copilot comments + CI failure (separate effort)
- GitHub MCP memory file update
