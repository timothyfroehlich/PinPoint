# Agent Prompt Template

## Standalone Subagent

```markdown
## Task

Work bead {beads_id}. First run `bd show {beads_id}` && `bd update {beads_id} --claim` — the bead is the spec (scope, files, line numbers, acceptance criteria). Implement exactly what it describes; don't expand scope.

### Context not in the bead

{only what the bead doesn't already say — cross-bead conflicts, a reference PR, sequencing, or review feedback on an existing PR. Omit this section entirely if there's nothing to add.}

### Quality Gates

Run `pnpm run check` before returning. Then self-review **by hand**: read your own diff (`git diff origin/main...HEAD`) against `REVIEW.md` — the canonical rubric — plus the bead's acceptance criteria and out-of-scope list, and fix what you find. Don't reach for `/code-review` or `ultra`: both are user-triggered harness surfaces (`ultra` is also billed) and an agent cannot launch either.

A review covering the head commit is still **required** to merge — only the trigger changed. **Nothing requests a Copilot review for you**: not opening the PR, not a push, not the `ready-for-review` label, not green CI. That's the point — you decide when you're ready, so the one review you spend lands on finished work.

Open the PR whenever you like and watch CI; it costs nothing. Then finish all of it — CI fixes, review fixes, merge-from-main — stop iterating, and ask once:

`gh pr edit <PR> --add-reviewer "@copilot"`

Judge coverage by comparing the review's `commit_id` to head, not by the fact that a review exists (`gh api repos/timothyfroehlich/PinPoint/pulls/<PR>/reviews --jq '.[] | {user: .user.login, commit_id}'`); push past a review and you have to ask again. Only if Copilot fails to answer a request you actually made (silent skip or quota limit) do you fall back to `bash scripts/workflow/mark-claude-review.sh <PR> "<summary>"` — and only after genuinely reading the diff. The marker is an attestation, not a way to skip asking.

### Environment Setup

If tests fail with `POSTGRES_URL is not set`:

- Verify changes pass typecheck and lint: `pnpm exec tsc --noEmit && pnpm exec eslint .`
- CI will have proper env vars — proceed with commit if typecheck/lint pass

### Completion

1. Commit with conventional commit message
2. Push: `git push -u origin {branch_name}`
3. Create PR: `gh pr create --title "..." --body "..."` (no `--reviewer` — request the review at the end, not at creation)
4. Verify CI: `gh pr checks <PR>`
5. Once CI is green and you have stopped iterating, request the review — nothing does it for you: `gh pr edit <PR> --add-reviewer "@copilot"`. Then handle its threads

### Return Format

- **Branch**: {branch_name}
- **PR**: #{number}
- **CI**: passing/failing/pending
- **Self-review**: findings addressed
- **Copilot review**: requested (when?) / landed / fell back to marker
- **Blockers**: none or description
```

## Key Points

1. `isolation: "worktree"` sets CWD automatically — no absolute paths needed
2. The bead is the source of truth — point the agent at `bd show`; don't restate scope/files in the prompt (two places to drift)
3. Quality is self-enforced — explicit `pnpm run check` replaces hook enforcement
4. Structured return format enables quick lead assessment
5. No review fires automatically at all — the agent must request one, once, after it stops iterating (and again if it pushes past a review). The return format asks about it and the lead re-checks `commit_id` vs head at handoff (SKILL.md → "Ensure every PR is reviewed")

## Follow-Up Prompt (via SendMessage)

```markdown
## Follow-Up: {reason}

{specific_feedback_or_comments}

### Action Required

{what_to_do}

Push fixes and report updated status.
```
