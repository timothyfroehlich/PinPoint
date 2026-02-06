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
- User says "use teams", "interactive mode", "coordinate agents" → use Teams mode

## Dispatch Modes

| Mode | When to Use | How It Works |
|------|-------------|--------------|
| **Background Agents** (default) | Independent tasks, fire-and-forget | `Task(run_in_background: true)` → poll with `TaskOutput` |
| **Teams** (interactive) | Dependent tasks, mid-flight steering, plan approval | `Teammate(spawnTeam)` → `SendMessage` for coordination |

## Quick Reference

```bash
# Worktree management
./pinpoint-wt create feat/my-feature      # Create worktree (new branch)
./pinpoint-wt list                         # Show all worktrees
./pinpoint-wt remove feat/my-feature       # Clean teardown

# Monitoring
gh pr checks <PR_NUMBER>                   # CI status
gh api repos/timothyfroehlich/PinPoint/pulls/<PR>/comments  # Copilot comments

# Ready-for-review workflow
gh pr edit <PR_NUMBER> --add-label "ready-for-review"    # Label ready PR
./pinpoint-wt remove <branch>                             # Free branch for review tool

# Teams mode (requires CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1)
Teammate(operation: "spawnTeam", team_name: "pinpoint-<summary>")
SendMessage(type: "message", recipient: "<name>", content: "...")
SendMessage(type: "shutdown_request", recipient: "<name>")
Teammate(operation: "cleanup")
```

---

## Phase 1: Task Selection

### 1.1 Load Available Work

```bash
bd ready                    # Show issues with no blockers
bd list --status=open       # All open issues
```

### 1.2 Present Options to User

Show tasks in a clear format:

```
Available tasks:
1. [PinPoint-abc] Fix machine dropdown default
2. [PinPoint-def] Add owner link to issue detail
3. [PinPoint-ghi] Sort owner dropdown by machine count

Which tasks should I work on in parallel? (comma-separated numbers)
```

### 1.3 Validate Independence

Before proceeding, verify:

- [ ] No task blocks another (`bd show <id>` to check blockedBy)
- [ ] Tasks don't modify the same files
- [ ] Each task can be completed independently

### 1.4 Choose Dispatch Mode

**Background Agents** (default) — use when:

- Tasks are fully independent (no shared state, no ordering)
- Well-defined with clear acceptance criteria
- Fire-and-forget is sufficient
- User hasn't requested teams/coordination

**Teams Mode** (interactive) — use when:

- Tasks have dependencies or sequencing (e.g., "build API first, then UI")
- Need mid-flight steering (complex refactors, exploratory work)
- Want plan approval before agents implement risky changes
- Need agents to coordinate on shared interfaces
- User says "use teams", "interactive mode", "coordinate"

→ Background Agents: Continue to **Phase 3**
→ Teams Mode: Continue to **Phase 3T**

---

## Phase 2: Worktree Setup

### 2.1 Create Worktrees

**For NEW branches** (creating fresh work):

```bash
./pinpoint-wt create feat/<task-branch>
```

This creates the worktree, generates `.env.local`, installs dependencies, and allocates ports.

**For EXISTING branches** (e.g., addressing PR feedback):

```bash
# Step 1: Create worktree for existing branch
git worktree add /home/froeht/Code/pinpoint-worktrees/<branch-name> <branch-name>

# Step 2: Generate .env.local and config.toml (CRITICAL - don't skip!)
cd /home/froeht/Code/pinpoint-worktrees/<branch-name> && ../PinPoint-Secondary/pinpoint-wt sync

# Step 3: Install dependencies
cd /home/froeht/Code/pinpoint-worktrees/<branch-name> && pnpm install
```

**Why sync is required:** The `pinpoint-wt sync` command generates `.env.local` with correct port allocations and database URLs. Without it, tests requiring `DATABASE_URL` will fail locally.

### 2.2 Record Worktree Paths

Track the mapping:

```
Task: PinPoint-abc → /home/froeht/Code/pinpoint-worktrees/feat/task-abc
Task: PinPoint-def → /home/froeht/Code/pinpoint-worktrees/feat/task-def
```

### 2.3 Verify Setup

```bash
./pinpoint-wt list   # Confirm all worktrees created with port assignments

# Verify .env.local exists in each worktree
ls /home/froeht/Code/pinpoint-worktrees/*/.env.local
```

---

## Phase 3: Agent Dispatch (Background Mode)

### 3.1 Agent Prompt Template

**CRITICAL**: Each agent prompt MUST include:

1. Full absolute worktree path
2. Explicit instruction to work ONLY in that path
3. Beads issue context
4. Reference to AGENTS.md

Use the template in `references/agent-prompt-template.md`.

### 3.2 Launch Agents in Parallel

Dispatch all agents in a SINGLE message with multiple Task tool calls:

```
[Task 1: Fix machine dropdown]
  subagent_type: general-purpose
  run_in_background: true
  prompt: <filled template for task 1>

[Task 2: Add owner link]
  subagent_type: general-purpose
  run_in_background: true
  prompt: <filled template for task 2>
```

### 3.3 Track Agent IDs

Record agent IDs for monitoring:

```
Agent abc123 → Task PinPoint-abc → PR TBD
Agent def456 → Task PinPoint-def → PR TBD
```

→ Continue to **Phase 4**

---

## Phase 3T: Agent Dispatch (Teams Mode)

> **Prerequisite**: Set `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in environment or settings.

### 3T.1 Create Team

```
Teammate(operation: "spawnTeam", team_name: "pinpoint-<summary>", description: "Working on <tasks>")
```

This creates:
- Team config: `~/.claude/teams/pinpoint-<summary>/config.json`
- Task list: `~/.claude/tasks/pinpoint-<summary>/`

### 3T.2 Create Task List

Create tasks with worktree paths and beads context:

```
TaskCreate(
  subject: "Fix machine dropdown default",
  description: "Worktree: /home/froeht/Code/pinpoint-worktrees/feat/task-abc\nBranch: feat/task-abc\nBeads: PinPoint-abc\n\n<task details>",
  activeForm: "Fixing machine dropdown"
)
```

Set up dependencies if tasks have ordering:

```
TaskUpdate(taskId: "2", addBlockedBy: ["1"])   # Task 2 waits for Task 1
```

### 3T.3 Spawn Teammates

Use Task tool with `team_name` and `name` parameters:

```
Task(
  subagent_type: "general-purpose",
  team_name: "pinpoint-<summary>",
  name: "dropdown-fix",
  prompt: <filled teams template for task 1>
)
```

Use the template in `references/teams-agent-prompt-template.md`.

**Naming convention**: Name teammates by their task (e.g., `dropdown-fix`, `owner-link`, `e2e-tests`).

### 3T.4 Assign Tasks

Assign tasks to specific teammates:

```
TaskUpdate(taskId: "1", owner: "dropdown-fix")
```

Only assign unblocked tasks initially. Blocked tasks will be assigned when their dependencies complete.

→ Continue to **Phase 4T**

---

## Phase 4: Monitoring Loop (Background Mode)

### 4.1 Poll Agent Status

Check background agents periodically:

- Use TaskOutput tool with `block: false` to check status
- Agents will notify when complete

### 4.2 On Agent Completion

For each completed agent:

1. **Check for PR**:

   ```bash
   gh pr list --head <branch-name> --json number,url
   ```

2. **Check GH Actions**:

   ```bash
   gh pr view <PR> --json statusCheckRollup --jq '.statusCheckRollup[] | "\(.name): \(.conclusion // .status)"'
   ```

3. **Check Copilot Comments**:
   ```bash
   gh api repos/timothyfroehlich/PinPoint/pulls/<PR>/comments --jq '.[] | select(.user.login == "Copilot") | "File: \(.path):\(.line)\n\(.body)\n---"'
   ```

### 4.3 Report Status

Format for user:

```
## Agent Status Report

| Task | Agent | PR | CI Status | Copilot | Labeled |
|------|-------|----|-----------|---------|---------|
| PinPoint-abc | Complete | #123 | All passing | 0 comments | ✅ ready-for-review |
| PinPoint-def | Complete | #124 | E2E failing | 2 comments | ❌ |
| PinPoint-ghi | Running | - | - | - | - |
```

### 4.4 Handle Issues

**If CI fails**:

- Show failed check details
- Offer to re-dispatch agent with fix instructions

**If Copilot comments exist**:

- Show comment summary
- Offer to re-dispatch agent with feedback

### 4.5 Label & Release Ready PRs

When a PR passes all CI checks AND has no unresolved Copilot comments:

**Step 1: Label the PR**

```bash
gh pr edit <PR> --add-label "ready-for-review"
```

**Step 2: Clean up the worktree** (frees the branch for the review tool)

```bash
./pinpoint-wt remove <branch-name>
```

**Why cleanup at labeling**: The review tool needs to check out the PR branch. Git won't allow two worktrees to have the same branch checked out. Cleaning up the worktree releases the branch for review.

**Criteria for labeling**:

- ✅ All CI checks show `SUCCESS` (ignore `codecov/patch` which is informational)
- ✅ Zero Copilot comments on the PR
- ✅ PR is not a draft

**One-time setup** (if label doesn't exist):

```bash
gh label create "ready-for-review" --description "PR passed CI and has no unresolved review comments" --color "0E8A16"
```

### 4.6 Review Feedback Loop

After the user reviews a PR with the review tool:

**If approved**: User merges the PR. Done.

**If changes requested**: User adds a comment explaining desired changes and removes the label:

```bash
gh pr edit <PR> --remove-label "ready-for-review"
```

To address feedback, re-create the worktree and re-dispatch:

```bash
# Re-create worktree for the branch
git worktree add /home/froeht/Code/pinpoint-worktrees/<branch-name> <branch-name>
cd /home/froeht/Code/pinpoint-worktrees/<branch-name> && ../PinPoint-Secondary/pinpoint-wt sync
cd /home/froeht/Code/pinpoint-worktrees/<branch-name> && pnpm install
```

Then dispatch an agent with the user's feedback in the prompt context.

→ Continue to **Phase 5**

---

## Phase 4T: Monitoring Loop (Teams Mode)

### 4T.1 Message-Based Status

Teammates notify on completion automatically. Key differences from background mode:

- Messages arrive automatically — **do NOT busy-loop or poll**
- Idle state is **normal** — teammate is waiting for input, not stuck
- A teammate sending a message then going idle is the expected flow

### 4T.2 Plan Approval (Optional)

If teammates have `plan_mode_required`, they submit plans before implementing:

```
SendMessage(
  type: "plan_approval_response",
  request_id: "<from teammate's request>",
  recipient: "<teammate-name>",
  approve: true   # or false with content: "feedback"
)
```

This is the key Teams advantage: course-correct before code is written.

### 4T.3 Dependency Unblocking

When a blocking task completes:

1. Check `TaskList` for newly unblocked tasks
2. Assign to idle teammate: `TaskUpdate(taskId: "2", owner: "agent-name")`
3. Send message: `SendMessage(type: "message", recipient: "agent-name", content: "Task X is done, you can start on Y now")`

### 4T.4 Mid-Flight Steering

Send targeted guidance to specific teammates:

```
SendMessage(
  type: "message",
  recipient: "dropdown-fix",
  content: "Copilot flagged the same pattern in PR #124. Apply the fix here too.",
  summary: "Apply Copilot fix pattern"
)
```

**Never use broadcast for task-specific steering.** Broadcast is expensive (N messages for N teammates). Reserve for critical team-wide announcements only.

### 4T.5 CI/Copilot Checks + Labeling

Same commands and workflow as Phase 4.2-4.6. Difference: you can send fix instructions directly to the responsible teammate instead of re-dispatching a new agent.

```
SendMessage(
  type: "message",
  recipient: "dropdown-fix",
  content: "E2E test failed: navigation.spec.ts:18 expects 'quick-stats' but landing page changed. Update the test to check for the welcome heading instead.",
  summary: "Fix failing E2E test"
)
```

→ Continue to **Phase 5T**

---

## Phase 5: Completion (Background Mode)

### 5.1 Final Summary

```
## Orchestration Complete

PRs Ready for Review (labeled `ready-for-review`, worktrees cleaned up):
- #123: Fix machine dropdown - All checks passing ✅
- #125: Sort owner dropdown - All checks passing ✅

PRs Needing Attention:
- #124: Add owner link - 2 Copilot comments to address

Remaining Worktrees (PRs still need work):
- feat/task-def (PR #124 needs work)
```

### 5.2 Close Beads Issues

For successful PRs:

```bash
bd close PinPoint-abc PinPoint-ghi --reason="PR created and passing"
```

### 5.3 Remaining Cleanup

Only worktrees for PRs that still need work should remain. Ready PRs were already cleaned up during labeling (Phase 4.5).

If the user wants to clean up remaining worktrees:

```bash
./pinpoint-wt remove feat/task-def
```

---

## Phase 5T: Completion (Teams Mode)

### 5T.1 Shutdown Teammates

Send shutdown request to each teammate:

```
SendMessage(type: "shutdown_request", recipient: "dropdown-fix", content: "All tasks done")
```

Wait for `shutdown_response(approve: true)`. If rejected, check reason — teammate may still be finishing work.

### 5T.2 Cleanup Team

After ALL teammates have shut down:

```
Teammate(operation: "cleanup")
```

This removes `~/.claude/teams/<name>/` and `~/.claude/tasks/<name>/`. **Fails if teammates are still active** — shutdown first.

### 5T.3 Standard Completion

Same as Phase 5: final summary, close beads issues, worktree cleanup. Ready PRs were already cleaned up during labeling.

---

## Error Recovery

### Agent Fails to Create PR

1. Check agent output for errors
2. Verify worktree state: `cd <worktree> && git status`
3. Re-dispatch with more specific instructions

### Permission Denied Errors

Ensure `.claude/settings.json` has worktree permissions:

```json
"Read(//home/froeht/Code/pinpoint-worktrees/**)",
"Edit(//home/froeht/Code/pinpoint-worktrees/**)",
"Write(//home/froeht/Code/pinpoint-worktrees/**)"
```

**Session restart required** after adding permissions (permissions are cached at session start).

### Worktree Creation Fails

```bash
./pinpoint-wt sync          # Regenerate configs
supabase stop --all         # Clear Supabase state
./pinpoint-wt create ...    # Retry
```

### Teams-Specific Recovery

**Teammate unresponsive**: Idle state is normal — teammate is waiting for input. Send a follow-up message. If truly stuck after multiple messages, send `shutdown_request` and spawn a replacement.

**Dependency deadlock**: If all remaining tasks are blocked, check `TaskList` for circular `blockedBy` entries. Break the cycle with `TaskUpdate` to remove a `blockedBy` entry, then assign the unblocked task.

**Teammate working in wrong directory**: Same root cause as background agents (inherits parent cwd). Send a corrective message with the explicit worktree path. Prevention: use the teams-agent-prompt-template which repeats the path redundantly.

**Cleanup fails**: Usually means teammates are still active. Check `TaskList` for `in_progress` tasks, send `shutdown_request` to remaining teammates, wait for confirmation, then retry cleanup.

**Session dies with active team**: Team state persists in `~/.claude/teams/<name>/`. Manual cleanup: `rm -rf ~/.claude/teams/<name> ~/.claude/tasks/<name>`. Worktrees are unaffected — clean up separately with `./pinpoint-wt remove`.

---

## Integration with Other Skills

- **beads**: Load issues with `bd ready`, close with `bd close`
- **github-monitor**: Monitor CI after PRs created
- **pinpoint-commit**: Use for final PR creation if agents need help
