# PR workflow coverage inventory

Read this file only when changing the skill's instruction architecture or auditing a
policy move. Runtime routes do not need it.

## Size baseline

- Before PP-4smi: one `SKILL.md`, 443 lines / 35,738 bytes.
- After PP-4smi, excluding this audit-only inventory: 64-line / 3,388-byte router;
  521 lines / 22,965 bytes across the router and six runtime references.
- Default skill-body load is therefore 32,350 bytes smaller. A normal branch adds only
  its required phase reference instead of the whole lifecycle.

## Heading-by-heading move

| Previous section                            | Authoritative destination                                                        |
| :------------------------------------------ | :------------------------------------------------------------------------------- |
| When to use / phase chooser                 | `SKILL.md` phase router                                                          |
| Phase 1: Commit / commit message            | `commit-and-open.md`                                                             |
| Phase 2: PR                                 | `commit-and-open.md`                                                             |
| Agent origin                                | `commit-and-open.md`                                                             |
| `ownerless` queue and adoption              | `commit-and-open.md`                                                             |
| PR description template                     | `commit-and-open.md`                                                             |
| Phase 3: Review                             | `ci-and-review.md`                                                               |
| Delegated watcher architecture              | `ci-and-review.md`                                                               |
| Recommended watcher models                  | `ci-and-review.md`                                                               |
| Owner/watcher responsibility split          | `SKILL.md` invariant plus mechanics in `ci-and-review.md`                        |
| Bounded dispatch envelope and telemetry     | `ci-and-review.md`                                                               |
| Watch current-head CI / terminal outcomes   | `ci-and-review.md`                                                               |
| Read and address review comments            | `ci-and-review.md`                                                               |
| Manual-only exact-head request              | `SKILL.md` invariant plus procedure in `ci-and-review.md`                        |
| Later uploads and replacement coverage      | `ci-and-review.md`                                                               |
| Tim-run local review and attestation        | `exceptional-cases.md` manual-review branch                                      |
| Review-command permission constraints       | `exceptional-cases.md` manual-review branch                                      |
| Readiness is not review                     | `ci-and-review.md`                                                               |
| UI screenshots and no-visual-change         | `screenshots-and-readiness.md`                                                   |
| Apply `ready-for-review`                    | `screenshots-and-readiness.md`                                                   |
| Phase 4 merge authority                     | `SKILL.md` invariant plus `merge-handoff.md`                                     |
| Computed merge handoff                      | `merge-handoff.md`                                                               |
| Escape hatches and label removal on failure | `exceptional-cases.md` merge branch                                              |
| Broken merge tooling                        | `exceptional-cases.md` merge branch                                              |
| Multiple Dependabot lockfile PRs            | `exceptional-cases.md` Dependabot branch                                         |
| Phase 5 post-merge deployment judgment      | `post-merge.md`                                                                  |
| Bead close, Huddle handoff, and cleanup     | `post-merge.md`                                                                  |
| GitHub MCP field semantics                  | `exceptional-cases.md` MCP branch                                                |
| Script status-token authority               | `SKILL.md` pointer to `scripts/workflow/AGENTS.md`                               |
| Historical consolidation design             | `docs/superpowers/specs/2026-05-16-pinpoint-pr-workflow-consolidation-design.md` |

## Normative boundary check

The runtime documents retain one authoritative home for each required boundary:

- agent-created PRs begin as drafts and carry origin attribution;
- adoption removes `ownerless` and transfers full lifecycle ownership;
- watchers are lightweight, isolated, read-only, and return terminal JSON;
- owners alone mutate state and adjudicate every review thread;
- every pushed head receives current-head CI before one manual review request;
- any later push invalidates old review coverage;
- UI-touching PRs carry current screenshots or a genuine no-rendered-change marker;
- `ready-for-review` follows all gates and never substitutes for review;
- Tim alone decides merge through the guarded path;
- bypasses, broken tooling, and Dependabot lockfiles retain fail-safe handling;
- deployment watching is risk-based, and destructive cleanup requires confirmation.

## Route probes

Use these probes after a routing change. Each prompt must select every listed runtime
reference and no unrelated phase reference.

| Representative state                             | Expected load                                                              |
| :----------------------------------------------- | :------------------------------------------------------------------------- |
| "I have uncommitted changes; prepare a PR"       | `commit-and-open.md`, then `ci-and-review.md` only after opening           |
| "PR CI is pending"                               | `ci-and-review.md`                                                         |
| "Codex left review findings"                     | `ci-and-review.md`                                                         |
| "The review is clean; this touched a component"  | `screenshots-and-readiness.md`                                             |
| "Hand me the merge command"                      | `merge-handoff.md`                                                         |
| "Tim merged it"                                  | `post-merge.md`                                                            |
| "Tim ran `/code-review high`"                    | `ci-and-review.md` plus the manual-review branch of `exceptional-cases.md` |
| "Two Dependabot PRs both changed pnpm-lock.yaml" | the Dependabot branch of `exceptional-cases.md`                            |
| "The merge script is broken"                     | `merge-handoff.md` plus the merge branch of `exceptional-cases.md`         |
| "MCP replaced the PR labels"                     | the MCP branch of `exceptional-cases.md`                                   |
