# Agent Prompt Template

## Standalone Subagent (Primary)

```markdown
Start by loading the `pinpoint-teammate-guide` skill (or read .claude/skills/pinpoint-teammate-guide/SKILL.md directly).

## Task: {task_title}

**Beads Issue**: {beads_id}

### Context

{task_description}

{any_copilot_feedback_if_applicable}

### Specific Instructions

{specific_task_instructions}

### Task Contract

Write this to `.claude-task-contract` in your worktree root:

{contract_content}

### Quality Gates

Run `pnpm run check` before returning. Check off all contract items.
If Copilot review doesn't arrive within 5 minutes, note the timeout.

### Environment Setup

If tests fail with `POSTGRES_URL is not set`:
- Verify changes pass typecheck and lint: `pnpm exec tsc --noEmit && pnpm exec eslint .`
- CI will have proper env vars — proceed with commit if typecheck/lint pass

### Completion

1. Commit with conventional commit message
2. Push: `git push -u origin {branch_name}`
3. Create PR: `gh pr create --title "..." --body "..."`
4. Poll for Copilot review (up to 5 minutes)
5. Address any Copilot comments, push fixes
6. Verify CI: `gh pr checks <PR>`

### Return Format

- **Branch**: {branch_name}
- **PR**: #{number}
- **CI**: passing/failing/pending
- **Copilot**: no comments / N comments addressed / pending timeout
- **Blockers**: none or description
```

## Key Points

1. `isolation: "worktree"` sets CWD automatically — no absolute paths needed
2. Quality is self-enforced — explicit `pnpm run check` replaces hook enforcement
3. Structured return format enables quick lead assessment

## Agent Teams (Fallback)

Add to the prompt:
- `**Worktree**: {absolute_worktree_path}` (required — isolation broken with `team_name`)
- `**Team**: {team_name}` / `**Your Name**: {agent_name}`
- Replace return format with `SendMessage` instructions
- Add: "ALL file operations MUST use absolute paths under `{worktree_path}`"

## Resume Prompt (Follow-Up)

```markdown
## Follow-Up: {reason}

{specific_feedback_or_comments}

### Action Required

{what_to_do}

Push fixes and report updated status.
```
