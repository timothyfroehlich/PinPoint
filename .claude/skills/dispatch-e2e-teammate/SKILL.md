---
name: dispatch-e2e-teammate
description: Dispatch a teammate for end-to-end issue work. Creates worktree, writes task contract, and launches teammate with correct context.
audience: lead agent coordinating work
---

> **Audience**: This skill is for the **lead agent** dispatching teammates.
> If you are a dispatched teammate, load `teammate-guide` instead.

## When to Use

Use when assigning an issue end-to-end to a teammate — they will implement, create a PR, wait for Copilot review, address comments, and verify CI before reporting done.

---

## Step 1: Create the Worktree

```bash
python3 pinpoint-wt.py create feat/<branch-name>
```

`pinpoint-wt.py` handles:
- **Port allocation**: unique Next.js, Supabase API, and Postgres ports per worktree
- **Config generation**: `supabase/config.toml` and `.env.local` auto-generated (read-only)
- **Dependency install**: `pnpm install` runs automatically

Check the output for the allocated ports and worktree path. Verify:
```bash
python3 pinpoint-wt.py list    # confirm ports are assigned
```

Worktrees land at: `/home/froeht/Code/pinpoint-worktrees/feat-<branch-name>`

---

## Step 2: Write the Task Contract

Create `.claude-task-contract` in the **worktree root** (not the main repo):

```bash
cat > /home/froeht/Code/pinpoint-worktrees/feat-<branch-name>/.claude-task-contract << 'EOF'
# Task Contract
# Check off each item as you complete it.
# The TaskCompleted hook blocks until all items are checked.

- [ ] Code changes implemented and tests pass (pnpm run check)
- [ ] PR created (#___)
- [ ] Copilot review received and comments addressed
- [ ] CI passing on final push

## Timeline
EOF
```

**Customize** the checklist for the task:
- Remove the Copilot line for trivial/doc-only changes
- Add task-specific items (e.g., "Migration generated and tested")

> **Must be sequential**: Write the contract BEFORE dispatching the teammate.

---

## Step 3: Dispatch the Teammate

Use the `Task` tool with this prompt structure:

```
You are working in a git worktree at: /home/froeht/Code/pinpoint-worktrees/feat-<branch-name>

Start by loading the `teammate-guide` skill (or read .claude/skills/teammate-guide/SKILL.md directly).

## Task: <issue title>
<beads issue ID and description>

## Files to modify
<specific files and what to change>

## Notes
<any task-specific context>
```

Launch with:
- `subagent_type: "general-purpose"`
- `mode: "bypassPermissions"`
- `team_name` if using Agent Teams

---

## Step 4: Monitor

While the teammate works:
```bash
bash scripts/workflow/pr-dashboard.sh          # overview of open PRs
bash scripts/workflow/copilot-comments.sh <PR> # check review status + comments
gh pr checks <PR>                              # CI status
```

The teammate will message you (Agent Teams) or you can check `TaskOutput` (background agents).

---

## Step 5: Cleanup

Once the PR merges:
```bash
python3 pinpoint-wt.py remove feat/<branch-name>
bd close <issue-id> --reason="Fixed in PR #NNN"
bd sync
```
