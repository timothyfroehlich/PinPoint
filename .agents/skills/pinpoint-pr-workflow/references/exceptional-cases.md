# Exceptional cases

Load only the section matching the exceptional branch named by `SKILL.md` or a phase
reference.

## Manual local review

This route is valid only when Tim explicitly chooses `/codex:review` or `/code-review`.
Agents cannot launch either local command.

First finish the work and verify the local reviewer will see the intended PR diff:

```bash
bash scripts/workflow/review-preflight.sh <PR>
```

The local reviewers read Git state in the current directory; they do not read the PR or
know its head SHA. A review from the wrong worktree can therefore return a false-clean
result. The preflight prints Tim's commands only when all of these hold:

- current branch is the PR branch;
- local HEAD is the pushed PR head;
- the tree is clean and `main...HEAD` is non-empty;
- local `main` equals `origin/main`;
- the PR targets `main`.

Local `main` matters because the Codex plugin resolves the bare local default branch,
while ordinary branch sync merges `origin/main` without advancing local `main`. Follow
the preflight's named remedy when another worktree owns `main`; never dismiss the
mismatch as harmless.

Once the preflight prints the command, stop changing the branch. Every push invalidates
the review Tim is about to run.

When Tim types `/codex:review`, choose foreground or background without asking:
foreground only for a clearly small one- or two-file diff; background for every larger
or unclear diff. State the choice in one line. This is an operational decision.

The plugin's underlying model invocation can be intermittently blocked by the harness
classifier. If denied, say so and ask Tim to type the command again. Do not hand-roll the
plugin's Node invocation.

After adjudicating findings, attest the still-current reviewed head:

```bash
bash scripts/workflow/mark-review.sh <PR> codex-plugin-cc base-main "<one-line findings summary>"
bash scripts/workflow/mark-review.sh <PR> claude-code <depth> "<one-line findings summary>"
```

Use `codex-plugin-cc base-main` only for `/codex:review`. Use `claude-code <depth>` only
for `/code-review`, with the exact depth Tim ran (`low`, `medium`, `high`, `xhigh`,
`max`, or `ultra`). The marker records both method and SHA; never substitute a different
review or refresh a marker after a push. Historical `claude-code:trivial` markers remain
readable, but agents do not create new self-attestations.

### Permission-rule constraints

The repository permits the documented relative invocations of `mark-review.sh` and
`review-preflight.sh` so those required steps do not fail unpredictably. That permission
does not prove an attestation is honest; the agent must still verify Tim ran the exact
review against the exact head.

Use the relative `bash scripts/workflow/...` command. Absolute Mac paths do not match the
allow rule, and chaining another command does not inherit it. Keep summary-string quotes
balanced; an unbalanced quote makes the merge guard fail closed. Fix invocation syntax
rather than seeking a bypass.

## Merge exceptions and broken tooling

`merge-pr.sh` evaluates `ci`, `threads`, `reviewed`, and `no_conflict`.

- `--force` bypasses only `threads` and `reviewed`.
- `--bypass-merge-requirements` bypasses `ci` and passes GitHub `--admin`.
- `no_conflict` is never bypassable.

Both escape hatches require Tim's approval. Inform Tim of them only when their actual
case applies.

On any gate failure, including an automerge red path, the script removes
`ready-for-review`. Fix the cause and reapply the label before generating a new handoff.

A `reviewed` failure is almost never a force case: `unreviewed`, stale coverage, and
`not_approved` all mean the lifecycle is unfinished. Obtain honest exact-head coverage.

Use `--bypass-merge-requirements` only for a known-irrelevant required-check failure that
was manually verified safe, or an emergency hotfix where waiting is unacceptable. Log a
confirmed infrastructure flake first:

```bash
bash scripts/workflow/log-gha-flake.sh <pr> <run-id> <class> "<symptom>"
```

Never propose bypassing a merge conflict or an unverified underlying failure.

If `merge-pr.sh` itself is broken, agents still do not use raw merge channels. Report the
breakage. Tim may decide to run a raw merge in his own shell or wait for the guarded
script to be fixed; document any emergency exception.

## Multiple Dependabot lockfile PRs

When two or more Dependabot PRs touch the same lockfile, merging them back-to-back from
their original snapshots can produce duplicate YAML keys without a textual conflict.
Dependabot's `rebase-strategy: auto` does not guarantee regeneration after an unrelated
lockfile PR merges.

After the first such PR merges, comment `@dependabot rebase` on every remaining
lockfile-touching Dependabot PR. Wait for each regenerated head's CI before handing it to
Tim. This bot regeneration is the required exception to the repository's ordinary
merge-never-rebase branch rule.

Check whether a remaining branch predates main with:

```bash
pr_branch=$(gh pr view <second_pr> --json headRefName --jq .headRefName)
gh api "repos/{owner}/{repo}/compare/main...$pr_branch" --jq '.behind_by'
```

If `behind_by > 0`, request the Dependabot rebase and wait. Do not use `baseRefOid` for
this check; GitHub reports the base branch's current SHA, so it cannot reveal a stale PR
head.

## GitHub MCP field semantics

- Responses use snake_case fields such as `is_resolved` and `submitted_at`.
- Cap list reads at `perPage: 100` and use cursor pagination for additional GraphQL pages.
- Issue-update labels replace the full label list; read current labels before writing.
- Resolving a thread uses its `PRRT_...` thread ID; owner, repo, and pull number may be
  schema-required but do not select the thread.
