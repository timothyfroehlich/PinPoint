# PinPoint PR Workflow Consolidation

**Date**: 2026-05-16
**Status**: Draft
**Bead**: PP-d4bf (repurpose; existing scope was a stepping stone — this supersedes)
**Supersedes**: PR #1355 (close, reuse branch name `feat/claude-merge-shared-gates-PP-d4bf`)

## Problem

Three workflow skills, ten workflow scripts, and one new (in-flight) `claude-merge.sh` together form PinPoint's PR pipeline. Audit work in this session surfaced systemic issues:

**Skill drift**:

- `pinpoint-commit` (678 LOC) is 6× the value-add target — most content is pseudocode showing git commands the agent already knows. Phase 6 explicitly delegates to `pinpoint-ready-to-review` then re-documents the same steps inline. Phase 3.2 Scenario C presents `git rebase` as a valid option, contradicting commandment 18.
- `pinpoint-ready-to-review` (50 LOC) is correct but isolated — handoff seams with `pinpoint-commit` and `pinpoint-github-monitor`.
- `pinpoint-github-monitor` framed for cross-platform agent runtime distinctions that don't apply to a solo developer's setup.

**Script duplication**:

- Copilot login allowlist (`copilot-pull-request-reviewer` + `[bot]` variant) appears in 8+ locations across 6 files.
- Copilot currency check has 3 separate implementations (`copilot-comments.sh:64-98`, `label-ready.sh:90-151` on main, `_pr-gates.sh:check_copilot_currency` in PR #1355).
- The same GraphQL `reviewThreads(first: 100)` query skeleton — including the `repository > pullRequest > reviewThreads > comments > author` shape — duplicated across 6 files.
- 6 of 7 GraphQL callers omit cursor pagination, silently truncating at 100 threads.

**Script correctness/style issues**:

- 4 advisory-text violations: scripts emit prescriptive English ("re-run in ~3min, or use --force", "resolve and re-push (git fetch origin && git merge origin/main)") instead of mechanical status. Tim's mental model: scripts are mechanical, skills explain how to use them.
- `copilot-comments.sh:68` fetches `/pulls/$PR/reviews` without `--paginate` or `per_page` — silent staleness bug on long PRs.
- PR #1355's new `label-ready.sh` introduced short-circuit gating (exits on first failure); main version ran all gates. Sister script `claude-merge.sh` runs all. Inconsistent.
- `claude-merge.sh` makes 4-5 separate `gh pr view` calls for the same PR — collapsible to 1 combined `--json` selector.
- `pr-watch.py` fetches `gh run list --limit 50 --branch X` twice with identical args when no active runs are found.
- CI check status fetched via `gh pr checks` (returns `state`) in some scripts and `gh pr view --json statusCheckRollup` (returns `status`/`conclusion`) in others — schema inconsistency makes agent parsing unreliable.

**PR #1355 specific**:

- 8 unresolved Copilot comments. All substantive: `--force` doesn't actually skip API-error failures (claims do but logic doesn't), CANCELLED CI runs treated as passing, off-by-one on the 30s mergeable-state retry, `gh api --paginate` + jq pagination bug, TOCTOU between gate check and `gh pr merge`, hardcoded "~3min" retry hint, advisory strings in `gate_failures` array.
- claude-merge.sh + `_pr-gates.sh` extension was correct in concept (re-evaluate gates at merge time) but designed pre-MCP — assumes scripts-only architecture.

**GitHub MCP availability change**:

- The official `claude-plugins-official/github` plugin is now authenticated and connected. 50+ `mcp__plugin_github_github__*` tools are available in the deferred-tool catalog. Verification on PR #1357 confirmed `pull_request_read` (with methods get, get_review_comments, get_reviews, get_check_runs), `get_commit`, `issue_write`, `add_reply_to_pull_request_comment`, `pull_request_review_write(resolve_thread)`, `update_pull_request_branch`, `request_copilot_review`, and `merge_pull_request` all work with the existing default toolsets.
- The `actions` toolset adds `actions_get`, `actions_list`, `actions_run_trigger`, `get_job_logs(failed_only, return_content, tail_lines)`. Not loaded by default.
- The `labels` toolset is expected to add PR-label add/remove. Not loaded by default. Tools loaded only after settings update + Claude Code restart.

## Design

Single consolidated change. Architecture: **MCP for per-operation reads/writes, scripts for composite enforcement boundaries**.

### 1. MCP Toolset Configuration

Add `actions` and `labels` toolsets via global user settings (`~/.claude/settings.json`) so all sessions and subagents inherit. Override the plugin's default `.mcp.json` with an `X-MCP-Toolsets` header.

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

Note the header approach is additive — default toolsets (pull_requests, issues, repos, copilot, users, search, secret_protection) remain loaded; `actions` and `labels` are added on top. Token cost: +~10-15k always-on catalog tokens.

After saving settings, fully restart Claude Code. Verify with `/mcp` status and a smoke test (`pull_request_read` or any other MCP call).

### 2. Architectural rules

| Rule                                               | Rationale                                                                                                                                                      |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MCP for agent-driven per-operation reads/writes    | Direct typed calls. No shell escaping or jq filtering. Auth managed by plugin.                                                                                 |
| Scripts for composite gate-then-action enforcement | Bash can't call MCP from inside a script. Composite operations stay bash; each individual API call uses `gh` CLI (which shares auth with MCP via the keyring). |
| Hooks block direct merge                           | Force agent through `merge-pr.sh` even when MCP `merge_pull_request` is one tool call away. Belt-and-suspenders.                                               |
| Scripts output mechanical status, not advice       | Tim's mental model. Skills explain what to do with status output.                                                                                              |
| Skills explain when to use which path              | Single source of truth for workflow decisions.                                                                                                                 |
| Skill consolidation: one skill replaces three      | Pipeline is one flow; splitting creates seam-bugs.                                                                                                             |

### 3. Script changes

#### DELETE

- `scripts/workflow/copilot-comments.sh` — MCP `pull_request_read(method: "get_review_comments")` replaces the read path. The NOTE block about evaluating Copilot critically moves to the skill. The `get_review_status()` currency logic also moves to the skill (was already duplicated 3 ways).
- `scripts/workflow/respond-to-copilot.sh` — MCP `add_reply_to_pull_request_comment` + `pull_request_review_write(method: "resolve_thread")` directly. The thread-matching-by-path:line logic moves to the skill as a documented pattern using `get_review_comments` output (which includes path + line + threadId).
- `scripts/workflow/resolve-copilot-threads.sh` — delete outright. Bulk-aging Copilot threads by commit date is the wrong tool; threads should be resolved individually with a reason, or auto-resolved by Copilot when it detects a fix commit. No skill replacement needed.
- `scripts/workflow/label-ready.sh` — the label apply step moves into the skill (agent calls MCP after running gate checks). The label is a hint to the human, not an enforced contract — `merge-pr.sh` is the actual enforcer at merge time. Apply via MCP `issue_write(method: "update", labels: [...current..., "ready-for-review"])` since PRs share the issues endpoint for labels.

#### RENAME

- `scripts/workflow/claude-merge.sh` → `scripts/workflow/merge-pr.sh`. The `claude-` prefix was unnecessary scope creep. Same role: composite gate-then-merge enforcer.

#### KEEP + REFACTOR

**`scripts/workflow/merge-pr.sh`** (renamed from claude-merge.sh, fixes per audit):

- Sources `_pr-gates.sh`. Runs all 4 gates and reports all failures before exiting (no short-circuit).
- Gate failures: structured output only. Format: `FAIL: <gate-name>: <one-line status>`. No "try this", no "wait ~3min". Status describes state, not next action.
- `--force` flag: bypasses **threads** + **currency** gates only. CI and merge-conflict gates always run (commandment-level: you cannot defensibly merge red CI or a CONFLICTING PR even with --force).
- On gate failure: remove `ready-for-review` label if present (via `gh pr edit --remove-label`; squelch errors if absent). Exit 1.
- On gate pass: call `gh pr merge <PR> --squash --delete-branch --match-head-sha=<sha>` where `<sha>` is the head SHA captured BEFORE running gates. The `--match-head-sha` flag fails the merge if a new push lands during the gate window — TOCTOU fix per Copilot comment on PR #1355.
- `--dry-run` flag: print all gate results + "would merge with --match-head-sha=X" without executing. Does not remove labels.
- Authorship check: `gh pr view --json author --jq .author.login` matches `gh api user --jq .login`. Refuses if mismatch with "merge-pr only operates on your own PRs." No `--force` bypass — this is a separate safety from gate bypass.
- Single combined `gh pr view --json author,title,url,labels,mergeable,headRefOid,mergeStateStatus` call up front — replaces the 4-5 separate calls in current claude-merge.sh.

**`scripts/workflow/_pr-gates.sh`** (existing from PR #1355, refactored per audit):

- Defines `COPILOT_LOGINS=("copilot-pull-request-reviewer" "copilot-pull-request-reviewer[bot]")` at the top. Other scripts that need this allowlist source this file or duplicate the array (preferred: source).
- Four gate functions: `check_ci`, `check_copilot_currency`, `check_unresolved_threads`, `check_no_merge_conflict`. Each prints structured status to stdout and returns 0 (pass) or non-zero (fail). Caller decides what to do with the failure.
- `check_no_merge_conflict`: removes the internal sleep-retry loop. Emits `UNKNOWN: GitHub still computing merge status` once and returns 1 if state is UNKNOWN. Caller (merge-pr.sh) loops if retry is desired.
- `check_ci`: treats CANCELLED check_runs as FAIL (not as missing). Fixes Copilot comment on PR #1355.
- `check_copilot_currency`: uses `gh api --paginate /pulls/$PR/reviews | jq -s 'flatten[] | select(...) | ...'` (the `-s` slurp flag fixes the pagination bug — `--paginate` emits one JSON doc per page). Date arithmetic preserves the macOS/Linux + TZ=UTC + Z-stripping pattern from PR #1352.
- `check_unresolved_threads`: GraphQL with cursor pagination over `reviewThreads(first: 100, after: $cursor)`. Fixes the silent-truncation bug.
- `--force` only suppresses `check_unresolved_threads` and `check_copilot_currency` failure exit codes. The functions still run and print status; only the exit-code interpretation changes (caller-side).

**`scripts/workflow/pr-watch.py`** (auditor + streaming watcher, fixes per audit):

- Remove 3 advisory-text emissions: line 147 (`(resolve via git fetch ...)`), line 183 (`Use --force to watch anyway`), line 293 (`Run: ./scripts/workflow/copilot-comments.sh {pr}`). Replace with structured status (e.g., `mergeStateStatus=BEHIND`, `audit_failed=true`).
- Combine the two redundant `gh run list --limit 50 --branch X` calls (lines 374 + 411) into one; cache the result.
- Replace `write_failure_artifact()`'s `gh run view --log-failed` + `gh run view` subprocess pair with `get_job_logs(failed_only=true, return_content=true, tail_lines=100)` via subprocess shelling to `gh api` — pr-watch.py can't call MCP from Python, but it can call the same endpoint via gh CLI. Defer this to a follow-up if intrusive; primary fix is removing advisory text.
- Continue to use the streaming `gh run watch` subprocess for CI events — no MCP equivalent.
- Use COPILOT_LOGINS from a shared source if Python can import bash constants cleanly (it can't easily); otherwise keep the inline tuple as a documented duplication exception, since pr-watch.py is the only Python file. Note in a comment that the canonical source is `_pr-gates.sh`.

**`scripts/workflow/pr-dashboard.sh`** (minimal cleanup):

- Use dynamic repo slug detection (`gh repo view --json nameWithOwner`) instead of hardcoded `timothyfroehlich/PinPoint`. Match orchestration-status.sh's pattern.
- Source `_pr-gates.sh` to get COPILOT_LOGINS; replace inline allowlist.
- Add `--limit 100` to `gh pr list` (currently defaults to 30) to handle PinPoint's open PR count comfortably.

**`scripts/workflow/orchestration-status.sh`** (no functional change):

- Already dynamic; minor update if it references any deleted script.

#### KEEP AS-IS (out of scope)

- `scripts/workflow/stale-worktrees.sh` — Tim manages worktree cleanup manually. Path-filter bug acknowledged but not fixed this round.
- `scripts/workflow/prune-supabase-branches.sh` — orthogonal to PR workflow.
- `scripts/workflow/e2e-all-isolated.sh` — orthogonal.

### 4. New hook: `.claude/hooks/block-direct-merge.cjs`

Prevents direct merge calls, forcing agent through `merge-pr.sh`.

```javascript
// PreToolUse hook for Bash + MCP merge tools
// Blocks direct merges to enforce merge-pr.sh gate re-checks
```

**Behavior**:

- Matches Bash tool calls containing `gh pr merge` (any form: full command, `gh api -X PUT .../pulls/.../merge`).
- Matches MCP tool calls to `mcp__plugin_github_github__merge_pull_request`.
- Returns blocking error: `Direct merge blocked. Use scripts/workflow/merge-pr.sh <PR> to enforce gate re-checks. Override with: touch .claude-merge-bypass (single-use sentinel, deleted on hook fire).`
- Bypass: presence of `.claude-merge-bypass` file in repo root. Hook deletes it after firing (single-use). Consistent with the `.claude-hook-bypass` pattern used by `definition-of-done.sh` and `push-check.sh`.

Wire in `.claude/settings.json` PreToolUse section (additive — doesn't replace existing hooks).

### 5. New skill: `.claude/skills/pinpoint-pr-workflow/SKILL.md`

Replaces three deleted skills with one consolidated 4-phase workflow. Target ~250-350 LOC.

**Structure**:

```
# PinPoint PR Workflow

## When to use
- You have uncommitted changes → start at Phase 1
- You have local commits but no PR → start at Phase 2
- A PR exists, CI not yet green-and-clean → start at Phase 3
- ready-for-review label applied → start at Phase 4

## Phase 1: Commit
- Branch validation (commandment 18: merge not rebase; commandment 1: escape parens)
- File review (check git status, stage what belongs in this commit)
- Pre-commit: pnpm run check (~12s) for typical changes; pnpm run preflight for migrations/security
- E2E selection (decision matrix — high/medium/low impact based on changed file paths)
- Commit message: conventional commits format with PinPoint scopes
- Push (set upstream if needed)

## Phase 2: PR
- Use MCP create_pull_request OR gh pr create
- Description template: Summary, Changes, Testing, Related Issues, Test Plan
- Draft vs ready-for-review (draft if WIP)

## Phase 3: Review (CI + Copilot + label)
- Watch CI via Monitor + pr-watch.py
- When Copilot posts a review:
  - Use pull_request_read(method: "get_review_comments") to fetch unresolved threads
  - For each: evaluate critically. NOT all suggestions warrant code changes.
  - To fix: edit code, push, Copilot auto-resolves on next review
  - To decline: pull_request_review_write(method: "resolve_thread", threadId: PRRT_xxx) + add_reply_to_pull_request_comment with one-sentence justification signed "—Claude-<Name>"
- When CI green AND zero unresolved threads:
  - Run the same gate checks merge-pr.sh would run (CI green, currency, threads, no conflict) via direct MCP calls
  - If all pass: apply ready-for-review label via issue_write(method: "update", labels: [...current..., "ready-for-review"])
  - Label is a hint to Tim, not an enforced gate — merge-pr.sh re-checks

## Phase 4: Merge
- Invoked from terminal by Tim, or by agent if Tim delegates
- Run scripts/workflow/merge-pr.sh <PR>
- merge-pr.sh re-evaluates all 4 gates and merges if all pass
- On failure: reads structured output, identifies which gate failed, addresses (fix code + new commit OR decline Copilot thread OR resolve merge conflict OR use --force if appropriate)
- Direct merges (gh pr merge, MCP merge_pull_request) are blocked by hook — must go through merge-pr.sh

## MCP usage notes
- Field naming: MCP responses use snake_case (is_resolved, submitted_at, html_url, head.sha). GraphQL we previously used was camelCase. Don't confuse.
- Pagination: default perPage is 30 in some methods; cap to 100 explicitly for lists. Use the per-method docs.
- Authentication: PAT via GITHUB_PERSONAL_ACCESS_TOKEN env var (set globally in shell rc).

## Status token vocabulary (for script output parsing)
- FAIL: <gate>: state - hard failure, blocks
- WAIT: <gate>: state - transient (e.g., GitHub computing mergeable); retry
- BLOCK: <gate>: state - state mismatch (e.g., merge conflict); requires user action
- WARN: <gate>: state - permitted to proceed but with notice (e.g., Copilot review stale > 600s threshold)
- SKIP: <gate>: reason - gate doesn't apply (e.g., no Copilot reviews on PR)

## --force escape hatches
- merge-pr.sh --force: bypass thread + currency gates only (CI green + no merge conflict still enforced)
- pr-watch.py --force: skip readiness audit, watch unconditionally
- When to use --force: API failure on a gate where the underlying state is verified-fine manually; Copilot has clearly silently-skipped a merge-from-main commit; gate threshold needs adjustment but you want to ship anyway
- When NOT to use --force: any time you haven't verified the underlying state manually
```

The skill points to scripts as the canonical mechanical implementations and to MCP tools as the per-operation read/write surface. No code blocks or pseudocode showing git commands the agent already knows.

### 6. Skill deletions + cross-skill edits

**DELETE**:

- `.claude/skills/pinpoint-commit/` (entire directory, 678 LOC)
- `.claude/skills/pinpoint-ready-to-review/` (entire directory, 50 LOC)
- `.claude/skills/pinpoint-github-monitor/` (entire directory)

**EDIT**:

- `.claude/skills/pinpoint-orchestrator/SKILL.md` — remove stale `.agent/skills/pinpoint-commit/scripts/watch-ci.sh` reference. State the N=1 dispatch rule affirmatively (PR #1353 shipped this; ensure orchestrator doc is current). Remove the historical PR reference ("relaxed from PR 1353").
- `.claude/skills/pinpoint-dispatch-e2e-teammate/SKILL.md` — update any references to the deleted skills.
- `AGENTS.md` (root) section 3 skills table — replace 3 entries (pinpoint-commit, pinpoint-ready-to-review, pinpoint-github-monitor) with 1 entry (`pinpoint-pr-workflow` — "Full PR lifecycle: commit, push, CI monitoring, Copilot review (via MCP), readiness labeling, gate-enforced merge.").
- `scripts/workflow/AGENTS.md` — remove copilot-comments.sh/respond-to-copilot.sh/resolve-copilot-threads.sh/label-ready.sh entries. Add merge-pr.sh and \_pr-gates.sh entries. Add status-token vocabulary section. Add MCP-vs-script decision table. Update "Key Design Decisions" to reflect mechanical-only-output principle.

### 7. MCP usage documentation (in skill + scripts/workflow/AGENTS.md)

For each MCP tool the skill instructs the agent to call, document exact invocation patterns and gotchas.

| Tool                                                  | Use                             | Pattern                                                                    | Gotchas                                                                                    |
| ----------------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `pull_request_read(method: "get")`                    | PR metadata read                | owner, repo, pullNumber                                                    | snake_case fields                                                                          |
| `pull_request_read(method: "get_review_comments")`    | Copilot thread list             | + perPage (cap 100)                                                        | cursor-based pagination via `after` param                                                  |
| `pull_request_read(method: "get_reviews")`            | Currency check (timestamps)     | + perPage                                                                  | snake_case `submitted_at`, `commit_id`                                                     |
| `pull_request_read(method: "get_check_runs")`         | CI status read                  | owner, repo, pullNumber                                                    | already in default toolset                                                                 |
| `get_commit`                                          | Currency check (committer date) | owner, repo, sha                                                           | `include_diff=false` to save tokens                                                        |
| `add_reply_to_pull_request_comment`                   | Reply to Copilot thread         | owner, repo, pullNumber, commentId, body                                   | commentId comes from get_review_comments thread output                                     |
| `pull_request_review_write(method: "resolve_thread")` | Close a Copilot thread          | threadId only (owner/repo/pullNumber ignored)                              | threadId format: `PRRT_kwDOxxx`                                                            |
| `issue_write(method: "update")`                       | Apply/remove PR label           | owner, repo, issue_number, labels (full replacement array)                 | PRs share issue endpoints. Read current labels first to avoid clobbering.                  |
| `update_pull_request_branch`                          | Update behind-main PR           | owner, repo, pullNumber, expectedHeadSha (optional)                        | Triggers merge commit; Copilot may silently skip review of this commit (per PR #1342 case) |
| `request_copilot_review`                              | Re-request Copilot after a push | owner, repo, pullNumber                                                    | Useful if Copilot didn't auto-review                                                       |
| `merge_pull_request`                                  | MERGING — BLOCKED BY HOOK       | n/a                                                                        | Use merge-pr.sh instead                                                                    |
| `actions_list(method: "list_workflow_runs")`          | Cross-branch CI run query       | owner, repo, branch, status                                                | for orchestration-status diagnostics                                                       |
| `get_job_logs`                                        | Fetch failed job logs           | owner, repo, job_id, failed_only=true, return_content=true, tail_lines=100 | Cleaner than `gh run view --log-failed` + manual tail                                      |

### 8. Migration plan / PR strategy

PR #1355's branch cannot be force-amended (force-push to a branch with an open PR requires explicit per-instance approval per commandment 18 area). Instead:

- Close PR #1355 with a comment linking to this spec and explaining the supersession.
- Delete the branch locally and remotely: `git branch -D feat/claude-merge-shared-gates-PP-d4bf && git push origin --delete feat/claude-merge-shared-gates-PP-d4bf`.
- Create new branch `feat/pinpoint-pr-workflow-consolidation-PP-d4bf` from current main.
- Implement the consolidation on the new branch.
- Open new PR titled `feat(workflow): consolidate PR workflow into single skill + MCP-first scripts (PP-d4bf)`.

Estimated PR size (rough):

- Scripts: -800 LOC deleted, -200 LOC refactored, +50 LOC additions. Net ~-950 LOC.
- Skill: -680 LOC deleted (pinpoint-commit), -50 LOC (pinpoint-ready-to-review), -80 LOC (pinpoint-github-monitor); +350 LOC added (pinpoint-pr-workflow). Net ~-460 LOC.
- Hook: +60 LOC (block-direct-merge.cjs).
- Settings: +6 LOC (.claude/settings.json hook entry).
- AGENTS.md edits: ~30 LOC modified.
- Total estimated diff: ~-1300/+450 LOC.

**Commit order within the PR**:

1. Extract `_pr-gates.sh` cleanly (gate functions, COPILOT_LOGINS constant).
2. Rename claude-merge.sh → merge-pr.sh + apply all PR #1355 fixes + TOCTOU --match-head-sha + label removal cleanup.
3. Refactor remaining kept scripts (pr-watch.py advisory-text strip + duplicate call fix; pr-dashboard.sh dynamic-slug + cap-100; orchestration-status.sh minor refs).
4. Delete copilot-comments.sh, respond-to-copilot.sh, resolve-copilot-threads.sh, label-ready.sh.
5. Add `.claude/hooks/block-direct-merge.cjs` and wire in settings.json.
6. Write `.claude/skills/pinpoint-pr-workflow/SKILL.md`.
7. Delete the three old skill directories.
8. Update `AGENTS.md` skills table, `scripts/workflow/AGENTS.md`, `.claude/skills/pinpoint-orchestrator/SKILL.md`, `.claude/skills/pinpoint-dispatch-e2e-teammate/SKILL.md`.
9. Smoke test all kept scripts with --dry-run.
10. Push, open PR.

### 9. Verification matrix

Before requesting Copilot review on the new PR:

**Scripts**:

- `merge-pr.sh --dry-run <a-real-PR>` — gates all run, structured output emitted, no advisory text, --match-head-sha included in dry-run preview.
- `_pr-gates.sh` smoke-tested via merge-pr.sh and manual invocation of each gate function.
- `pr-watch.py --audit <PR>` — no advisory text in output, structured status only.
- `pr-dashboard.sh` — open PR table rendered with dynamic slug, > 30 PRs visible.
- `orchestration-status.sh` — no broken references to deleted scripts.

**MCP tools** (smoke test via skill instructions):

- `pull_request_read` (all 4 methods we'll use): tested on PR #1357 in this session, all returned clean data.
- `get_commit`: smoke test on a recent commit; verify committer date arrives.
- `issue_write(method: "update", labels: ...)`: smoke test on a throwaway label apply + remove on a closed PR. CRITICAL: verifies the labels toolset works post-restart.
- `add_reply_to_pull_request_comment`: smoke test on a draft PR or test repo.
- `pull_request_review_write(method: "resolve_thread")`: smoke test on a draft PR.
- `get_job_logs`: smoke test against a recent failed CI run (PR #1357 has one).

**Hook**:

- `bash -c 'gh pr merge 1234'` (with a real PR number) — should be blocked with the redirect message.
- MCP tool call to `merge_pull_request` — should be blocked.
- After `touch .claude-merge-bypass`, the next direct merge call should succeed AND the sentinel file should be deleted.

**Skill**:

- LOC count < 400 (target 250-350).
- All 4 phases have explicit "Start here if" entry points.
- No git pseudocode the agent already knows.
- No `git rebase origin/main` mentioned anywhere (commandment 18).
- Status token vocabulary documented.
- MCP snake_case gotcha documented.

**Subagent MCP inheritance** (open question carry-over):

- Dispatch a tiny read-only subagent. Have it call `mcp__plugin_github_github__get_me`. If it works, subagent MCP inheritance confirmed; the skill's MCP instructions work for dispatched work too. If it fails, the skill needs a fallback note ("if MCP not available in this session, use gh CLI equivalents").

**Token cost regression**:

- `/context` before and after consolidation. Skill section should shrink. MCP catalog grows by ~10-15k (actions + labels). Net change should be negative or neutral.

### 10. Out of scope (intentional)

- `stale-worktrees.sh` path-filter fix. Tim manages worktree cleanup manually.
- `.claude/hooks/` duplication extraction (GIT_DIR/GIT_COMMON_DIR guard, `.claude-hook-bypass` check, INPUT=$(cat) boilerplate, `command -v jq` inconsistency). Filed as separate bead for later.
- `prune-supabase-branches.sh`, `e2e-all-isolated.sh` cleanup.
- Migrating bash scripts to Python.
- Per-tool retry/timeout tuning for MCP calls.
- Backwards-compatibility aliases (e.g., `claude-merge.sh` symlink pointing to merge-pr.sh — not creating).
- New gates beyond the four (CI, currency, threads, no merge conflict).
- Automating the agent's response to gate failures (skill documents decision criteria; agent decides per-failure).
- Hooks for the `actions` toolset commands (rerun/cancel) — not needed; those are agent's discretion.
- `pr-watch.py` migration to using `get_job_logs` via gh CLI subprocess — deferred to follow-up if the python subprocess shape is intrusive.

### 11. Open follow-ups (file beads, address separately)

- **PR #1357 (cvh-poll hook) has 2 unresolved Copilot comments** about basename collision risk and jq fail-open. Both substantive. CI Gate also failing (E2E Full Tests Chromium). Address before merging PR #1357. Separate from this consolidation.
- **`.claude/hooks/` shared helper extraction** — duplicated GIT_DIR/COMMON_DIR check, `.claude-hook-bypass` guard, INPUT=$(cat) boilerplate, jq-availability check (with INCONSISTENT exit codes: 2 vs 0). File a separate bead. Out of scope here per Tim's call.
- **`pr-watch.py` get_job_logs migration** — replace the `gh run view --log-failed` + manual tail pair with `gh api .../actions/jobs/{id}/logs` via subprocess to mirror the MCP `get_job_logs(failed_only, tail_lines)` shape. Defer if the python subprocess refactor balloons.
- **Stale memories update** — `reference_github_mcp.md` in user memory is 53 days old and claimed merge_pull_request wasn't available (it now is); also missed that the hosted MCP server supports toolset selection via URL/header. Update the memory after this consolidation lands so future sessions have accurate context.
- **PinPoint orchestrator skill** N=1 strict rule wording — currently has "relaxed from PR 1353" language per audit; replace with affirmative current-rule statement.

### 12. Risk + backout

**Risks**:

- MCP server outage or schema drift breaks the skill's documented MCP calls. Mitigation: skill includes gh CLI fallback notes for each MCP-dependent step; agent can drop back to scripts if MCP fails mid-flow.
- Subagent MCP inheritance doesn't work the way we expect. Mitigation: smoke test in verification matrix; if it fails, skill notes "MCP may not be available in dispatched subagent sessions; prefer gh CLI in those contexts."
- `issue_write` doesn't actually support PR labels (despite REST endpoint sharing). Mitigation: verification step #2 tests this explicitly before relying on it; fallback is `gh pr edit --add-label` from a small wrapper or directly from the skill instructions.
- Hook blocks too aggressively (e.g., legitimate `gh pr merge --help` in a doc command). Mitigation: hook matches the merge subcommand specifically, not the bare `gh pr` invocation; smoke-test for false positives.
- `_pr-gates.sh` extraction introduces subtle behavior changes. Mitigation: gate functions tested individually before merge-pr.sh consumes them; verification matrix.

**Backout**:

- Each commit is independently revertable. If the new skill breaks workflow, `git revert <skill commit>` restores the old three skills (preserved in git history). If the hook over-blocks, `git revert <hook commit>` removes it. The script deletions can be restored from git.
- If MCP setup breaks for the user, removing the `X-MCP-Toolsets` header from settings.json returns to the default toolset (which is still sufficient for the most-used reads).

## Acceptance criteria

- All scripts kept have purely mechanical output (no advisory English).
- `merge-pr.sh` enforces all four gates including TOCTOU mitigation via `--match-head-sha`.
- Hook prevents direct merge via Bash or MCP; bypass sentinel works once and is consumed.
- New `pinpoint-pr-workflow` skill is under 400 LOC, has 4 phase entry points, documents MCP usage with snake_case note and status-token vocabulary.
- Three old skills are deleted; `AGENTS.md` skills table updated.
- `scripts/workflow/AGENTS.md` documents the new script lineup including merge-pr.sh and \_pr-gates.sh.
- No `git rebase origin/main` references survive anywhere (skills, scripts, docs).
- Verification matrix executed; all checks pass.
- Pagination bug fixed (no `reviewThreads(first: 100)` without cursor loop in any kept code path).
- COPILOT_LOGINS defined once in `_pr-gates.sh`; sourced by other scripts that need it.
- PR #1355 is closed with a supersession link; new PR opened on a fresh branch.
