# Agent Prompt Template

## Standalone Subagent

```markdown
## Task

Work bead {beads_id}. First run `bd show {beads_id}` && `bd update {beads_id} --claim` — the bead is the spec (scope, files, line numbers, acceptance criteria). Implement exactly what it describes; don't expand scope.

### Context not in the bead

{only what the bead doesn't already say — cross-bead conflicts, a reference PR, sequencing, or review feedback on an existing PR. Omit this section entirely if there's nothing to add.}

### Quality Gates

Run `pnpm run check` before returning. Then self-review: run `/code-review` on your own diff (model-invocable **local** review — **not** `ultra`, which is user-triggered/billed and you cannot launch) and address serious findings. After your final push, if Copilot hasn't reviewed your head commit within ~10 min, run `bash scripts/workflow/mark-claude-review.sh <PR> "<summary>"` so the `reviewed` merge gate passes.

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
- **Self-review**: findings addressed / marker posted?
- **Blockers**: none or description
```

## Key Points

1. `isolation: "worktree"` sets CWD automatically — no absolute paths needed
2. The bead is the source of truth — point the agent at `bd show`; don't restate scope/files in the prompt (two places to drift)
3. Quality is self-enforced — explicit `pnpm run check` replaces hook enforcement
4. Structured return format enables quick lead assessment

## Follow-Up Prompt (via SendMessage)

```markdown
## Follow-Up: {reason}

{specific_feedback_or_comments}

### Action Required

{what_to_do}

Push fixes and report updated status.
```
