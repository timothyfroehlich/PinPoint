---
name: pinpoint-pr-workflow
description: Full PR lifecycle for PinPoint — commit, push, CI monitoring, getting the head commit reviewed (run agy_review.py yourself, or hand off to Tim's /code-review; either writes a SHA-pinned marker), review handling, UI screenshots, readiness labeling, human-only gate-enforced merge handoff, and post-merge deploy-watch/cleanup/handoff. Use when committing changes, opening PRs, watching CI, running or interpreting an agy review, handing a PR to Tim for review, attesting a reviewed head, addressing review comments, posting screenshots, handing a PR to Tim to merge, or landing the plane after Tim merges (watching the deploy, cleanup, handoff).
---

# PinPoint PR Workflow

End-to-end pipeline from "I have changes" to "merged in main". Replaces the deprecated pinpoint-commit, pinpoint-ready-to-review, and pinpoint-github-monitor skills.

## When to use — pick your entry phase

- Uncommitted changes in tree → **Phase 1: Commit**
- Local commits, no PR yet → **Phase 2: PR**
- PR open, CI not yet green-and-clean → **Phase 3: Review**
- `ready-for-review` label applied → **Phase 4: Merge** (human-only handoff — see below)
- Tim has merged the PR → **Phase 5: after the merge** (deploy-watch, cleanup, handoff)

---

## Phase 1: Commit

### 1.1 Branch validation

- Verify NOT on main: `git rev-parse --abbrev-ref HEAD` ≠ `main`.
- Verify branch follows naming convention: `feature/*`, `fix/*`, `chore/*`, `docs/*`, `test/*`, `refactor/*`.
- Verify based on current main: `git merge-base HEAD origin/main` is recent.
- Verify NO `git rebase origin/main` ever — AGENTS.md §5 "Branches" (use `git merge origin/main` instead).

### 1.2 Pre-commit validation

Default to `pnpm run check` (~9s; covers type, lint, format, yamllint, actionlint, ruff, shellcheck). Python hook/script tests are **not** in it — run `pnpm run check:python` if you touched `scripts/` or `.claude/hooks/`. It is **static-only — no unit tests** since PP-4zcj, so run `pnpm run test` too when you changed logic. Use `pnpm run preflight` (full + unit + integration) before commit for non-trivial changes, especially: migrations, security/auth changes, server actions, middleware.

### 1.3 E2E selection

Use this matrix based on `git diff --name-only --staged`. The full suite (`e2e:full` / `e2e:all`) is CI's job by default — roughly 8–10 minutes of three parallel Chromium workers plus a Supabase stack and a Next server. **On a resource-constrained system (a 16 GB laptop, especially with several agent sessions running), don't run it locally** — push and let CI do it; on a machine with real headroom it's a reasonable thing to run when you actually want the signal. Locally, run only targeted specs (`pnpm exec playwright test <spec> --project=chromium`) while writing them or iterating on a feature they touch.

| Changed file patterns                                                                                | Recommended local check                                                        |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `src/app/**/page.tsx`, `src/app/**/layout.tsx`, `src/app/(auth)/**`                                  | Targeted spec(s) for the affected flow while iterating; CI runs the full suite |
| `src/components/issues/*`, `src/components/machines/*`, `src/server/actions/*`, `src/lib/supabase/*` | Targeted spec(s) while iterating; CI runs the full suite                       |
| `supabase/migrations/*`, `src/server/db/schema.ts`                                                   | `pnpm run preflight` (includes smoke E2E)                                      |
| `src/components/ui/*`, `src/lib/*` (non-supabase)                                                    | `pnpm run smoke` (~60s; already in preflight)                                  |
| `docs/**`, `*.test.ts`, `*.spec.ts`, `.agents/**`, `scripts/*`                                       | skip additional E2E                                                            |

### 1.4 Commit message

Conventional commits: `<type>(<scope>): <description>`.

Types: `feat`, `fix`, `refactor`, `chore`, `docs`, `test`, `style`.

PinPoint scopes: `issues`, `machines`, `auth`, `ui`, `db`, `e2e`, `agents`, `workflow`, `hooks`, `forms`, `notifications`, etc. — use the most-affected area.

### 1.5 Push

If branch has no upstream: `git push -u origin <branch-name>`. Else: `git push`.

Verify upstream tracks the branch itself, NOT main: `git branch -vv` should show `[origin/<your-branch>]`. After pushing, `git status` must show "up to date with origin" — if it doesn't, the push didn't land cleanly (e.g. a fetch is needed, or the remote moved); resolve before continuing.

---

## Phase 2: PR

### 2.1 Open the PR

Prefer MCP `create_pull_request` for typed argument handling. Or use `gh pr create` if you're already in a shell context.

MCP example:

- Tool: `mcp__github__create_pull_request`
- Args: `owner: "timothyfroehlich"`, `repo: "PinPoint"`, `title: "<title>"`, `body: "<description>"`, `head: "<branch>"`, `base: "main"`, `draft: false` (ready-for-review by default — see 2.3)

### 2.2 PR description template

```
## Summary

- [1-3 bullets summarizing what changed and why]

## Test Plan

- [ ] [bulleted markdown checklist of TODOs for testing the PR]

## Related Issues

Closes #N (if applicable)
```

### 2.3 Draft vs ready

**Default: open ready-for-review, not draft** — CI runs the same on drafts, so draft gates nothing. Use draft ONLY while you're still iterating, when you want title/description feedback first, or when you've said you're pausing mid-task. Don't reflexively open as draft.

---

## Phase 3: Review (CI + review + label)

### 3.1 Watch CI

Use Monitor tool with `pr-watch.py`:

```
Monitor(
command: "./scripts/workflow/pr-watch.py <PR>",
description: "CI watch for PR #<PR>",
persistent: false,
timeout_ms: 3600000
)
```

Exit 0 = all passed. Exit 1 = failure — read `tmp/gh-monitor/failure-<RUN_ID>.md`.

If you judge the failure to be a GitHub Actions **infra** flake (network timeout, runner loss, download 5xx, Supabase container-start) rather than a real code/test failure, log it before rerunning: `bash scripts/workflow/log-gha-flake.sh <pr> <run-id> <class> "<symptom>"` (see `docs/runbooks/gha-flake-log.md`).

### 3.2 Check for review comments

If the PR has review comments (from Tim or another agent), read them via MCP:

```
mcp__github__pull_request_read(
method: "get_review_comments",
owner: "timothyfroehlich",
repo: "PinPoint",
pullNumber: <PR>,
perPage: 100
)
```

Returns array of review threads. Each thread has:

- `is_resolved` (snake_case! not camelCase)
- `is_outdated`
- `comments[]` with `path`, `line`, `body`, `author.login`, `html_url`, and crucially a thread node ID for resolving

### 3.3 Address review comments

For each unresolved thread, evaluate critically. Not all suggestions warrant code changes.

**To fix**: edit code, commit, push, then resolve the thread.

**To decline**: post a one-sentence justification reply AND resolve the thread:

1. Reply:

```
mcp__github__add_reply_to_pull_request_comment(
owner: "timothyfroehlich",
repo: "PinPoint",
pullNumber: <PR>,
commentId: <commentId from thread>,
body: "Ignored: <one-sentence justification>. —Claude-<YourName>"
)
```

2. Resolve:

```
mcp__github__pull_request_review_write(
method: "resolve_thread",
threadId: <PRRT_kwDOxxx from thread>,
owner: "timothyfroehlich",
repo: "PinPoint",
pullNumber: <PR>
)
```

(Owner/repo/pullNumber not actually used for resolve_thread but tool requires them per schema.)

Sign replies with your agent name (`—Claude-Plunger`, `—Claude-Spinner`, etc.).

Every unresolved thread counts, whoever opened it — the `threads` gate is author-agnostic. Resolve or decline each one (per 3.3) before moving on.

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

The handoff: finish **all** the work first — implementation, CI fixes, merge-from-main — then stop iterating and tell him the branch is ready. Every push invalidates the review he is about to give you. Address the findings, then attest the head he read:

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

#### What the gates check

`merge-pr.sh` enforces this at merge time via the `reviewed` gate: PASS on `marker` (**either** marker pinning head — the gate does not care which reviewer produced it), FAIL on `stale_marker` (a marker pinning an older commit) and `unreviewed` (no marker at all). Nothing WAITs — no reviewer runs unprompted, so there is never an answer already on its way and a WAIT would just poll until it timed out.

`pr-watch.py --check-ready` reports the same state but does **not** gate on it. That check answers "is this PR worth reviewing right now?", and the review is what happens after that answer is yes — gating on it would be circular. Check-ready green means "review it", not "will merge".

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

Once CI green + a review marker pinning head (per 3.4) + zero unresolved review threads + no merge conflict + screenshots posted (if UI-touching, per 3.5):

1. Read current labels via `pull_request_read(method: "get")` and extract `.labels[]`.
2. Build new labels array: existing labels + `"ready-for-review"`.
3. Apply:

```
mcp__github__issue_write(
method: "update",
owner: "timothyfroehlich",
repo: "PinPoint",
issue_number: <PR>,
labels: [<existing>, "ready-for-review"]
)
```

NOTE: PR labels are added via the issues endpoint. `labels` parameter is full-replacement, so read current labels first to avoid clobbering.

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

### 4.2 What `merge-pr.sh --human` does (reference — Tim runs this, not you)

```
scripts/workflow/merge-pr.sh <PR> --human [-a|--automerge] [--dry-run] [--force] [--bypass-merge-requirements]
```

`--human` is required to actually merge; omitting it makes the script refuse with a `REFUSE:` message (defense-in-depth for harnesses without the Claude Code hook — Codex/Gemini/Antigravity). `--dry-run` doesn't require `--human` in the script itself, but that exemption only matters outside Claude Code — inside Claude Code the hook blocks the Bash call before the script even runs, dry-run or not.

Other flags (stackable, order-independent):

- `-a` / `--automerge` — poll the gates instead of evaluating once, and merge the moment they all pass. Fire it while CI is still running; that's the point. It does **not** wait out an unreviewed head — `reviewed` never WAITs, so an unattested head hard-fails on the first poll and ends the run. Get head reviewed and attested first (3.4). Ends in exactly one of three states, each named on exit: `MERGED`, `RED` (a gate hard-failed — no merge, `ready-for-review` dropped), or `TIMED OUT` (still waiting when the budget expired — PR untouched, label intact, exit code 2). A WAIT keeps it polling; only a hard failure stops it. `AUTOMERGE_TIMEOUT` (default 3600s) and `AUTOMERGE_POLL_INTERVAL` (default 30s) tune it. Mutually exclusive with `--dry-run`. Prints the gate block on the first poll and again whenever the picture changes, so a long wait stays readable.
- `--force` — bypass `threads` + `reviewed` (review-state) gates. Requires manual permission approval.
- `--bypass-merge-requirements` — bypass `ci` gate AND pass `--admin` to `gh pr merge`,
  overriding GitHub branch-protection rules. Requires manual permission approval.

Combine `--force --bypass-merge-requirements` to bypass `threads` + `reviewed` + `ci` together.
The `no_conflict` gate is NEVER bypassable — GitHub rejects conflicting merges regardless of `--admin`.

`merge-pr.sh` evaluates **4 gates**: `ci`, `threads`, `reviewed`, `no_conflict`. The `reviewed` gate is the hard backstop that no head commit merges unreviewed — satisfy it honestly before handoff (Phase 3.4) rather than telling Tim to `--force` past it.

### 4.3 Interpret output (for reading over Tim's shoulder / diagnosing a FAIL he reports)

Script emits structured status tokens:

| Token                    | Meaning                                                | What to do                            |
| ------------------------ | ------------------------------------------------------ | ------------------------------------- |
| `PASS: <gate>: <state>`  | Gate passed                                            | Continue                              |
| `FAIL: <gate>: <state>`  | Gate failed                                            | Fix underlying issue, push, retry     |
| `WAIT: <gate>: <state>`  | Transient (e.g., GitHub computing mergeable)           | Retry merge-pr.sh after a few seconds |
| `BLOCK: <gate>: <state>` | State mismatch requiring action (e.g., merge conflict) | Resolve, push, retry                  |
| `WARN: <gate>: <state>`  | Permitted to proceed with notice                       | Continue, but be informed             |
| `SKIP: <gate>: <reason>` | Gate doesn't apply                                     | Continue                              |

On any FAIL: script removes `ready-for-review` label if present (the label's contract is "click-merge-without-thinking"; if a gate fails at merge time, that contract is broken). Exit 1. If Tim reports a FAIL, fix the underlying issue and push — then re-hand him the same `--human` command.

On all PASS: script captures head SHA, calls `gh pr merge <PR> --squash --match-head-commit=<sha>`. TOCTOU-safe — if a new commit lands between gate check and merge, GitHub rejects the merge (`--match-head-commit` mismatch). Branch deletion is handled by the repo's auto-delete-branches setting, not by the merge command — passing `--delete-branch` from a worktree fails local cleanup because main is held by the root checkout.

### 4.4 Escape hatches (Tim decides; you can inform, not invoke)

**`--force`** — for review-state issues (bypasses `threads` + `reviewed`):

- API failure on the `threads` or `reviewed` gate where the underlying state has been manually verified fine
- The `threads` / `reviewed` gates are known to fail and that's being explicitly accepted

**A `reviewed` FAIL is almost never a `--force` case.** `unreviewed` means nobody has reviewed it and `stale_marker` means you pushed past the review that happened — both describe an unfinished PR, not a broken gate. Take the honest path in 3.4 and hand off a PR whose marker pins head.

**`--bypass-merge-requirements`** — for CI/branch-protection issues:

- A required check is failing for known-irrelevant reasons (infrastructure flake, unrelated job)
  AND the change has been manually verified safe. Log the flake first:
  `bash scripts/workflow/log-gha-flake.sh <pr> <run-id> <class> "<symptom>"` (see `docs/runbooks/gha-flake-log.md`).
- An emergency hotfix where waiting for CI is not acceptable
- Combine with `--force` when both review-state and CI gates need to be skipped

Do NOT suggest bypassing when:

- Merge conflict exists (`no_conflict` gate is never bypassable; conflicts can't be ignored)
- The underlying state hasn't been manually verified. Both flags require manual permission approval
  in the chat — treat the approval prompt as a "are you sure?" checkpoint.

### 4.5 If `merge-pr.sh` itself is broken

There is no hook bypass — that channel was removed entirely (PP-wi85). If a hotfix genuinely can't wait for the script to be fixed, that's Tim's call, made in his own shell (`gh pr merge <PR> --squash` run by him directly, or a fixed `--human` run). Document why in the merge commit or a follow-up comment. An agent should not look for a workaround here — flag the breakage and let Tim decide.

### 4.6 Dependabot PRs: rebase before merging back-to-back

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

## Status token reference

Same as in `scripts/workflow/AGENTS.md` and emitted by `merge-pr.sh`, `pr-watch.py`, and `_pr-gates.sh`.

## Cross-reference

- Spec: `docs/superpowers/specs/2026-05-16-pinpoint-pr-workflow-consolidation-design.md`
- Workflow scripts reference: `scripts/workflow/AGENTS.md`
- Subagent dispatch rules (N=1 strict, dispatch from main worktree): see `pinpoint-orchestrator` skill
