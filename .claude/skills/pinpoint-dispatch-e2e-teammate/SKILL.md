---
name: pinpoint-dispatch-e2e-teammate
description: Dispatch a subagent for end-to-end issue work. Creates worktree via isolation, writes task contract, and launches subagent with correct context.
audience: lead agent coordinating work
---

> **Audience**: This skill is for the **lead agent** dispatching subagents.
> If you are a dispatched subagent, load `pinpoint-teammate-guide` instead.

## When to Use

Use when assigning an issue end-to-end to a subagent — they will implement, create a PR, wait for Copilot review, address comments, and verify CI before returning.

---

## Step 1: Prepare the Task Contract

Define the checklist the subagent will write to `.claude-task-contract` in its worktree:

```
# Task Contract
# Check off each item as you complete it.

- [ ] Code changes implemented and tests pass (pnpm run check)
- [ ] PR created (#___)
- [ ] Copilot review received and comments addressed
- [ ] CI passing on final push

## Timeline
```

Customize: remove Copilot line for trivial changes, add task-specific items.

---

## Step 2: Dispatch the Subagent

```
Task(
  subagent_type: "general-purpose",
  model: "sonnet",
  isolation: "worktree",
  run_in_background: true,
  mode: "bypassPermissions",
  prompt: "<see template below>"
)
```

**Prompt template:**

```markdown
Start by loading the `pinpoint-teammate-guide` skill (or read .claude/skills/pinpoint-teammate-guide/SKILL.md directly).

## Task: <issue title>
<beads issue ID and description>

## Task Contract
Write this to `.claude-task-contract` in your worktree root:
<contract from Step 1>

## Files to Modify
<specific files and what to change>

## Notes
<any task-specific context>

## Quality Gates
Run `pnpm run check` before returning. Check off all contract items.
If Copilot review doesn't arrive within 5 minutes, note timeout and return.

## Return Format
Report back with:
- **Branch**: <branch name>
- **PR**: #<number>
- **CI**: passing/failing/pending
- **Copilot**: no comments / N comments addressed / pending timeout
- **Blockers**: none or description
```

> **Agent Teams fallback**: Add `team_name`, `name`, absolute worktree path (created manually via `pinpoint-wt.py`), and replace return format with SendMessage instructions.

---

## Step 3: Monitor

```bash
bash scripts/workflow/pr-dashboard.sh          # overview of open PRs
bash scripts/workflow/copilot-comments.sh <PR> # check review status
gh pr checks <PR>                              # CI status
```

---

## Step 4: Follow-Up via Resume

Resume the subagent with follow-up work (Copilot comments, CI fixes, review feedback). Common scenarios:

- Subagent returns "Copilot pending" → wait → resume with actual comments
- CI fails → get logs → resume with failure context
- User requests changes → resume with review feedback

---

## Step 5: Cleanup

Once the PR merges:
```bash
python3 ./pinpoint-wt.py remove feat/<branch-name>
bd close <issue-id> --reason="Fixed in PR #NNN"
bd sync
```
