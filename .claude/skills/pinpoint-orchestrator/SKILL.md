---
name: pinpoint-orchestrator
description: Orchestrate parallel subagent work in git worktrees. Use when dispatching multiple agents for independent tasks like UI fixes, Copilot feedback, or parallel feature work.
---

# Pinpoint Orchestrator

Coordinate multiple subagents working in parallel across isolated git worktrees.

## When to Use This Skill

- Multiple independent beads issues ready to work (`bd ready` shows 2+ items)
- Copilot review feedback on multiple PRs needs addressing
- Parallel feature development across branches
- User says "spin up agents", "orchestrate", "parallel work"

## Quick Reference

```bash
# Worktree management
./pinpoint-wt create feat/my-feature      # Create worktree
./pinpoint-wt list                         # Show all worktrees
./pinpoint-wt remove feat/my-feature       # Clean teardown

# Monitoring
gh pr checks <PR_NUMBER>                   # CI status
gh api repos/timothyfroehlich/PinPoint/pulls/<PR>/comments  # Copilot comments

# Labeling (when CI passes + no Copilot comments)
gh pr edit <PR_NUMBER> --add-label "ready-for-review"
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

## Phase 3: Agent Dispatch

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

---

## Phase 4: Monitoring Loop

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

### 4.5 Label Ready PRs

When a PR passes all CI checks AND has no unresolved Copilot comments, label it as ready for review:

```bash
# Check if PR is ready (all checks pass, no Copilot comments)
# Use the status check from 4.2 - if all checks are SUCCESS and Copilot count is 0

# Add ready-for-review label
gh pr edit <PR> --add-label "ready-for-review"
```

**One-time setup** (if label doesn't exist):

```bash
gh label create "ready-for-review" --description "PR passed CI and has no unresolved review comments" --color "0E8A16"
```

**Criteria for labeling**:

- ✅ All CI checks show `SUCCESS` (ignore `codecov/patch` which is informational)
- ✅ Zero Copilot comments on the PR
- ✅ PR is not a draft

**Note**: Remove the label if subsequent changes cause CI failure or new Copilot comments appear:

```bash
gh pr edit <PR> --remove-label "ready-for-review"
```

---

## Phase 5: Completion

### 5.1 Final Summary

```
## Orchestration Complete

PRs Ready for Review (labeled `ready-for-review`):
- #123: Fix machine dropdown - All checks passing ✅
- #125: Sort owner dropdown - All checks passing ✅

PRs Needing Attention:
- #124: Add owner link - 2 Copilot comments to address

Worktrees to Clean Up:
- feat/task-abc (PR #123 ready)
- feat/task-def (PR #124 needs work)
- feat/task-ghi (PR #125 ready)
```

### 5.2 Close Beads Issues

For successful PRs:

```bash
bd close PinPoint-abc PinPoint-ghi --reason="PR created and passing"
```

### 5.3 Cleanup Offer

Ask user:

```
Clean up worktrees for completed PRs?
- ./pinpoint-wt remove feat/task-abc
- ./pinpoint-wt remove feat/task-ghi
```

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

---

## Integration with Other Skills

- **beads**: Load issues with `bd ready`, close with `bd close`
- **github-monitor**: Monitor CI after PRs created
- **pinpoint-commit**: Use for final PR creation if agents need help
