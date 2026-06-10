# Agent Prompt Template

## Standalone Subagent

```markdown
## Task: {task_title}

**Beads Issue**: {beads_id}

### Context

{task_description}

{any_review_feedback_if_applicable}

### Specific Instructions

{specific_task_instructions}

### Quality Gates

Run `pnpm run check` before returning.

### Environment Setup

If tests fail with `POSTGRES_URL is not set`:

- Verify changes pass typecheck and lint: `pnpm exec tsc --noEmit && pnpm exec eslint .`
- CI will have proper env vars — proceed with commit if typecheck/lint pass

### Completion

1. Commit with conventional commit message
2. Push: `git push -u origin {branch_name}`
3. Create PR: `gh pr create --title "..." --body "..."`
4. Verify CI: `gh pr checks <PR>`

### Return Format

- **Branch**: {branch_name}
- **PR**: #{number}
- **CI**: passing/failing/pending
- **Blockers**: none or description
```

## Key Points

1. `isolation: "worktree"` sets CWD automatically — no absolute paths needed
2. Quality is self-enforced — explicit `pnpm run check` replaces hook enforcement
3. Structured return format enables quick lead assessment

## Follow-Up Prompt (via SendMessage)

```markdown
## Follow-Up: {reason}

{specific_feedback_or_comments}

### Action Required

{what_to_do}

Push fixes and report updated status.
```
