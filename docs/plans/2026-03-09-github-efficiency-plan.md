# GitHub Workflow Efficiency Rewrite — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace rate-limit-burning shell scripts with GitHub MCP server calls, reducing API usage by ~90%.

**Architecture:** Delete 4 shell scripts replaced by MCP tools (`pull_request_read`, `add_reply_to_pull_request_comment`). Create one thin `resolve-thread.sh` for the single missing MCP mutation. Remove the review-polling subshell from `monitor-gh-actions.sh`. Update skill files to describe MCP-first workflows with lightweight subagent guidance.

**Tech Stack:** GitHub MCP Server (v0.31.0+), `gh` CLI, bash, GraphQL

**Design doc:** `docs/plans/2026-03-09-github-efficiency-design.md`

---

## Task 1: Create `resolve-thread.sh`

The one thing MCP can't do yet. Thin GraphQL wrapper for `resolveReviewThread`.

**Files:**

- Create: `scripts/workflow/resolve-thread.sh`

**Step 1: Write the script**

```bash
#!/bin/bash
# scripts/workflow/resolve-thread.sh
# Resolve one or more GitHub PR review threads by node ID.
# This is a stopgap until github/github-mcp-server merges PR #1919.
#
# Usage:
#   ./scripts/workflow/resolve-thread.sh <thread-node-id> [thread-node-id...]
#
# Thread node IDs look like: PRRT_kwDOLm3Abc5kXyZ123
# Get them from MCP pull_request_read(method: "get_review_comments").

set -euo pipefail

if [ $# -lt 1 ]; then
    echo "Usage: $0 <thread-node-id> [thread-node-id...]"
    echo "  Resolves GitHub PR review threads by their GraphQL node ID."
    exit 1
fi

FAILED=0

for THREAD_ID in "$@"; do
    if ! [[ "$THREAD_ID" =~ ^PRRT_ ]]; then
        echo "WARN: '$THREAD_ID' doesn't look like a thread node ID (expected PRRT_...). Trying anyway."
    fi

    if gh api graphql -f query="
    mutation {
      resolveReviewThread(input: {threadId: \"$THREAD_ID\"}) {
        thread { isResolved }
      }
    }" --silent 2>/dev/null; then
        echo "Resolved: $THREAD_ID"
    else
        echo "FAILED: $THREAD_ID"
        FAILED=$((FAILED + 1))
    fi
done

if [ "$FAILED" -gt 0 ]; then
    echo "$FAILED thread(s) failed to resolve."
    exit 1
fi
```

**Step 2: Make it executable and test**

Run: `chmod +x scripts/workflow/resolve-thread.sh && shellcheck scripts/workflow/resolve-thread.sh`
Expected: No shellcheck warnings.

**Step 3: Commit**

```bash
git add scripts/workflow/resolve-thread.sh
git commit -m "feat(workflow): add resolve-thread.sh — thin GraphQL stopgap for MCP gap"
```

---

## Task 2: Remove review-polling from `monitor-gh-actions.sh`

The 20-second review-polling subshell (lines 68-89) burns ~600 REST calls per CI run.
Agents now check for reviews via MCP after CI completes — no need to poll during CI.

**Files:**

- Modify: `scripts/workflow/monitor-gh-actions.sh:66-89` (delete review watcher)
- Modify: `scripts/workflow/monitor-gh-actions.sh:104-107` (delete cleanup block)

**Step 1: Remove the review-polling subshell**

Delete the following sections from `monitor-gh-actions.sh`:

1. Remove lines 65-66 (early exit flag and trap — simplify trap to just kill CI watchers):

   ```bash
   # Replace:
   EARLY_EXIT=false
   trap 'EARLY_EXIT=true; kill "${PIDS[@]}" 2>/dev/null || true' TERM

   # With:
   trap 'kill "${PIDS[@]}" 2>/dev/null || true; exit 0' TERM
   ```

2. Delete lines 68-89 entirely (the `REVIEW_WATCHER_PID` block and polling subshell).

3. Delete lines 104-107 (the review watcher cleanup block):

   ```bash
   # Delete:
   if [ -n "$REVIEW_WATCHER_PID" ]; then
       kill "$REVIEW_WATCHER_PID" 2>/dev/null || true
   fi
   ```

4. Simplify the wait loop — remove `EARLY_EXIT` checks (lines 99, 109-111):

   ```bash
   # Replace:
   if [ "$EXIT_CODE" -ne 0 ] && ! $EARLY_EXIT; then
   # With:
   if [ "$EXIT_CODE" -ne 0 ]; then

   # Delete the early exit block:
   if $EARLY_EXIT; then
       exit 0
   fi
   ```

**Step 2: Verify with shellcheck**

Run: `shellcheck scripts/workflow/monitor-gh-actions.sh`
Expected: No warnings.

**Step 3: Commit**

```bash
git add scripts/workflow/monitor-gh-actions.sh
git commit -m "fix(workflow): remove review-polling from monitor-gh-actions.sh

The 20s review-polling subshell burned ~600 REST calls per CI run and was
the root cause of 403 rate-limit errors. Review detection now happens via
MCP after CI completes."
```

---

## Task 3: Consolidate `label-ready.sh` API calls

Replace the `gh pr view` + `gh pr checks` two-call pattern with single `gh pr view --json`.

**Files:**

- Modify: `scripts/workflow/label-ready.sh:40-72`

**Step 1: Consolidate the PR metadata + CI check calls**

Replace the current two-call pattern (lines 40-72) with a single `gh pr view --json` call
that fetches everything at once:

```bash
# Replace:
#   pr_data=$(gh pr view "$PR" --json headRefName,isDraft ...)
#   checks=$(gh pr checks "$PR" --json name,state ...)
# With:
pr_data=$(gh pr view "$PR" --json headRefName,isDraft,statusCheckRollup 2>/dev/null) || {
    echo "FAIL: Could not fetch PR #${PR}."
    exit 1
}
branch=$(echo "$pr_data" | jq -r '.headRefName')
is_draft=$(echo "$pr_data" | jq -r '.isDraft')

echo "PR #${PR} — branch: ${branch}"

# Check draft
if [ "$is_draft" = "true" ]; then
    echo "SKIP: PR is a draft."
    exit 1
fi

# CI status from statusCheckRollup (same data, one fewer API call)
checks=$(echo "$pr_data" | jq '[.statusCheckRollup[] | {name: .name, state: .conclusion // .status}]')
total=$(echo "$checks" | jq 'length')
failed=$(echo "$checks" | jq '[.[] | select((.state != "SUCCESS") and (.state != "IN_PROGRESS") and (.state != "QUEUED") and (.state != "PENDING") and (.state != "CANCELLED") and (.state != "SKIPPED") and (.name | startswith("codecov/") | not))] | length')
pending=$(echo "$checks" | jq '[.[] | select(.state == "IN_PROGRESS" or .state == "QUEUED" or .state == "PENDING")] | length')
```

Note: `statusCheckRollup` uses `.conclusion` (completed checks) or `.status` (in-progress).
The `// .status` fallback handles both.

**Step 2: Verify with shellcheck**

Run: `shellcheck scripts/workflow/label-ready.sh`
Expected: No warnings.

**Step 3: Commit**

```bash
git add scripts/workflow/label-ready.sh
git commit -m "perf(workflow): consolidate label-ready.sh from 2 API calls to 1

Use gh pr view --json statusCheckRollup to get CI status in the same call
as PR metadata, eliminating a separate gh pr checks call."
```

---

## Task 4: Delete scripts replaced by MCP

These scripts are fully replaced by MCP tools. Delete them and update `orchestration-status.sh`.

**Files:**

- Delete: `scripts/workflow/copilot-comments.sh`
- Delete: `scripts/workflow/respond-to-copilot.sh`
- Delete: `scripts/workflow/resolve-copilot-threads.sh`
- Delete: `scripts/workflow/pr-dashboard.sh`
- Modify: `scripts/workflow/orchestration-status.sh:57-63`

**Step 1: Delete the four scripts**

```bash
git rm scripts/workflow/copilot-comments.sh
git rm scripts/workflow/respond-to-copilot.sh
git rm scripts/workflow/resolve-copilot-threads.sh
git rm scripts/workflow/pr-dashboard.sh
```

**Step 2: Update `orchestration-status.sh`**

The PR Dashboard section (lines 57-63) calls `pr-dashboard.sh`. Replace it with a note
that agents should use MCP tools directly:

```bash
# Replace:
if [ "$SHOW_PRS" = "true" ]; then
    echo "========================================"
    echo " PR Dashboard"
    echo "========================================"
    echo ""
    bash "$SCRIPT_DIR/pr-dashboard.sh" 2>/dev/null || echo "  (no open PRs or error fetching)"
    echo ""
fi

# With:
if [ "$SHOW_PRS" = "true" ]; then
    echo "========================================"
    echo " PR Dashboard"
    echo "========================================"
    echo ""
    # PR data is now fetched via GitHub MCP tools (pull_request_read).
    # Use: gh pr list --state open --json number,title,headRefName,isDraft --jq '.[] | "#\(.number) \(.title) [\(.headRefName)]"'
    gh pr list --state open --json number,title,headRefName,isDraft,mergeable \
        --jq '.[] | "#\(.number) \(.title | .[0:40]) [\(.headRefName)] draft=\(.isDraft) merge=\(.mergeable)"' \
        2>/dev/null || echo "  (no open PRs or error fetching)"
    echo ""
fi
```

**Step 3: Verify with shellcheck**

Run: `shellcheck scripts/workflow/orchestration-status.sh`
Expected: No warnings.

**Step 4: Commit**

```bash
git add -A scripts/workflow/
git commit -m "refactor(workflow): delete 4 scripts replaced by GitHub MCP server

Removed:
- copilot-comments.sh (5 API calls) → MCP pull_request_read get_review_comments
- respond-to-copilot.sh (3 API calls) → MCP add_reply_to_pull_request_comment + resolve-thread.sh
- resolve-copilot-threads.sh (2+N calls) → MCP listing + resolve-thread.sh
- pr-dashboard.sh (3×N calls) → MCP tools / gh pr list

orchestration-status.sh updated to use gh pr list instead of pr-dashboard.sh."
```

---

## Task 5: Rewrite `pinpoint-ready-to-review` skill

MCP-first workflow with lightweight subagent guidance.

**Files:**

- Modify: `.agent/skills/pinpoint-ready-to-review/SKILL.md`

**Step 1: Rewrite the skill**

````markdown
---
name: pinpoint-ready-to-review
description: Use when a PR exists and needs to be verified and labeled ready for human review. Triggers on "ready to review", "get it ready", "mark as ready", "address copilot", "label ready", or after pushing a PR branch.
---

# PinPoint: Ready-to-Review

Three steps must complete before a PR is ready for human review: CI must pass,
Copilot comments must be addressed via MCP, then `label-ready.sh` applies the label.

---

## Step 1: Watch CI

**Use the dedicated monitoring script — never write a manual polling loop:**

```bash
./scripts/workflow/monitor-gh-actions.sh <PR>
```
````

| Exit condition   | Action                                       |
| ---------------- | -------------------------------------------- |
| All passing      | Proceed to Step 2                            |
| Any failed       | Stop — investigate and fix before continuing |
| Timeout (10 min) | Report to user, leave PR open                |

---

## Step 2: Fetch Copilot Comments (MCP + Subagent)

After CI passes, spawn a **lightweight subagent** to fetch and summarize Copilot review
comments. This protects the main context from large API responses.

**Subagent model:** Use a small, fast model — Claude Haiku (`claude-haiku-4-5-20251001`),
Gemini Flash, or equivalent. The task is simple data extraction, not reasoning.

**Subagent prompt:**

> Fetch review comments for PR #<NUMBER> on timothyfroehlich/PinPoint using MCP tools.
>
> 1. Call `pull_request_read` with `method: "get_review_comments"`, `owner: "timothyfroehlich"`, `repo: "PinPoint"`, `pullNumber: <NUMBER>`.
> 2. Filter to threads where:
>    - `isResolved` is `false`
>    - The first comment's author login contains `copilot`
> 3. Return a structured summary as a markdown table:
>
>    ```
>    | File:Line | Comment ID | Thread ID | Summary |
>    ```
>
>    - `Comment ID`: the numeric `databaseId` or `id` field (needed for `add_reply_to_pull_request_comment`)
>    - `Thread ID`: the node ID like `PRRT_...` (needed for `resolve-thread.sh`)
>    - `Summary`: first 80 chars of the comment body
>
> 4. If no unresolved Copilot threads exist, return "No unresolved Copilot comments."
> 5. Also report review freshness: call `pull_request_read` with `method: "get_reviews"`.
>    If the latest Copilot review's `submittedAt` is older than the PR's head commit date,
>    report "Copilot review pending (last push is newer than last review)."

**If review is pending:** Wait 60s and re-check, up to 5 times. Copilot typically
reviews within 2-3 minutes.

**If comments exist:**

1. Evaluate each critically — not all Copilot suggestions are correct
2. Fix code or decide to ignore with justification
3. Reply via MCP:
   ```
   Call: add_reply_to_pull_request_comment
     owner: "timothyfroehlich"
     repo: "PinPoint"
     pullNumber: <PR>
     commentId: <Comment ID from subagent>
     body: "Fixed: <what you did>. —<AgentName>"
   ```
4. Resolve via script (MCP can't do this yet):
   ```bash
   ./scripts/workflow/resolve-thread.sh <Thread ID from subagent>
   ```
5. Push fix, then re-run the subagent — Copilot may re-review after the push

**Rules:**

- Every Copilot comment gets a reply — no silent fixes or silent ignores
- Keep replies to one sentence
- Sign with agent name (`—Claude`, `—Gemini`, `—Codex`, etc.)
- If Copilot is wrong, say why (helps future reviews)

---

## Step 3: Label Ready

Once CI is green and Copilot comments are resolved:

```bash
./scripts/workflow/label-ready.sh <PR>
```

This script verifies CI + unresolved Copilot thread count + draft state before applying
the label. Use `--dry-run` to preview without acting.

````

**Step 2: Commit**

```bash
git add .agent/skills/pinpoint-ready-to-review/SKILL.md
git commit -m "docs(skill): rewrite pinpoint-ready-to-review for MCP-first workflow

- Copilot comments fetched via MCP pull_request_read, not shell scripts
- Replies via MCP add_reply_to_pull_request_comment
- Resolves via resolve-thread.sh (MCP gap stopgap)
- Lightweight subagent (Haiku/Flash) for large response protection"
````

---

## Task 6: Update `pinpoint-github-monitor` skill

Remove review-polling references since `monitor-gh-actions.sh` no longer polls for reviews.

**Files:**

- Modify: `.agent/skills/pinpoint-github-monitor/SKILL.md`

**Step 1: Rewrite the skill**

````markdown
---
name: pinpoint-github-monitor
description: Monitor GitHub Actions, watch builds, and automatically transition to debugging on failure. Use when user says "monitor github actions", "watch builds", or "check actions".
---

# GitHub Actions Monitor Skill

Use this skill whenever you are asked to "monitor the github actions" or "watch the builds".

## 0. Pre-Check: Merge Conflicts

Before investigating CI failures, ALWAYS check merge status first:

```bash
gh pr view <PR> --json mergeable --jq '.mergeable'
```
````

If the result is `CONFLICTING`, resolve merge conflicts before investigating other
failures. A dirty merge state blocks all CI checks and wastes debugging time.

## 1. Run the Monitor

```bash
./scripts/workflow/monitor-gh-actions.sh <PR>
```

This script uses `gh run watch` to monitor active CI runs. It blocks until all runs
complete, then reports pass/fail. On failure, logs are written to
`tmp/monitor-gh-actions/action-failure.md`.

**For background monitoring** (Claude Code / Antigravity):

1. Run: `./scripts/workflow/monitor-gh-actions.sh <PR> &`
2. Periodically check for `tmp/monitor-gh-actions/MONITOR_FAILED`
3. If the signal file exists, read `tmp/monitor-gh-actions/action-failure.md`

**For foreground monitoring** (Gemini / Codex):

1. Run: `./scripts/workflow/monitor-gh-actions.sh <PR>`
2. Check exit code: 0 = all passed, 1 = failure detected

## 2. On Failure: Automatic Debugging

If a failure is detected, you are authorized and encouraged to:

1. Analyze the logs in `tmp/monitor-gh-actions/action-failure.md`
2. Explore the codebase to find relevant logic
3. Run local reproduction tests
4. Apply fixes and re-monitor until all checks pass

## 3. After CI Passes: Check for Copilot Reviews

CI passing does NOT mean the PR is ready. After CI completes:

1. Load the `pinpoint-ready-to-review` skill
2. Follow Step 2 (fetch Copilot comments via MCP subagent)
3. Address any comments, then label ready

````

**Step 2: Commit**

```bash
git add .agent/skills/pinpoint-github-monitor/SKILL.md
git commit -m "docs(skill): simplify pinpoint-github-monitor, remove review-polling

Review detection now happens via MCP after CI completes, not during CI.
References pinpoint-ready-to-review skill for the Copilot workflow."
````

---

## Task 7: Update `AGENTS.md` Copilot section

Replace shell-script-based instructions with MCP-first workflow.

**Files:**

- Modify: `AGENTS.md:233-264` (GitHub Copilot Reviews section)

**Step 1: Rewrite the section**

Replace lines 233-264 with:

```markdown
### GitHub Copilot Reviews

**MANDATORY**: When addressing Copilot review comments on a PR, you MUST reply to and resolve each thread.

**Workflow (MCP-first):**

1. **Fetch comments** — spawn a lightweight subagent (Haiku / Gemini Flash) to call
   `pull_request_read(method: "get_review_comments")` and return a structured summary
   of unresolved Copilot threads (file:line, comment ID, thread node ID, body preview).
   This protects main context from large API responses.

2. **Fix the code** (or decide to ignore with justification)

3. **Reply** via MCP:
```

add_reply_to_pull_request_comment(
owner: "timothyfroehlich", repo: "PinPoint",
pullNumber: <PR>, commentId: <ID>,
body: "Fixed: <what you did>. —<AgentName>"
)

````

4. **Resolve** via script (MCP gap — will be removed when github-mcp-server PR #1919 merges):
```bash
./scripts/workflow/resolve-thread.sh <PRRT_thread-node-id>
````

Sign replies with your agent name (`—Claude`, `—Gemini`, `—Codex`, etc.).

**Rules:**

- Every Copilot comment gets a reply — no silent fixes or silent ignores
- Keep replies to one sentence
- If Copilot is wrong, say why (helps future reviews)
- Resolve threads immediately after replying, not in bulk at the end

````

**Step 2: Commit**

```bash
git add AGENTS.md
git commit -m "docs(agents): rewrite Copilot Reviews section for MCP-first workflow

Shell scripts replaced by MCP tools:
- pull_request_read(get_review_comments) for fetching
- add_reply_to_pull_request_comment for replies
- resolve-thread.sh for the one remaining MCP gap"
````

---

## Task 8: Run preflight and verify

**Step 1: Run linters on all changed shell scripts**

```bash
shellcheck scripts/workflow/resolve-thread.sh scripts/workflow/monitor-gh-actions.sh scripts/workflow/label-ready.sh scripts/workflow/orchestration-status.sh
```

Expected: No warnings.

**Step 2: Run actionlint if any GHA workflows reference deleted scripts**

```bash
rg "copilot-comments\|respond-to-copilot\|resolve-copilot-threads\|pr-dashboard" .github/
```

Expected: No matches. If any `.yml` files reference deleted scripts, update them.

**Step 3: Search for any other references to deleted scripts**

```bash
rg "copilot-comments\.sh\|respond-to-copilot\.sh\|resolve-copilot-threads\.sh\|pr-dashboard\.sh" --type md --type yaml --type sh
```

Fix any remaining references (skill files, CLAUDE.md, AGENTS.md, hooks).

**Step 4: Run check**

```bash
pnpm run check
```

Expected: All checks pass. Shell scripts don't affect TypeScript/lint/tests but this
confirms nothing else broke.

**Step 5: Final commit if any fixups needed**

```bash
git add -A && git commit -m "chore: fix remaining references to deleted workflow scripts"
```

---

## Task 9: Update bead and push

**Step 1: Update the bead**

```bash
bd update PinPoint-e0e1 --status=in_progress
bd update PinPoint-e0e1 --notes="Implemented: MCP-first workflow, deleted 4 scripts, resolve-thread.sh stopgap, updated 3 skills. Remaining: delete resolve-thread.sh when github-mcp-server PR #1919 merges."
```

**Step 2: Push**

```bash
git push -u origin worktree/github-efficiency
```
