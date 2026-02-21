# Agent Prompt Template

Use this template when dispatching subagents (background or teammates) to work in worktrees.

## Template

```markdown
## Task: {task_title}

**Worktree**: {worktree_path}
**Branch**: {branch_name}
**Beads Issue**: {beads_id}

### Context

{task_description}

{any_copilot_feedback_if_applicable}

### Critical Instructions

1. **ALL file operations MUST use paths under**: `{worktree_path}`
   - Read files: `{worktree_path}/src/...`
   - Edit files: `{worktree_path}/src/...`
   - Run commands: `cd {worktree_path} && ...`

2. **Read AGENTS.md first**: `{worktree_path}/AGENTS.md`

3. **Follow project patterns** from the skills referenced in AGENTS.md

### Specific Instructions

{specific_task_instructions}

### Environment Setup

If tests fail with `POSTGRES_URL is not set`:
- The worktree is missing `.env.local` (orchestrator setup issue, not your problem)
- Verify your changes pass typecheck and lint: `pnpm exec tsc --noEmit && pnpm exec eslint .`
- CI will have proper env vars - proceed with commit if typecheck/lint pass

### Completion

1. Commit with conventional commit message
2. Push: `cd {worktree_path} && git push -u origin {branch_name}`
3. Create PR: `cd {worktree_path} && gh pr create --title "..." --body "..."`
```

## Key Points

1. **Absolute paths everywhere** - Agents don't respect `cd` instructions reliably
2. **Repeat the worktree path** - Redundancy prevents mistakes
3. **Reference AGENTS.md** - Ensures agent follows project conventions
4. **Quality gates are automatic** - `TaskCompleted` hook runs `pnpm run check`; push enforcement is via `TeammateIdle` hook. No manual checklists needed.

## For Agent Teams Teammates

Add these fields to the header:
- `**Team**: {team_name}`
- `**Your Name**: {agent_name}`

Add a Team Communication section:
- Use **SendMessage** (type: "message", recipient: "lead") to report status or ask questions
- When you complete your task, use **TaskUpdate** to mark it completed
- If blocked, message the lead immediately
