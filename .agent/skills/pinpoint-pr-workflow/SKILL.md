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

- Tool: `mcp__github__create_pull_request`
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
mcp__github__pull_request_read(
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
mcp__github__add_reply_to_pull_request_comment(
owner: "timothyfroehlich",
repo: "PinPoint",
pullNumber: <PR>,
commentId: <commentId from thread>,
body: "Ignored: <one-sentence justification>. —Claude-<YourName>"
)
```

2. Resolve:

```
mcp__github__pull_request_review_write(
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
mcp__github__issue_write(
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
bash scripts/workflow/merge-pr.sh <PR>
```

Add `--dry-run` to preview, `--force` to bypass threads + currency gates (CI and no-merge-conflict gates always run).

### 4.2 Interpret output

Script emits structured status tokens:

| Token                    | Meaning                                                | What to do                            |
| ------------------------ | ------------------------------------------------------ | ------------------------------------- |
| `PASS: <gate>: <state>`  | Gate passed                                            | Continue                              |
| `FAIL: <gate>: <state>`  | Gate failed                                            | Fix underlying issue, push, retry     |
| `WAIT: <gate>: <state>`  | Transient (e.g., GitHub computing mergeable)           | Retry merge-pr.sh after a few seconds |
| `BLOCK: <gate>: <state>` | State mismatch requiring action (e.g., merge conflict) | Resolve, push, retry                  |
| `WARN: <gate>: <state>`  | Permitted to proceed with notice                       | Continue, but be informed             |
| `SKIP: <gate>: <reason>` | Gate doesn't apply                                     | Continue                              |

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
```

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
