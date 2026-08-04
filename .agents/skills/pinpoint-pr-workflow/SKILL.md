---
name: pinpoint-pr-workflow
description: The PR-lifecycle decisions the scripts and gates do not state — which of the two reviewers to spend (you run `agy_review.py` yourself; Tim's `/code-review` is a handoff you cannot launch), why the SHA-pinned marker is the only thing that satisfies the `reviewed` gate, which pushes let you re-attest versus needing a fresh review, the narrow trivial-change exception, why the merge handoff is a script you run rather than a summary you write, the `--pages` screenshot gotchas, and the Dependabot back-to-back lockfile trap. Use when committing, opening a PR, running or interpreting an agy review, handing a branch to Tim for review, attesting a reviewed head, addressing review comments, posting screenshots, handing a PR over to merge, or landing the plane after Tim merges.
---

# PinPoint PR Workflow

End-to-end pipeline from "I have changes" to "merged in main".

## When to use — pick your entry phase

- Uncommitted changes in tree → **Phase 1: Commit**
- Local commits, no PR yet → **Phase 2: PR**
- PR open, CI not yet green-and-clean → **Phase 3: Review**
- `ready-for-review` label applied → **Phase 4: Merge** (human-only handoff — see below)
- Tim has merged the PR → **Phase 5: after the merge**

---

## Phase 1: Commit

Branch rules (never on `main`, never rebase, verify `git branch -vv` tracks your branch) are
AGENTS.md §5 "Branches". Which gate to run before committing is AGENTS.md §2.2 "Process rules"
and the §5 key-commands table; which tests to run is AGENTS.md §5 "Which tests to run" —
canonical, don't duplicate here.

### Commit message

Conventional commits: `<type>(<scope>): <description>`. Nothing enforces this — there is no
commit-msg hook and no commitlint, so it rests on you.

Types: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `style`.

PinPoint scopes: `issues`, `machines`, `auth`, `ui`, `db`, `e2e`, `agents`, `workflow`, `hooks`, `forms`, `notifications`, etc. — use the most-affected area.

---

## Phase 2: PR

Prefer MCP `create_pull_request` for typed argument handling, or `gh pr create` if you're
already in a shell. Open **ready-for-review, not draft** (AGENTS.md §6).

### PR description template

```
## Summary

- [1-3 bullets summarizing what changed and why]

## Test Plan

- [ ] [bulleted markdown checklist of TODOs for testing the PR]

## Related Issues

Closes #N (if applicable)
```

---

## Phase 3: Review (CI + review + label)

### 3.1 Watch CI

`./scripts/workflow/pr-watch.py <PR>`, via the Monitor tool. Exit 0 = all passed. Exit 1 =
failure — read `tmp/gh-monitor/failure-<RUN_ID>.md`.

If you judge the failure to be a GitHub Actions **infra** flake (network timeout, runner loss, download 5xx, Supabase container-start) rather than a real code/test failure, log it before rerunning: `bash scripts/workflow/log-gha-flake.sh <pr> <run-id> <class> "<symptom>"` (see `docs/runbooks/gha-flake-log.md`).

### 3.2 Check for review comments

Read threads via `mcp__github__pull_request_read(method: "get_review_comments", owner, repo, pullNumber, perPage: 100)`. Each thread carries `is_resolved` (snake_case), `is_outdated`, and a `PRRT_kwDOxxx` node ID for resolving.

### 3.3 Address review comments

Fixing, declining with a one-sentence signed reply, and resolving the thread is AGENTS.md §5 "Review comments"; the rubric is `REVIEW.md`.

Every unresolved thread counts, whoever opened it — the `threads` gate is author-agnostic. Resolve or decline each one before moving on.

### 3.4 Get the head commit reviewed — run `agy_review.py`, or hand off to Tim

**A PR cannot merge without a review covering the HEAD commit,** with all its threads resolved. Review is mandatory, not on-demand, not discretionary.

There are **two** reviewers, and either one's marker satisfies the gate:

- **`agy` (Antigravity CLI, Gemini)** — the routine path. You dispatch it yourself; it costs Tim nothing. Use it by default.
- **Tim running `/code-review`** — a Claude Code harness built-in you cannot launch. A handoff, and therefore expensive. Reserve it for changes where the cost of a miss is high.

Copilot was retired on 2026-08-02 (PP-4ric) — its free tier was too small. Nothing reviews on PR-open or on push; a review happens because you asked for one.

#### The routine path

```bash
./scripts/workflow/agy_review.py <PR>          # gemini-3.6-flash-high
./scripts/workflow/agy_review.py <PR> --pro    # gemini-3.1-pro-high, for denser changes
```

It checks out the PR head into a throwaway worktree, hands agy the diff, posts the findings as inline review comments, and writes the SHA-pinned marker `<!-- pinpoint-agy-review: <head_sha> -->`. Add `--dry-run` to see what it would post without posting.

**It refuses to write the marker unless agy demonstrably read the diff.** agy confabulates when a read fails — it will emit a confident review of an unrelated PR with zero findings — so the script makes it echo back facts about the diff and hard-fails on a mismatch. If it exits non-zero, nothing was posted and nothing was attested; read the error rather than retrying blindly.

The marker records a depth of `agy-flash` or `agy-pro`, never a `/code-review` level, so the handoff report reads "agy automated review, flash tier (no /code-review run)". Nothing in the record can be mistaken for a depth Tim ran.

**Then close out every thread it opened** (3.3). Each one gets a fix or a one-sentence decline signed `—Claude`, then resolve it. The `threads` gate counts unresolved threads from any author, so this is enforced, not trusted.

#### When to hand off to Tim instead

agy is roughly a low-effort pass. Measured against six planted `CORE-*` violations it caught all six, but it is a smaller model reading a diff — it is not equivalent to `/code-review`. Ask Tim when:

- the change touches auth, permissions, migrations, or money-like invariants;
- it is large or architectural enough that a per-line pass misses the point;
- agy returned no findings and that surprises you.

The handoff: finish **all** the work first — implementation, CI fixes, merge-from-main — then stop iterating and tell him the branch is ready. Every push invalidates the review he is about to give you. Address the findings, then attest the head he read. **A review that found nothing worth fixing skips straight to attesting** — there is no push, so head is already the SHA he read.

**Posting the marker is yours, always, and it is the only thing that satisfies the gate.** A clean review with an unposted marker reads to `merge-pr.sh` as `unreviewed`, so the review Tim ran buys nothing until you post it — and a review that found nothing is exactly the case agents stall on, because there is nothing to fix and nothing to push.

```bash
bash scripts/workflow/mark-claude-review.sh <PR> <depth> "<one-line findings summary>"
```

`<depth>` is the level Tim actually ran — `low | medium | high | xhigh | max | ultra` (or `trivial`, below). It is required and has no default: "a review happened" and "a `/code-review low` happened" are different facts, and the merge handoff report states which one. If you don't know which he ran, ask — guessing here writes a false claim into the record that reads exactly like a true one. (`agy_review.py` records its own tier, so you never pass a depth to it.)

**Finish your churn before either reviewer.** For agy it avoids a pointless second run; for Tim it avoids spending the more expensive resource on a tree you're about to change.

#### Pushing after the review

**The marker pins a SHA, so any push invalidates it** — the gate flips to `stale_marker` and says so. That's deliberate: a 3-commit fixup must not inherit the review of the commit before it.

**If agy reviewed it, just run it again.** A re-run is cheap and costs nobody's attention, so there is no judgement call to make — re-review the new head and let it re-write the marker.

**If Tim reviewed it,** which of two things you do next depends on what you pushed:

- **The fixes he asked for.** Re-attest at the new head and say so in the summary — `"applied review findings from <old_sha>"`. A reviewer's own requested changes are within what they reviewed; this is the same round-trip any human review has.
- **Anything else** — new work, a refactor you thought of, a scope addition. That needs a fresh review. Re-attesting over it is a false attestation. Running agy over the new head is a legitimate way to clear it without interrupting him again, provided the new work is within agy's competence (see "When to hand off to Tim instead").

If you're unsure which bucket you're in, ask. The cost of asking is one message; the cost of guessing wrong is merging something nobody read.

#### The trivial-change exception

A genuinely trivial change — a typo, a comment, a one-line mechanical fix — doesn't need a reviewer at all. Attest it yourself and **say why it was trivial** in the marker summary, so the judgement is on the record and reviewable:

```bash
bash scripts/workflow/mark-claude-review.sh <PR> trivial "typo in a comment; no behavior change"
```

`trivial` is the depth for this case, and along with the `agy-*` tiers it is one of the depths that does not name a `/code-review` level — the report then says "attested trivial (no /code-review run)" rather than implying a review happened.

This is a narrow exception and it is self-policing. "It's only a small change" is not the test — the test is whether there is any way for it to be wrong. If you're reaching for a justification, it isn't trivial — and since agy costs you one command, reaching for this exception to save effort is the wrong trade.

**The marker attests that a review actually happened.** Posting it otherwise is a false attestation, not a shortcut — the same honesty model as `merge-pr.sh --force`.

#### Readiness is not review

`pr-watch.py --check-ready` reports review state but does **not** gate on it. That check answers "is this PR worth reviewing right now?", and the review is what happens after that answer is yes — gating on it would be circular. Check-ready green means "review it", not "will merge".

Don't tell Tim a PR is "ready" or "done" while head is unreviewed — say it's ready for his `/code-review`, which is a different claim.

### 3.5 Post UI screenshots (UI-touching PRs only)

If the diff touches `src/app/**`, `src/components/**`, any `.css`, or design tokens, screenshots must be posted before the PR can be called ready — Tim reviews UI by eye, not by reading a diff. The commit-time `ui-screenshot-reminder.cjs` PostToolUse hook nudges on the first `git commit` that touches a UI glob; don't ignore it.

```
node scripts/workflow/pr-screenshots.mjs <PR>
```

Shoots the manifest in `scripts/workflow/ui-screenshot-manifest.json` (issues list, issue detail, report form, dashboard, a machine detail, collections — pass `--pages=a,b,c` to shoot a subset) at desktop (1440×900) and mobile (390×844) viewports, pushes the PNGs to the orphan `pr-screenshots` branch, and posts/updates one sticky PR comment (marker `<!-- pr-screenshots -->`) with a desktop|mobile table per page. Re-run after any UI-affecting push — it updates the same sticky comment in place, tagged with the new head SHA.

Two `--pages` gotchas: it only accepts the **equals** form (`--pages=machine-edit`); the space-separated form fails with `Unrecognized argument`. And a filtered run rebuilds the sticky comment from just the pages it shot, silently dropping the others — so always finish with an unfiltered run before handing the PR off.

Requires the local dev server (`pnpm run dev`) and Supabase (`supabase start`) running. First run (or a stale/missing login session) regenerates `e2e/.auth/*.json` via the `auth-setup` Playwright project, which resets + reseeds the local dev DB — same as running E2E tests locally, not a new risk.

### 3.6 Apply `ready-for-review` label

Once CI green + a review marker pinning head (per 3.4) + zero unresolved review threads + no merge conflict + screenshots posted (if UI-touching, per 3.5), apply the label via `mcp__github__issue_write(method: "update", …)` or `gh pr edit <PR> --add-label ready-for-review`.

The label is a hint to Tim that the PR is ready for **him** to merge — it does not authorize an agent to merge. `merge-pr.sh --human` re-checks all gates when Tim runs it.

**The label does not get the PR reviewed.** Applying it on a PR whose head is past its last review — or that was never reviewed at all — just moves the failure to merge time.

---

## Phase 4: Merge — human-only (PP-wi85)

**Merging is human-only, via ANY path.** Direct `gh pr merge`, MCP `merge_pull_request`, AND `scripts/workflow/merge-pr.sh` itself are ALL blocked for an agent by the `block-direct-merge.cjs` PreToolUse hook — including `merge-pr.sh --dry-run`. There is no agent-usable bypass; the old `.claude-merge-bypass` sentinel was removed entirely. If you want to sanity-check gate-relevant PR state without running the script, read it via MCP (`pull_request_read`) instead — you cannot invoke `merge-pr.sh` at all, not even to preview.

### 4.1 Agent's terminal state: handoff, not merge

Once 3.1–3.6 are satisfied (CI green, a review whose `commit_id` matches head per 3.4, threads resolved, no conflict, screenshots posted if UI-touching), your job on this PR is done. Hand it over by **running the handoff report and pasting its output** — do not write the summary yourself:

```bash
bash scripts/workflow/merge-handoff.sh <PR>
```

It prints what Tim needs to decide whether to merge — which `/code-review` ran and whether it covers head, how many commits landed since, CI, threads, mergeable + how far behind main, when main was last merged in, the diff split into src / tests / docs / other, migrations, newly-registered env vars, UI + screenshots — and ends with two `!`-prefixed commands: one to re-run the report, one to merge.

**Why a script and not a format you fill in.** Every line of it is a fact you would otherwise be recalling: how many commits back the review was, what the line counts are, whether main has been merged in. Those are exactly the claims that drift, and Tim acts on them. `git` and `gh` already know all of it. Paste the block; add prose only for what the block cannot know (why a finding was declined, what to watch on deploy).

**The re-run line is part of the report, not decoration.** The block is a snapshot and is stale as soon as CI re-runs or anyone pushes. Tim re-runs it himself rather than asking you to re-check.

**The merge command only appears when all four gates actually pass.** An un-ready PR gets the blocking reasons instead — so don't hand over a merge command the report didn't print. If CI is still running, the report says so; hand him the automerge form, which waits rather than making him come back. Get the head reviewed first (Phase 3.4); automerge waits out CI, not an unreviewed head — and a review you never requested never arrives, so it would just burn the timeout:

```
! scripts/workflow/merge-pr.sh <PR> --human --automerge
```

Never say "ready to push when you are" — you push. Never say a PR is "merged" or that you merged it — only Tim runs the merge; say "ready for Tim to merge" and give him the command. (A `!`-prefixed command in Claude Code is a human-typed shell passthrough — it does not generate a PreToolUse event, so it is the only channel this hook cannot see. That is by design: it is the human channel.)

### 4.2 Escape hatches (Tim decides; you can inform, not invoke)

`merge-pr.sh` evaluates **4 gates**: `ci`, `threads`, `reviewed`, `no_conflict`. `--force` bypasses the review-state pair (`threads` + `reviewed`); `--bypass-merge-requirements` bypasses `ci` and passes `--admin`. Both require manual permission approval — treat the approval prompt as an "are you sure?" checkpoint. The `no_conflict` gate is NEVER bypassable; GitHub rejects conflicting merges regardless of `--admin`.

**On any FAIL the script removes the `ready-for-review` label if present** (and likewise on the `--automerge` RED path). The label's contract is "click-merge-without-thinking"; if a gate fails at merge time that contract is broken, so the label goes. Practical consequence: after Tim reports a FAIL, fix the underlying issue, push, and **re-apply the label** (3.6) before re-handing him the `--human` command — don't assume it survived.

**A `reviewed` FAIL is almost never a `--force` case.** `unreviewed` means nobody has reviewed it and `stale_marker` means you pushed past the review that happened — both describe an unfinished PR, not a broken gate. Take the honest path in 3.4 and hand off a PR whose marker pins head.

`--bypass-merge-requirements` is for a required check failing for known-irrelevant reasons (infrastructure flake, unrelated job) where the change has been manually verified safe — log the flake first with `bash scripts/workflow/log-gha-flake.sh <pr> <run-id> <class> "<symptom>"` (see `docs/runbooks/gha-flake-log.md`) — or an emergency hotfix where waiting for CI is not acceptable. Do NOT suggest bypassing when a merge conflict exists, or when the underlying state hasn't been manually verified.

### 4.3 If `merge-pr.sh` itself is broken

There is no hook bypass — that channel was removed entirely (PP-wi85). If a hotfix genuinely can't wait for the script to be fixed, that's Tim's call, made in his own shell (`gh pr merge <PR> --squash` run by him directly, or a fixed `--human` run). Document why in the merge commit or a follow-up comment. An agent should not look for a workaround here — flag the breakage and let Tim decide.

### 4.4 Dependabot PRs: rebase before merging back-to-back

When two or more Dependabot PRs that both touch `pnpm-lock.yaml` (or any lockfile) are open simultaneously, merging them in succession without rebasing the second-and-later PRs can silently break the lockfile.

**The trap:** each Dependabot PR's lockfile diff adds entries in slightly different alphabetical zones based on its own snapshot of main. After the first PR merges, git's textual three-way merge of the second PR doesn't see a conflict because the additions live in non-overlapping line ranges — but both PRs may add the _same_ transitive dep (e.g., `brace-expansion@5.0.6`). The squash-merge produces a lockfile with a duplicated mapping key, which `pnpm install --frozen-lockfile` rejects with `ERR_PNPM_BROKEN_LOCKFILE`. Every new PR's `Setup Dependencies` then fails until main is fixed.

**Why `rebase-strategy: auto` in `.github/dependabot.yml` doesn't save you:** "auto" means Dependabot rebases when _the dependency version_ is out of date, not when _the lockfile region_ has shifted under it. Two independent Dependabot PRs against the same main can both stay "current" by Dependabot's definition while their lockfile diffs collide on merge.

**Rule:** when merging the first of two or more Dependabot PRs that both touch a lockfile, comment `@dependabot rebase` on each remaining Dependabot PR before merging it. Dependabot regenerates the lockfile against post-first-merge main and the duplicate is deduped automatically. Wait for the rebased CI to pass before handing Tim the `--human` command for the second PR.

**Casework:** 2026-05-19 — PRs #1379 and #1381 each added `brace-expansion@5.0.6:` to `packages:` independently. Both merged within ~1 minute. Main's `Setup Dependencies` broke until a manual dedup of `pnpm-lock.yaml` was bundled into PR #1383 alongside that PR's primary E2E locator fix.

**Quick triage check before merging the second of two open Dependabot PRs:**

```bash
# How many commits is the PR's branch behind origin/main?
# behind_by > 0 means the PR's lockfile snapshot predates current main.
pr_branch=$(gh pr view <second_pr> --json headRefName --jq .headRefName)
gh api "repos/{owner}/{repo}/compare/main...$pr_branch" --jq '.behind_by'
```

If `behind_by > 0`, comment `@dependabot rebase` on the PR and wait for the rebased CI to pass before handing Tim the `--human` command. Do not use `gh pr view --json baseRefOid` for this — `baseRefOid` is the base branch's current SHA at query time, so it always equals `origin/main` and cannot detect a stale PR head.

---

## Phase 5: after the merge

Work isn't done at "git push" — it's done when the change is **merged, deployed clean, and cleaned up**.

### 5.1 Watch the deployment — only if the PR could break it

After Tim merges, consider watching the deployment — only if the PR could break it. A merge that breaks prod isn't done, so when the change actually reaches the deployed app, it's worth watching the production deploy land and confirming no build, migration, or runtime errors. That means: anything under `src/`, a migration, a dependency or `next.config.ts` change, an env-registry change, or anything on the `vercel-build` path. **Skip it otherwise** — docs, skills, beads, GitHub workflows, and dev-only scripts can't affect the deploy, and watching a run that was never at risk just burns time. This is a judgement call, not a mandate; if you're not present when Tim merges, it's his to do or to ask you to pick back up.

### 5.2 Cleanup — non-destructive now, destructive on confirmation

Close the bead, file genuine follow-up beads, and hand off freely. For destructive cleanup (removing worktrees, deleting branches/volumes), wait for explicit confirmation.

### 5.3 Hand off

Hand off for the next session, and post to the huddle daily bead if other sessions need to know what landed.

---

## MCP gotchas reference

- **snake_case fields**: responses use `is_resolved`, `submitted_at`, `head.sha`, `commit.committer.date`. Not camelCase.
- **Pagination**: cap `perPage` to 100 on list methods. Use cursor pagination via `after` for GraphQL.
- **Labels are full-replacement**: `issue_write(method: "update", labels: [...])` REPLACES the entire label set. Read current first.
- **`resolve_thread` ignores owner/repo/pullNumber**: only `threadId` matters, but the schema requires the others.
- **Thread IDs**: `PRRT_kwDOxxx` format from `get_review_comments` output.

## Cross-reference

- Status tokens (`PASS`/`FAIL`/`WAIT`/`WARN`/`BLOCK`) and what to do for each: `scripts/workflow/AGENTS.md`
- Spec: `docs/superpowers/specs/2026-05-16-pinpoint-pr-workflow-consolidation-design.md`
- Subagent dispatch rules (dispatch from the main worktree): `pinpoint-orchestrator` skill
