# Post-merge

Work is complete only when the landed change's relevant deployment risk is cleared and
the durable task state is accurate.

## Decide whether to watch deployment

Watch production deployment only when the PR could break it: changes under `src/`, a
migration, dependency or `next.config.ts` changes, environment-registry changes, or
anything on the `vercel-build` path.

Skip deployment watching for docs, skills, Beads, GitHub workflows, and dev-only scripts;
they cannot affect the deployed app, so watching would only burn time. If the owning
agent is absent when Tim merges, deployment watching belongs to Tim or a later explicit
request.

## Close and clean up

Close the Bead only when its acceptance criteria are actually complete. File genuine
follow-up work in Beads and post shared landing context to the Huddle daily.

Non-destructive handoff is immediate. Destructive cleanup—removing worktrees, branches,
or volumes—waits for explicit confirmation and uses the repository cleanup procedure in
`AGENTS.md`.
