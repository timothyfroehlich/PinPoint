# Agent Prompt Template

## Standalone Subagent

```markdown
## Task

Work bead {beads_id}. First run `bd show {beads_id}` && `bd update {beads_id} --claim` — the bead is the spec (scope, files, line numbers, acceptance criteria). Implement exactly what it describes; don't expand scope.

### Context not in the bead

{only what the bead doesn't already say — cross-bead conflicts, a reference PR, sequencing, or review feedback on an existing PR. Omit this section entirely if there's nothing to add.}

### Quality Gates

Before returning, run the gates **AGENTS.md §5 "Which tests to run"** names for the layers you touched — that tiered list is the source of truth, so read it rather than assuming. Note in particular that `pnpm run check` is a **static** gate: it runs no unit tests and no pytest, so on its own it cannot fail on a broken test.

Then self-review **by hand**: read your own diff (`git diff origin/main...HEAD`) against `REVIEW.md` — the canonical rubric — plus the bead's acceptance criteria and out-of-scope list, and fix what you find. Don't reach for `/code-review` or `ultra`: both are user-triggered harness surfaces (`ultra` is also billed) and an agent cannot launch either.

A review covering the head commit is **required** to merge, and **no bot reviews this repo**. The reviewer is Tim running `/code-review`, which you cannot launch — so getting reviewed is a handoff, not a command you run.

Open the PR whenever you like and watch CI; it costs nothing. Then finish all of it — CI fixes, merge-from-main — stop iterating, and report the PR as needing Tim's review. Don't wait around for one to appear; nothing is coming on its own.

**Recording that review, though, IS a command you run.** Once his `/code-review` lands, address what it found and attest the SHA he read:

`bash scripts/workflow/mark-claude-review.sh <PR> <depth> "<one-line findings>"`

`<depth>` is the level he ran (`low`|`medium`|`high`|`xhigh`|`max`|`ultra`) — ask if you don't know, don't guess. This marker is the only thing that satisfies the `reviewed` gate, so a review nobody posted leaves the PR unmergeable. **A clean review still gets a marker** — that is the one agents drop, because there is nothing to fix and nothing to push, so it feels like there is nothing to do. Post it; that is what unblocks the merge. Of the workflow scripts, `merge-pr.sh` is the only one that prompts Tim for approval when you run it (the merge decision stays his); every other script runs freely.

If the change is genuinely trivial (a typo, a comment, a one-line mechanical fix), attest it yourself and say why it was trivial:

`bash scripts/workflow/mark-claude-review.sh <PR> trivial "typo in a comment; no behavior change"`

The marker pins a SHA, so any push after it invalidates it. Re-attesting is right when what you pushed was the review's own findings; anything else needs a fresh `/code-review`.

The marker is an attestation that a review happened, never a way to skip one.

### Environment Setup

If tests fail with `POSTGRES_URL is not set`:

- Verify changes pass typecheck and lint: `pnpm exec tsc --noEmit && pnpm exec eslint .`
- CI will have proper env vars — proceed with commit if typecheck/lint pass

### Completion

1. Commit with conventional commit message
2. Push: `git push -u origin {branch_name}`
3. Create PR: `gh pr create --title "..." --body "..."`
4. Verify CI: `gh pr checks <PR>`
5. Once CI is green and you have stopped iterating, report the PR as needing Tim's `/code-review` — unless it qualifies for the trivial-change exception above

### Return Format

- **Branch**: {branch_name}
- **PR**: #{number}
- **CI**: passing/failing/pending
- **Self-review**: findings addressed
- **Review**: needs Tim's /code-review / attested at <sha> (trivial-change exception)
- **Blockers**: none or description
```

## Key Points

1. `isolation: "worktree"` sets CWD automatically — no absolute paths needed
2. The bead is the source of truth — point the agent at `bd show`; don't restate scope/files in the prompt (two places to drift)
3. Quality is self-enforced — hooks don't fire for subagents, so the prompt IS the enforcement. Point at AGENTS.md §5's tiered list, never at `pnpm run check` alone: `check` is static and cannot fail on a broken test (PP-lql4)
4. Structured return format enables quick lead assessment
5. Nothing reviews automatically and there is nothing for the agent to request — its terminal state is a PR reported as needing Tim's `/code-review`. The return format asks for exactly that, and at handoff the lead checks the marker's pinned SHA against head (SKILL.md → "Ensure every PR is reviewed")

## Follow-Up Prompt (via SendMessage)

```markdown
## Follow-Up: {reason}

{specific_feedback_or_comments}

### Action Required

{what_to_do}

Push fixes and report updated status.
```
