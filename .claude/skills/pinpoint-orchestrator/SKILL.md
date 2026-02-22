---
name: pinpoint-orchestrator
description: Orchestrate parallel subagent work in git worktrees using built-in Agent Teams (primary) or background agents (fallback).
---

# Pinpoint Orchestrator

Coordinate multiple subagents working in parallel across isolated git worktrees.

## When to Use This Skill

- Multiple independent beads issues ready to work (`bd ready` shows 2+ items)
- Copilot review feedback on multiple PRs needs addressing
- Parallel feature development across branches
- User says "spin up agents", "orchestrate", "parallel work", "use teams"

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

# Worktree management (paths are now flat: feat/x → feat-x)
python3 ./pinpoint-wt.py create <branch>           # Create worktree (new or existing branch)
python3 ./pinpoint-wt.py list                      # Show all worktrees with port assignments
python3 ./pinpoint-wt.py remove <branch>           # Clean teardown (Supabase + Docker + worktree)
python3 ./pinpoint-wt.py sync [--all]              # Regenerate config files
```

---

## Quality Gates (Automatic via Hooks)

Quality enforcement is handled by Claude Code hooks — agents do NOT need to manually check these.

- **`TaskCompleted` hook** → runs `pnpm run check` before allowing task completion. If it fails, the agent gets stderr feedback and must fix before re-completing.
- **`TeammateIdle` hook** → checks for unpushed commits/uncommitted changes before allowing idle. Agent is forced to push first.

This replaces the old "Definition of Done" manual checklist.

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

**Always use `pinpoint-wt.py`** for worktree creation — it handles port allocation, Supabase isolation, and config generation that built-in `isolation: "worktree"` does not.

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

Two modes: **Agent Teams** (primary, interactive) and **Background Agents** (fallback, fire-and-forget).

### Option A: Agent Teams (Primary)

Use built-in Agent Teams for coordination when tasks have dependencies, need mid-flight steering, or benefit from shared task lists.

**Setup:**

```
TeamCreate(team_name: "pinpoint-<summary>")
```

**Create tasks** using built-in TaskCreate, then **spawn teammates**:

```
Task(
  subagent_type: "general-purpose",
  model: "sonnet",    // Use Sonnet for teammates — faster, cheaper. Opus is for the lead only.
  team_name: "pinpoint-<summary>",
  name: "dropdown-fix",
  prompt: "<prompt with worktree path and task details>"
)
```

Assign tasks with `TaskUpdate(taskId: "1", owner: "dropdown-fix")`.

**Prompt requirements** — each teammate prompt MUST include:
1. Full absolute worktree path (from Phase 2)
2. Explicit instruction to work ONLY in that path
3. Beads issue context (`bd show` output)
4. Reference to `{worktree_path}/AGENTS.md` for project rules
5. **Full PR lifecycle instructions**: "After pushing, monitor CI with `gh pr checks <PR>`, address Copilot comments with `bash scripts/workflow/copilot-comments.sh <PR>` and `bash scripts/workflow/respond-to-copilot.sh`, push fixes, and report back. Stay alive until CI is green and all Copilot threads are resolved."
6. **Hooks debugging request** (if PinPoint-ro06 is still open): "Watch for hook errors about wrong directories and report any you see."

**Coordination:**
- Direct messages: `SendMessage(type: "message", recipient: "<name>", ...)`
- Never broadcast for task-specific steering
- Idle is normal — teammates wake when messaged
- Unblock dependent tasks by assigning to idle teammates

**Teammate Lifecycle — DO NOT shut down after initial push:**

Teammates own the PR through its FULL lifecycle:
1. Implement + push + create PR
2. **Stay alive** — monitor CI with `gh pr checks <PR>` or `bash scripts/workflow/monitor-gh-actions.sh`
3. Address Copilot review comments (using `bash scripts/workflow/copilot-comments.sh` + `respond-to-copilot.sh`)
4. Push fixes, wait for CI again
5. Only shut down when: PR is approved/merged, OR lead explicitly requests shutdown

**Why:** Shutting down after push loses context. Re-spinning an agent to fix Copilot comments costs more than keeping one alive. The lead orchestrator should NOT fix code directly — send messages to teammates instead.

**Shutdown (only when PR lifecycle is complete):**
```
SendMessage(type: "shutdown_request", recipient: "<name>", content: "PR merged/approved, wrapping up")
# Wait for each shutdown_response(approve: true)
TeamDelete()   # Only after ALL teammates shut down
```

### Option B: Background Agents (Fallback)

Use when Agent Teams is unreliable, or for simple fire-and-forget tasks.

Dispatch all agents in a SINGLE message with multiple Task tool calls:

```
Task(subagent_type: "general-purpose", run_in_background: true, prompt: <prompt>)
Task(subagent_type: "general-purpose", run_in_background: true, prompt: <prompt>)
```

Track agent IDs for monitoring with `TaskOutput`.

---

## Phase 4: Monitor Loop

### 4.1 Dashboard Check

Run periodically to see all PR status at a glance:

```bash
bash scripts/workflow/pr-dashboard.sh 940 941 942       # Specific PRs
bash scripts/workflow/pr-dashboard.sh                    # All open PRs
```

### 4.2 On Agent/Teammate Completion

1. **Get PR number**: `gh pr list --head <branch> --json number,url`
2. **Check dashboard**: `bash scripts/workflow/pr-dashboard.sh <PR>`

### 4.3 Handle Failures

**CI fails** → Re-dispatch agent with failure context:
```bash
gh run view <run-id> --log-failed | tail -50
```

**Copilot comments** → Get details and re-dispatch:
```bash
bash scripts/workflow/copilot-comments.sh <PR>
```

Agents MUST resolve each Copilot thread using `bash scripts/workflow/respond-to-copilot.sh` (see AGENTS.md).

**Infrastructure failures** (e.g., "Setup Supabase CLI: failure"):
```bash
gh run rerun <run-id> --failed
```

### 4.4 Label Ready PRs

**PROACTIVE**: Label PRs as soon as CI goes green and Copilot comments are resolved.

```bash
bash scripts/workflow/label-ready.sh <PR>               # Label (keeps worktree)
bash scripts/workflow/label-ready.sh <PR> --cleanup     # Label + remove worktree
```

### 4.5 Review Feedback Loop

**Approved** → User merges. Done.
**Changes requested** → Re-create worktree and re-dispatch with feedback.

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

PRs Needing Attention:
- #124: Add owner link — 2 Copilot comments

Remaining Worktrees:
- feat/task-def (PR #124 needs work)
```

### 5.3 Cleanup

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

For full lifecycle tasks where a teammate handles everything (implement → PR → Copilot → CI), use the **`pinpoint-dispatch-e2e-teammate`** skill. It handles:
- Worktree creation with port allocation
- Writing `.claude-task-contract` (the checklist the TaskCompleted hook enforces)
- Teammate prompt with correct context

Teammates should load **`pinpoint-teammate-guide`** at the start — it covers the Copilot review loop, CI verification, Supabase startup, and contract protocol.

---

## Lead Orchestrator Role

The lead agent (you) is a **coordinator, not an implementer**:
- **DO** launch teammates, review their output, send them corrections via messages
- **DO** create PRs, check CI dashboards, manage beads
- **DON'T** directly fix code in worktrees — send a message to the teammate instead
- **DON'T** shut down teammates after their initial push — they own the full PR lifecycle
- **DON'T** use background subagents when you need iteration (Copilot comments, CI fixes) — use Agent Teams

If a teammate's work needs fixes, message them. If they're shut down and fixes are needed, spawn a new teammate in the same worktree.

## Anti-Patterns

- **DON'T use built-in `isolation: "worktree"`** for PinPoint — it doesn't set up ports or Supabase config. Always use `pinpoint-wt.py`.
- **DON'T spawn agents without absolute worktree paths** — agents inherit the parent's cwd and will NOT cd on their own.
- **DON'T forget to check Copilot comments before merging.**
- **DON'T assume Agent Teams is stable** — it's experimental. Fall back to background agents if coordination breaks down.
- **DON'T shut down teammates after initial push** — they need to stay alive for CI monitoring and Copilot comment resolution.
- **DON'T fix code yourself as the orchestrator** — message the teammate. You lose context switching between orchestration and implementation.

## Error Recovery

| Problem | Fix |
|---------|-----|
| Agent fails to create PR | Check output, verify worktree state, re-dispatch |
| Permission denied on worktree | Add paths to `.claude/settings.json`, restart session |
| Worktree creation fails | `python3 ./pinpoint-wt.py sync`, `supabase stop --all`, retry |
| Teammate unresponsive | Idle is normal — send follow-up message. If stuck, shutdown + replace |
| Team cleanup fails | Shutdown remaining teammates first, then `TeamDelete()` |
| Session dies with active team | `rm -rf ~/.claude/teams/<name> ~/.claude/tasks/<name>` |
| Hooks fire from wrong directory | Known issue (PinPoint-ro06). PreToolUse hooks with relative paths may resolve against lead's CLAUDE_PROJECT_DIR. Workaround: teammates can `touch .claude-hook-bypass` if stuck. |
| Background agent can't run Bash in worktree | Sandbox restrictions may block worktree paths. Use Agent Teams teammates (which get their own session) instead of background agents for implementation work. |
| Husky post-checkout hook fails | Check `.husky/post-checkout` for merge conflict markers. Fix in main worktree before creating new worktrees. |
