# Merge handoff

## Authority

The PinPoint merge decision is Tim's. The preferred agent terminal state is a computed
handoff. An agent may invoke `bash scripts/workflow/merge-pr.sh <PR> --human`, but the
PreToolUse hook must prompt Tim before it runs.

Raw agent merge channels remain hard-blocked because they bypass gate re-checks:
`gh pr merge`, the REST merge endpoint, and MCP `merge_pull_request`. This applies to
implicit current-repository targets and explicit `timothyfroehlich/PinPoint` targets.
Environment-only selectors fail closed. A statically explicit non-PinPoint repository
follows that repository's policy and the user's authorization.
There is no agent sentinel or alternate raw-channel bypass.

Use repository reads for a state check. `merge-pr.sh <PR> --dry-run` is also read-only,
but still triggers the approval prompt.

## Generate the handoff

After CI, exact-head review, threads, conflicts, and UI evidence are all satisfied, run:

```bash
bash scripts/workflow/merge-handoff.sh <PR>
```

Paste the script's complete output rather than recreating a summary. It computes review
coverage and distance, CI, thread count, mergeability and distance behind main, diff
composition, migrations, new environment variables, and UI evidence. Add prose only
for context the script cannot know.

The report is a snapshot. Preserve its re-run command so Tim can refresh it. Only the
script may supply the merge command: when any of its four gates fails, report that
blocker instead of calling the PR ready.

If CI is still running but every other gate is already complete, the report may provide
the human automerge form:

```text
! scripts/workflow/merge-pr.sh <PR> --human --automerge
```

Automerge waits for CI; it does not excuse an unreviewed head. The owning agent continues
the manually requested review outside the merge script.

Report the state as "ready for Tim to merge," never as merged by the agent. The
`!`-prefixed form is a human-typed shell passthrough and therefore Tim's channel.

## Exceptional merge states

If a gate needs an escape-hatch decision, the script removes `ready-for-review`, or the
merge tooling itself fails, read
[merge exceptions](exceptional-cases.md#merge-exceptions-and-broken-tooling) before
proposing a next action.
