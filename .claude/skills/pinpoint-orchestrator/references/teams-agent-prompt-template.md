# Teams Agent Prompt Template

Use this template when dispatching teammates in Claude Teams mode. For background agents, use `agent-prompt-template.md` instead.

## Key Differences from Background Template

- Adds Team/Name fields for team awareness
- Adds **Team Communication** section (SendMessage usage)
- Completion includes TaskUpdate + SendMessage notification steps
- Success criteria includes team coordination items

## Template

```markdown
## Task: {task_title}

**Worktree**: {worktree_path}
**Branch**: {branch_name}
**Beads Issue**: {beads_id}
**Team**: {team_name}
**Your Name**: {agent_name}

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

### Team Communication

- Use **SendMessage** (type: "message", recipient: "lead") to report status or ask questions
- When you complete your task, use **TaskUpdate** to mark it completed
- If you are blocked or need clarification, message the lead immediately
- Do NOT use broadcast — always use direct message to the lead
- Messages from teammates arrive automatically; do NOT poll for them
- Going idle between turns is normal — you'll be woken when messaged

### Specific Instructions

{specific_task_instructions}

### Environment Setup

If tests fail with `DATABASE_URL is not set`:
- The worktree is missing `.env.local` (orchestrator setup issue, not your problem)
- Verify your changes pass typecheck and lint: `pnpm exec tsc --noEmit && pnpm exec eslint .`
- CI will have proper env vars - proceed with commit if typecheck/lint pass

### Verification

Before completing:

1. `cd {worktree_path} && pnpm run check` - Must pass (or typecheck+lint if env missing)
2. `cd {worktree_path} && git status` - All changes staged
3. `cd {worktree_path} && git diff --cached` - Review changes

### Completion

1. Commit with conventional commit message
2. Push: `cd {worktree_path} && git push -u origin {branch_name}`
3. Create PR: `cd {worktree_path} && gh pr create --title "..." --body "..."`
4. **Mark task completed**: Use TaskUpdate to set your task status to "completed"
5. **Notify lead**: Use SendMessage to report completion with the PR URL

### Success Criteria

- [ ] All changes committed and pushed
- [ ] PR created with descriptive title and body
- [ ] `pnpm run check` passes
- [ ] No unrelated changes included
- [ ] Task marked completed in task list
- [ ] Lead notified via SendMessage with PR URL
```

## Example: Filled Template

```markdown
## Task: Fix machine dropdown default

**Worktree**: /home/froeht/Code/pinpoint-worktrees/feat/machine-dropdown-fix
**Branch**: feat/machine-dropdown-fix
**Beads Issue**: PinPoint-23v
**Team**: pinpoint-public-launch
**Your Name**: dropdown-fix

### Context

The machine dropdown on the public report form currently defaults to the first machine in the list. It should start with no selection (placeholder visible) unless a machine is specified via URL query param.

### Critical Instructions

1. **ALL file operations MUST use paths under**: `/home/froeht/Code/pinpoint-worktrees/feat/machine-dropdown-fix`
   - Read files: `/home/froeht/Code/pinpoint-worktrees/feat/machine-dropdown-fix/src/...`
   - Edit files: `/home/froeht/Code/pinpoint-worktrees/feat/machine-dropdown-fix/src/...`
   - Run commands: `cd /home/froeht/Code/pinpoint-worktrees/feat/machine-dropdown-fix && ...`

2. **Read AGENTS.md first**: `/home/froeht/Code/pinpoint-worktrees/feat/machine-dropdown-fix/AGENTS.md`

3. **Follow project patterns** from the skills referenced in AGENTS.md

### Team Communication

- Use **SendMessage** (type: "message", recipient: "lead") to report status or ask questions
- When you complete your task, use **TaskUpdate** to mark it completed
- If you are blocked or need clarification, message the lead immediately
- Do NOT use broadcast — always use direct message to the lead

### Specific Instructions

1. Find where the default machine ID is resolved (likely in `src/app/report/`)
2. Change logic to return `undefined` when no machine is explicitly requested
3. Update any tests that expect a default machine selection
4. Ensure the dropdown shows a placeholder when no machine is selected

### Verification

Before completing:

1. `cd /home/froeht/Code/pinpoint-worktrees/feat/machine-dropdown-fix && pnpm run check` - Must pass
2. `cd /home/froeht/Code/pinpoint-worktrees/feat/machine-dropdown-fix && git status` - All changes staged
3. `cd /home/froeht/Code/pinpoint-worktrees/feat/machine-dropdown-fix && git diff --cached` - Review changes

### Completion

1. Commit with conventional commit message
2. Push: `cd /home/froeht/Code/pinpoint-worktrees/feat/machine-dropdown-fix && git push -u origin feat/machine-dropdown-fix`
3. Create PR: `cd /home/froeht/Code/pinpoint-worktrees/feat/machine-dropdown-fix && gh pr create --title "fix(report): machine dropdown defaults to unselected" --body "..."`
4. Mark task completed: TaskUpdate(status: "completed")
5. Notify lead: SendMessage(type: "message", recipient: "lead", content: "PR #XXX created for machine dropdown fix", summary: "PR created for dropdown fix")

### Success Criteria

- [ ] All changes committed and pushed
- [ ] PR created with descriptive title and body
- [ ] `pnpm run check` passes
- [ ] No unrelated changes included
- [ ] Task marked completed in task list
- [ ] Lead notified via SendMessage with PR URL
```

## Key Points

1. **Absolute paths everywhere** - Agents don't respect `cd` instructions reliably
2. **Repeat the worktree path** - Redundancy prevents mistakes
3. **Include verification steps** - Ensures agent validates before completing
4. **Reference AGENTS.md** - Ensures agent follows project conventions
5. **TaskUpdate + SendMessage** - Teams completion requires both task tracking and lead notification
