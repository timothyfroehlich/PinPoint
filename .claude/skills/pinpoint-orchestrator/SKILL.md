---
name: pinpoint-orchestrator
description: Orchestrate parallel subagent work in git worktrees. Supports background agents (default) and Claude Teams (interactive).
---

# Pinpoint Orchestrator

Coordinate multiple subagents working in parallel across isolated git worktrees.

## When to Use This Skill

- Multiple independent beads issues ready to work (`bd ready` shows 2+ items)
- Copilot review feedback on multiple PRs needs addressing
- Parallel feature development across branches
- User says "spin up agents", "orchestrate", "parallel work"
- User says "use teams", "interactive mode" → see Teams Mode at end

## Scripts Reference

All monitoring and readiness commands are handled by scripts. Use these instead of raw `gh` commands.

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
bash scripts/workflow/resolve-copilot-threads.sh <PR>              # Bulk-resolve addressed threads (compares timestamps)
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

# Worktree management (paths are now flat: feat/x → feat-x)
python3 ./pinpoint-wt.py create <branch>           # Create worktree (new or existing branch)
python3 ./pinpoint-wt.py list                      # Show all worktrees with port assignments
python3 ./pinpoint-wt.py remove <branch>           # Clean teardown (Supabase + Docker + worktree)
python3 ./pinpoint-wt.py sync [--all]              # Regenerate config files
```

---

## Definition of Done

A task is **NOT done** until ALL gates pass. Agents must complete every item before creating a PR.

### Quality Gates

1. **`pnpm run preflight` passes** — typecheck, lint, format, unit tests, AND build.
2. **Unit tests cover new logic** — server actions, utilities, permissions, validation.
3. **Integration tests cover data flows** — DB queries, server action side effects (PGlite).
4. **E2E tests cover new UI interactions** — per AGENTS.md rule #11: every clickable element gets clicked in an E2E test.
5. **E2E tests pass locally** — `pnpm exec playwright test <file> --project=chromium`.

### Coverage by Change Type

| Change Type | Unit | Integration | E2E |
|-------------|------|-------------|-----|
| New server action | Required | Required | Required (UI that calls it) |
| New UI component | — | — | Required (click every interactive element) |
| Permission changes | Required (matrix) | — | Required (visible/hidden/disabled states) |
| Bug fix | Required (regression) | If data-related | If UI-related |
| Config/middleware | — | Required | Required (route behavior) |

---

## Phase 1: Task Selection

### 1.1 Load Available Work

```bash
bd ready                    # Issues with no blockers
bd list --status=open       # All open issues
```

### 1.2 Present Options to User

```
Available tasks:
1. [PinPoint-abc] Fix machine dropdown default
2. [PinPoint-def] Add owner link to issue detail

Which tasks should I work on in parallel?
```

### 1.3 Validate Independence

Before proceeding, verify:
- No task blocks another (`bd show <id>` to check blockedBy)
- Tasks don't modify the same files
- Each task can be completed independently

---

## Phase 2: Worktree Setup

```bash
python3 ./pinpoint-wt.py create <branch-name>   # Works for new or existing branches
```

Track the mapping (note: paths are flat — `feat/task-abc` → `feat-task-abc`):

```
PinPoint-abc → /home/froeht/Code/pinpoint-worktrees/feat-task-abc
PinPoint-def → /home/froeht/Code/pinpoint-worktrees/feat-task-def
```

---

## Phase 3: Agent Dispatch

### Prompt Requirements

**CRITICAL**: Each agent prompt MUST include:

1. Full absolute worktree path
2. Explicit instruction to work ONLY in that path
3. Beads issue context (`bd show` output)
4. Reference to AGENTS.md for project rules
5. The Definition of Done checklist (from above)

Use the template in `references/agent-prompt-template.md`.

### Launch Pattern

Dispatch all agents in a SINGLE message with multiple Task tool calls:

```
Task(subagent_type: "general-purpose", run_in_background: true, prompt: <template>)
Task(subagent_type: "general-purpose", run_in_background: true, prompt: <template>)
```

Track agent IDs for monitoring:

```
Agent abc123 → PinPoint-abc → PR TBD
Agent def456 → PinPoint-def → PR TBD
```

---

## Phase 4: Monitor Loop

### 4.1 Dashboard Check

Run periodically to see all PR status at a glance:

```bash
bash scripts/workflow/pr-dashboard.sh 940 941 942       # Specific PRs
bash scripts/workflow/pr-dashboard.sh                    # All open PRs
```

### 4.2 On Agent Completion

Check the agent's output with `TaskOutput`. Then:

1. **Get PR number**: `gh pr list --head <branch> --json number,url`
2. **Check dashboard**: `bash scripts/workflow/pr-dashboard.sh <PR>`

### 4.3 Handle Failures

**CI fails** → Re-dispatch agent with failure context. Get failed logs:

```bash
gh run view <run-id> --log-failed | tail -50
```

**Copilot comments** → Get details and re-dispatch:

```bash
bash scripts/workflow/copilot-comments.sh <PR>
```

Include the full output in the new agent's prompt. **Agents MUST resolve each thread** as they address it using `bash scripts/workflow/respond-to-copilot.sh` (see AGENTS.md "GitHub Copilot Reviews").

**Infrastructure failures** (e.g., "Setup Supabase CLI: failure") → Not code issues. Re-run:

```bash
gh run rerun <run-id> --failed
```

### 4.4 Label Ready PRs

**PROACTIVE**: Label PRs as soon as CI goes green and Copilot comments are resolved. Do NOT wait for the user to ask — this is part of the orchestrator's job.

```bash
bash scripts/workflow/label-ready.sh <PR>               # Label (keeps worktree)
bash scripts/workflow/label-ready.sh <PR> --cleanup     # Label + remove worktree
```

The script checks: all CI passed (cancelled/skipped runs are ignored), 0 Copilot comments, not draft. Use `--cleanup` only when explicitly asked — worktrees may be needed for follow-up work.

### 4.5 Review Feedback Loop

**Approved** → User merges. Done.

**Changes requested** → User removes label, adds comment. Re-create worktree and re-dispatch:

```bash
python3 ./pinpoint-wt.py create <branch>
# Then dispatch agent with user's feedback in prompt
```

---

## Phase 5: Completion

### 5.1 Beads Issue Lifecycle

**Do NOT close beads issues when a PR is created.** Issues stay `in_progress` until PR **merges**.

| Event | Beads Action |
|-------|-------------|
| Agent creates PR | Issue stays `in_progress` |
| PR merges | `bd close <id> --reason="PR #N merged"` |
| PR closed without merge | `bd update <id> --status=open` |

### 5.2 Final Summary

```
## Orchestration Complete

PRs Ready for Review:
- #123: Fix machine dropdown — All checks passing
- #125: Sort owner dropdown — All checks passing

PRs Needing Attention:
- #124: Add owner link — 2 Copilot comments

Remaining Worktrees:
- feat/task-def (PR #124 needs work)
```

### 5.3 Cleanup

Ready PRs were cleaned up during labeling (Phase 4.4). Only worktrees for PRs still needing work remain. Clean up manually if needed:

```bash
python3 ./pinpoint-wt.py remove <branch>
```

---

## Proactive Beads Maintenance

The orchestrator keeps beads state accurate throughout the session.

### On Session Start

- `bd ready -n 50` (default limit is 10, which hides work)
- `bd list --status=in_progress` to check for stale in-progress issues
- Cross-reference: any in-progress issues whose PRs are already merged? Close them
- Check for closed issues still blocking others (`bd blocked` → `bd dep remove`)

### During Work

- PR **merges** → immediately close the beads issue
- Agent creates PR → issue stays `in_progress` (do NOT close yet)
- Discover new work → `bd create`
- Task absorbed into another → close with `--reason`
- Stale dependencies → `bd dep remove` to unblock

### On Session End

- `bd list --status=in_progress` — anything done? Close it
- `bd sync --from-main` to pull beads updates
- Verify all completed work has closed issues

### Common Stale Patterns

| Pattern | Fix |
|---------|-----|
| Closed issue still blocking others | `bd dep remove <blocked> <closed-blocker>` |
| PR merged but beads still open | `bd close <id> --reason="PR #N merged"` |
| Issue in_progress but abandoned | `bd update <id> --status=open` |
| Duplicate issues | Close with `--reason="Duplicate of <id>"` |

---

## Teams Mode (Interactive)

> **Experimental**: Requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`.

Use Teams when tasks have dependencies, need mid-flight steering, or require plan approval before implementation.

### Setup

```
TeamCreate(team_name: "pinpoint-<summary>")
TaskCreate(subject: "...", description: "Worktree: <path>\nBeads: <id>\n<details>")
TaskUpdate(taskId: "2", addBlockedBy: ["1"])     # If tasks have ordering
```

### Spawn & Assign

```
Task(subagent_type: "general-purpose", team_name: "pinpoint-<summary>", name: "dropdown-fix", prompt: <template>)
TaskUpdate(taskId: "1", owner: "dropdown-fix")
```

Use the template in `references/teams-agent-prompt-template.md`. Name teammates by their task.

### Coordination

- **Messages**: `SendMessage(type: "message", recipient: "<name>", content: "...")`
- **Plan approval**: `SendMessage(type: "plan_approval_response", request_id: "...", approve: true)`
- **Unblock tasks**: When blocking task completes, assign newly unblocked tasks to idle teammates
- **Never broadcast** for task-specific steering — it's N messages for N teammates

### Shutdown

```
SendMessage(type: "shutdown_request", recipient: "<name>", content: "All tasks done")
# Wait for shutdown_response(approve: true) from each
TeamDelete()   # Only after ALL teammates shut down
```

---

## Error Recovery

| Problem | Fix |
|---------|-----|
| Agent fails to create PR | Check output, verify worktree state, re-dispatch |
| Permission denied on worktree | Add paths to `.claude/settings.json`, restart session |
| Worktree creation fails | `python3 ./pinpoint-wt.py sync`, `supabase stop --all`, retry |
| Teammate unresponsive | Idle is normal — send follow-up message. If stuck, shutdown + replace |
| Team cleanup fails | Shutdown remaining teammates first, then `TeamDelete()` |
| Session dies with active team | `rm -rf ~/.claude/teams/<name> ~/.claude/tasks/<name>` |
