# Agent Prompt Template

## Standalone Subagent

```markdown
## Task

Work bead {beads_id}. First run `bd show {beads_id}` && `bd update {beads_id} --claim` — the bead is the spec (scope, files, line numbers, acceptance criteria). Implement exactly what it describes; don't expand scope.

### Context not in the bead

{only what the bead doesn't already say — cross-bead conflicts, a reference PR, sequencing, or review feedback on an existing PR. Omit this section entirely if there's nothing to add.}

### Quality Gates

Before returning, run the gates **AGENTS.md §5 "Which tests to run"** names for the layers you touched — that tiered list is the source of truth, so read it rather than assuming. Note in particular that `pnpm run check` is a **static** gate: it runs no unit tests and no pytest, so on its own it cannot fail on a broken test.

Then self-review **by hand**: read your own diff (`git diff origin/main...HEAD`) against
`REVIEW.md` — the canonical rubric — plus the bead's acceptance criteria and out-of-scope
list, and fix what you find.

Follow `pinpoint-pr-workflow` Phase 2–3 through completion: open the PR as a GitHub
draft, monitor current-head CI, promote it only after `CI Gate` succeeds, and stay active
through automatic Codex review. Address or explicitly decline every finding, resolve
every thread, and repeat after each corrective push until Codex has approved the exact
current head or posted its trusted clean connector comment for that head. Before any
later push, apply the skill's per-upload 51-line re-draft rule.

Do not comment `@codex review` unless Tim explicitly asks for a manual trigger. Do not
self-attest a trivial change. If Tim explicitly runs `/codex:review` or `/code-review`,
follow the skill's review-preflight and exact SHA-pinned attestation route.

### Environment Setup

If tests fail with `POSTGRES_URL is not set`:

- Verify changes pass static gate: `pnpm run check`
- CI will have proper env vars — proceed with commit if typecheck/lint pass

### Completion

1. Commit with conventional commit message
2. Push: `git push -u origin {branch_name}`
3. Create draft PR: `gh pr create --draft --title "..." --body "..."`
4. Monitor CI, promote after current-head `CI Gate`, and own automatic review to a clean exact-head result
5. Apply `ready-for-review` only after every Phase 3 gate passes

### Return Format

- **Branch**: {branch_name}
- **PR**: #{number}
- **CI**: passing/failing/pending
- **Self-review**: findings addressed
- **Review**: clean automatic Codex result at <sha> / pending, with thread count
- **Blockers**: none or description
```

## Key Points

1. `isolation: "worktree"` sets CWD automatically — no absolute paths needed
2. The bead is the source of truth — point the agent at `bd show`; don't restate scope/files in the prompt (two places to drift)
3. Quality is self-enforced — hooks don't fire for subagents, so the prompt IS the enforcement. Point at AGENTS.md §5's tiered list, never at `pnpm run check` alone: `check` is static and cannot fail on a broken test (PP-lql4)
4. Structured return format enables quick lead assessment
5. Automatic review covers each update; the owning agent remains active until a clean result pins head and threads are resolved

## Follow-Up Prompt (via SendMessage)

```markdown
## Follow-Up: {reason}

{specific_feedback_or_comments}

### Action Required

{what_to_do}

Push fixes and report updated status.
```
