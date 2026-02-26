---
name: pinpoint-orchestrator
description: Orchestrate parallel subagent work in git worktrees using resumed standalone subagents (primary) or Agent Teams (fallback).
---

# Pinpoint Orchestrator

Coordinate multiple subagents working in parallel across isolated git worktrees.

## When to Use This Skill

- Multiple independent beads issues ready to work (`bd ready` shows 2+ items)
- Copilot review feedback on multiple PRs needs addressing
- Parallel feature development across branches
- User says "spin up agents", "orchestrate", "parallel work", "use teams"

## Scripts Reference

```bash
# Orchestration startup (ONE call for full situational awareness)
bash scripts/workflow/orchestration-status.sh               # PR dashboard + worktree health + beads + security alerts
bash scripts/workflow/orchestration-status.sh --prs-only    # Just PR dashboard
bash scripts/workflow/orchestration-status.sh --security-only  # Just Dependabot alerts

# PR monitoring
bash scripts/workflow/pr-dashboard.sh [PR numbers...]       # CI + Copilot + merge status table (all open PRs if no args)
bash scripts/workflow/copilot-comments.sh <PR> [PR...]      # Copilot details (accepts multiple PRs)
bash scripts/workflow/copilot-comments.sh <PR> --raw        # JSON output for parsing

# Copilot thread management (see AGENTS.md "GitHub Copilot Reviews" for full protocol)
bash scripts/workflow/respond-to-copilot.sh <PR> <path:line> <msg> # Reply + resolve one thread
bash scripts/workflow/resolve-copilot-threads.sh <PR>              # Bulk-resolve addressed threads
bash scripts/workflow/resolve-copilot-threads.sh <PR> --dry-run    # Preview without resolving
bash scripts/workflow/resolve-copilot-threads.sh <PR> --all        # Resolve ALL unresolved threads

# Readiness + cleanup
bash scripts/workflow/label-ready.sh <PR>                   # Label ready-for-review (checks CI + Copilot + draft)
bash scripts/workflow/label-ready.sh <PR> --cleanup         # Also remove associated worktree
bash scripts/workflow/label-ready.sh <PR> --force           # Label even with Copilot comments
bash scripts/workflow/label-ready.sh <PR> --dry-run         # Preview without acting

# CI watching
bash scripts/workflow/monitor-gh-actions.sh                 # Watch all active CI runs in parallel, report failures
bash .agent/skills/pinpoint-commit/scripts/watch-ci.sh <PR> [timeout]  # Poll single PR CI (default 10min)

# Worktree health
bash scripts/workflow/stale-worktrees.sh                    # Report stale/active/dirty worktrees
bash scripts/workflow/stale-worktrees.sh --clean            # Auto-remove stale worktrees

# Worktree management (paths are flat: feat/x → feat-x)
python3 ./pinpoint-wt.py create <branch>           # Create worktree (new or existing branch)
python3 ./pinpoint-wt.py list                      # Show all worktrees with port assignments
python3 ./pinpoint-wt.py remove <branch>           # Clean teardown (Supabase + Docker + worktree)
python3 ./pinpoint-wt.py sync [--all]              # Regenerate config files
```

---

## Quality Gates

### Standalone Subagents (Primary) — Self-Enforced

Hooks don't fire for standalone subagents. Include in every prompt:
- `pnpm run check` before returning
- Self-check `.claude-task-contract` items
- Structured return format with CI/Copilot status

### Agent Teams (Fallback) — Hook-Enforced

- **`TaskCompleted` hook** → runs `pnpm run check`
- **`TeammateIdle` hook** → blocks idle if unpushed commits
- Requires `isolation: "worktree"` for correct CWD (broken with `team_name` — see Phase 2)

### Coverage Expectations by Change Type

| Change Type | Unit | Integration | E2E |
|-------------|------|-------------|-----|
| New server action | Required | Required | Required (UI that calls it) |
| New UI component | — | — | Required (click every interactive element) |
| Permission changes | Required (matrix) | — | Required (visible/hidden/disabled states) |
| Bug fix | Required (regression) | If data-related | If UI-related |
| Config/middleware | — | Required | Required (route behavior) |

---

## Phase 1: Task Selection

```bash
bd ready                    # Issues with no blockers
bd list --status=open       # All open issues
```

Present options to user. Before proceeding, verify tasks are independent:
- No task blocks another (`bd show <id>`)
- Tasks don't modify the same files

---

## Phase 2: Worktree Setup

`isolation: "worktree"` handles creation automatically via the `WorktreeCreate` hook (delegates to `pinpoint-wt.py`).

> **Known bug**: `isolation: "worktree"` is silently ignored when `team_name` is set. For Agent Teams, create worktrees manually with `pinpoint-wt.py`.

Manual `pinpoint-wt.py` is for the lead's own use or Agent Teams worktree setup:

```bash
python3 ./pinpoint-wt.py create <branch-name>
```

---

## Phase 3: Agent Dispatch

### Option A: Standalone Subagents (Primary)

```
Task(
  subagent_type: "general-purpose",
  model: "sonnet",
  isolation: "worktree",
  run_in_background: true,
  mode: "bypassPermissions",
  prompt: "<full prompt — see agent-prompt-template.md>"
)
```

Do NOT set `team_name` or `name` — these activate Agent Teams where `isolation: "worktree"` is broken.

**Prompt requirements** — each subagent prompt MUST include:
1. Load `pinpoint-teammate-guide` skill
2. Beads issue context (`bd show` output)
3. Specific files to modify and what to change
4. Quality self-enforcement: "Run `pnpm run check` before returning. Verify all contract items."
5. Full PR lifecycle: "Create PR, poll for Copilot review, address comments, verify CI green."
6. Structured return format: branch, PR#, CI status, Copilot status, blockers

### Option B: Agent Teams (Fallback)

Use when you need bidirectional real-time communication (dependent tasks, mid-flight questions).

Create worktrees manually (isolation is broken with `team_name`), then spawn:

```bash
python3 ./pinpoint-wt.py create feat/<branch-name>
```

```
Task(
  subagent_type: "general-purpose",
  model: "sonnet",
  team_name: "pinpoint-<summary>",
  name: "dropdown-fix",
  mode: "bypassPermissions",
  prompt: "<prompt with ABSOLUTE worktree path>"
)
```

---

## Phase 4: Monitor Loop

### Dashboard

```bash
bash scripts/workflow/pr-dashboard.sh 940 941 942       # Specific PRs
bash scripts/workflow/pr-dashboard.sh                    # All open PRs
```

### Resume for Follow-Up

Common resume scenarios:
- Subagent returns "Copilot pending" → lead waits for review → resumes with comments
- CI fails → lead gets failure logs → resumes with failure context
- User requests changes → resumes with review feedback

### Handle Failures

**CI fails** → Get context, then resume subagent:
```bash
gh run view <run-id> --log-failed | tail -50
```

**Copilot comments** → Get details, then resume subagent:
```bash
bash scripts/workflow/copilot-comments.sh <PR>
```

**Infrastructure failures**:
```bash
gh run rerun <run-id> --failed
```

### Label Ready PRs

```bash
bash scripts/workflow/label-ready.sh <PR>               # Label (keeps worktree)
bash scripts/workflow/label-ready.sh <PR> --cleanup     # Label + remove worktree
```

---

## Phase 5: Completion

### Beads Issue Lifecycle

**Do NOT close beads issues when a PR is created.** Issues stay `in_progress` until PR **merges**.

| Event | Beads Action |
|-------|-------------|
| Agent creates PR | Issue stays `in_progress` |
| PR merges | `bd close <id> --reason="PR #N merged"` |
| PR closed without merge | `bd update <id> --status=open` |

### Final Summary

```
## Orchestration Complete

PRs Ready for Review:
- #123: Fix machine dropdown — All checks passing

PRs Needing Attention:
- #124: Add owner link — 2 Copilot comments

Remaining Worktrees:
- feat/task-def (PR #124 needs work)
```

### Cleanup

```bash
python3 ./pinpoint-wt.py remove <branch>
```

---

## Proactive Beads Maintenance

### On Session Start

- `bd ready -n 50` (default limit is 10, which hides work)
- `bd list --status=in_progress` to check for stale in-progress issues
- Cross-reference: any in-progress issues whose PRs are already merged? Close them
- Check for closed issues still blocking others (`bd blocked` → `bd dep remove`)

### During Work

- PR **merges** → immediately close the beads issue
- Agent creates PR → issue stays `in_progress`
- Discover new work → `bd create`
- Stale dependencies → `bd dep remove` to unblock

### On Session End

- `bd list --status=in_progress` — anything done? Close it
- `bd sync --from-main` to pull beads updates

---

## Task Contract (End-to-End Dispatch)

For full lifecycle tasks, use the **`pinpoint-dispatch-e2e-teammate`** skill. It covers worktree creation, task contract, and prompt template.

Subagents should load **`pinpoint-teammate-guide`** at the start.

---

## Lead Orchestrator Role

You are a **coordinator, not an implementer**:
- **DO** launch subagents, review their output, resume them with corrections
- **DO** check CI dashboards, manage beads
- **DON'T** directly fix code in worktrees — resume the subagent instead

If a subagent can't be resumed (GC'd), spawn a new one on the same branch.

## Anti-Patterns

- **DON'T use Agent Teams as default** — `isolation: "worktree"` is broken with `team_name`
- **DON'T assume hooks enforce quality for standalone subagents** — include `pnpm run check` in prompt
- **DON'T forget to check Copilot comments before merging**
- **DON'T fix code yourself as the orchestrator** — resume the subagent

## Error Recovery

| Problem | Fix |
|---------|-----|
| Subagent fails to create PR | Check output, verify worktree state, resume with context |
| Permission denied on worktree | Add paths to `.claude/settings.json`, restart session |
| Worktree creation fails | `python3 ./pinpoint-wt.py sync`, `supabase stop --all`, retry |
| Agent Teams isolation broken | Known bug. Use standalone subagents (Option A) instead |
| Hooks fire from wrong directory | Hooks skip for non-worktree CWD. Safeword: `touch .claude-hook-bypass` |
| Session dies with active team | `rm -rf ~/.claude/teams/<name> ~/.claude/tasks/<name>` |
| Husky post-checkout hook fails | Check `.husky/post-checkout` for merge conflict markers |
