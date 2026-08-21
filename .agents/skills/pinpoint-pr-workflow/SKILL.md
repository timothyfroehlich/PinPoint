---
name: pinpoint-pr-workflow
description: The PR-lifecycle decisions the scripts and gates do not state — why getting reviewed is a handoff (Claude Code runs `/codex:review --base main`) and why the SHA-pinned marker you post is the only thing that satisfies the `reviewed` gate, which pushes let you re-attest versus needing a fresh review, the narrow trivial-change exception, why the merge handoff is a script you run rather than a summary you write, the `--pages` screenshot gotchas, and the Dependabot back-to-back lockfile trap. Also the merge escape hatches (`--force`, `--bypass-merge-requirements`) and when each is and is not appropriate, what to do when `merge-pr.sh` itself is broken, and the GitHub MCP gotchas that silently do the wrong thing — snake_case field names, the pagination cap, label writes replacing the whole set rather than adding to it, `resolve_thread` ignoring owner/repo, and the thread-ID format. Use when committing, opening a PR, handing a branch to Claude Code for review, attesting a reviewed head, addressing review comments, posting screenshots, handing a PR over to merge, landing the plane after Tim merges, or when a GitHub MCP call does something you did not expect.
---

# PinPoint PR Workflow

End-to-end pipeline from "I have changes" to "merged in main".

## When to use — pick your entry phase

- Uncommitted changes in tree → **Phase 1: Commit**
- Local commits, no PR yet → **Phase 2: PR**
- PR open, CI not yet green-and-clean → **Phase 3: Review**
- `ready-for-review` label applied → **Phase 4: Merge** (Tim's decision — hand off, or run the script and let him approve the prompt; see below)
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

### 3.4 Get the head commit reviewed — Claude Code runs Codex, you attest

**The merge bar has not moved: a PR cannot merge without a review covering the HEAD commit,** with all its threads resolved. Review is mandatory, not on-demand, not discretionary.

**What changed on 2026-08-02 (PP-4ric) is who does it.** The bot reviewer this repo used was retired — its free tier was too small to review PinPoint's PRs, so quota outages were the normal state rather than the exception. No bot reviews this repo now, and there is nothing to request: a PR carries no pending reviewer, and any doc or habit that has you adding one is stale.

The primary reviewer is **Codex, invoked by Claude Code with `/codex:review --base main`**. Claude is allowed to run that command itself, so the handoff is to Claude Code rather than to Tim. The command starts a real review; it does not make the marker true by itself. Read `/codex:result`, address every finding, then attest only the SHA Codex actually reviewed.

#### Sequencing

1. Open the PR whenever you like and watch CI. Nothing is reviewing yet, so an early PR costs nothing.
2. Finish **all** the work: the implementation, the CI fixes, the merge-from-main. Stop iterating.
3. Have Claude Code run `/codex:review --base main --background` on the branch, then retrieve `/codex:result`. This is a real stop — don't fill the time with more commits, because every push invalidates the review it is about to give you.
4. Address the findings: fix → push → and note that head has moved (see below). Consciously decline the rest, with a reason. **A review that found nothing worth fixing skips straight to step 5** — there is no push, so head is already the SHA he read.
5. Attest the head he reviewed — **this step is yours, always, and it is the only thing that satisfies the gate.** A clean review with an unposted marker reads to `merge-pr.sh` as `unreviewed`, so the review Tim ran buys nothing until you post it:

   ```bash
   bash scripts/workflow/mark-review.sh <PR> codex-plugin-cc base-main "<one-line findings summary>"
   ```

   That posts the sticky SHA-pinned marker `<!-- pinpoint-review: <head_sha> -->` that the `reviewed` gate detects.

   `codex-plugin-cc base-main` is the exact attestation for `/codex:review --base main`. Do not substitute a custom focus, a different base, or a result from before the final push. The marker records the review method as well as the SHA, so the merge handoff can state what actually ran.

6. Then 3.5 / 3.6.

**Finish your churn before you ask.** This mattered under the bot reviewer because a review cost quota; it matters more now because it costs Tim's attention. Asking for a review of a tree you're about to change wastes the more expensive resource.

#### Pushing after the review

**The marker pins a SHA, so any push invalidates it** — the gate flips to `stale_marker` and says so. That's deliberate: a 3-commit fixup must not inherit the review of the commit before it.

Which of two things you do next depends on what you pushed:

- **The fixes Codex asked for.** Re-run `/codex:review --base main` at the new head, then attest and say so in the summary. A new review is cheap enough that it preserves an unambiguous SHA-to-result record.
- **Anything else** — new work, a refactor you thought of, a scope addition. That also needs a fresh `/codex:review --base main`. Re-attesting over it is a false attestation.

If you're unsure which bucket you're in, ask. The cost of asking is one message; the cost of guessing wrong is merging something nobody read.

#### The trivial-change exception

A genuinely trivial change — a typo, a comment, a one-line mechanical fix — doesn't need to interrupt Tim. Attest it yourself and **say why it was trivial** in the marker summary, so the judgement is on the record and reviewable:

```bash
bash scripts/workflow/mark-review.sh <PR> claude-code trivial "typo in a comment; no behavior change"
```

`claude-code trivial` is the special record for this case, and it is the only accepted record that does not name a review command — the report then says "attested trivial (no /code-review run)" rather than implying a review happened.

This is a narrow exception and it is self-policing. "It's only a small change" is not the test — the test is whether there is any way for it to be wrong. If you're reaching for a justification, it isn't trivial.

**The marker attests that a review actually happened.** Posting it otherwise is a false attestation, not a shortcut — the same honesty model as `merge-pr.sh --force`.

#### Why the marker command carries a permission allow rule

`.claude/settings.json` has one `permissions.allow` entry, and it is this script:

```json
"allow": ["Bash(bash scripts/workflow/mark-review.sh *)"]
```

It is there because the command was intermittently denied. On 2026-08-03 an auto-mode session was refused with `Blocked by classifier` on PR #1815, while the same command succeeded four times across 2026-08-09/10 (PRs #1832, #1828, #1829, #1848). The block was contextual, not a standing rule — which is the worst shape for a required step, because it fails only sometimes and leaves the PR sitting at `unreviewed` with no path forward. A background subagent has no human to hand the command to at all. Rules are evaluated deny → ask → allow, and an explicit allow resolves the call before the classifier is consulted, so the entry makes the step deterministic. (PP-yx97. A new tool permission needs Tim's explicit approval each time; he gave it on 2026-08-11. This is not a CORE-SEC-010 surface — that rule governs prod-mutating Supabase tools, and its ban on `allow` applies to those.)

**What the rule does not do is make the attestation true.** It removes the harness's opinion about whether you earned the marker, which means your own judgement is now the only thing standing between a false attestation and the merge gate. The honesty model above is not softened by the allow rule; it is the entire remaining check. The merge decision stays Tim's regardless (PP-wi85) — even when an agent runs `merge-pr.sh`, the hook prompts him to approve — so a marker you should not have posted misleads Tim into approving rather than merging anything by itself. That is a smaller failure, not a harmless one: his approval at the prompt is the last backstop, and a false marker is exactly what erodes it.

Two limits worth knowing:

- The rule matches the documented invocation, `bash scripts/workflow/mark-review.sh …`, and only that shape. **Use the relative path** — an absolute one does not match and falls through to the classifier. Don't count on `normalize-workspace-paths.cjs` to rescue it: its rewrite regex is hardcoded to `/home/froeht/Code/…`, so it never fires on this Mac (`/Users/froeht/Code/PinPoint`), and its `pinpoint-worktrees/` alternative predates the current `.claude/worktrees/<branch>/` layout. Chaining (`… && something-else`) does not inherit the allow either — each subcommand is matched on its own.
- A summary string containing an unbalanced quote makes the whole command unresolvable to `block-direct-merge.cjs`, which then scans the raw text and blocks on `merge-pr.sh` or `pr merge`. Rare, and it fails closed. Fix the quoting rather than working around it.

#### Readiness is not review

`pr-watch.py --check-ready` reports review state but does **not** gate on it. That check answers "is this PR worth `/codex:review --base main` right now?", and the review is what happens after that answer is yes — gating on it would be circular. Check-ready green means "review it", not "will merge".

Don't tell Tim a PR is "ready" or "done" while head is unreviewed — say it is ready for `/codex:review --base main`, which is a different claim.

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

## Phase 4: Merge — Tim's decision (PP-wi85)

**The merge decision is Tim's, always.** An agent MAY run the gate-enforced script `bash scripts/workflow/merge-pr.sh <PR> --human`, but the `block-direct-merge.cjs` PreToolUse hook turns that invocation into an **approval prompt** — Tim approves before the merge runs (PP-wi85, reversed for the script only, per Tim 2026-08-19). A hook `ask` decision prompts in **every** permission mode, including bypassPermissions, so a subagent cannot merge silently. The raw channels — `gh pr merge`, `gh api PUT .../merge`, MCP `merge_pull_request` — stay **hard-blocked** for agents, because they skip the script's gate re-checks (CI green, review pins head, threads resolved, no conflict); the old `.claude-merge-bypass` sentinel was removed entirely. To sanity-check gate state without merging, read the PR via MCP (`pull_request_read`), or run `merge-pr.sh <PR> --dry-run` — it also prompts for approval but takes no action.

### 4.1 Agent's terminal state: hand off (the default), or run it and let Tim approve

Once 3.1–3.6 are satisfied (CI green, a review whose `commit_id` matches head per 3.4, threads resolved, no conflict, screenshots posted if UI-touching), your job on this PR is done. The **default and preferred** close is a handoff: **run the handoff report and paste its output** — do not write the summary yourself. (You may instead run `bash scripts/workflow/merge-pr.sh <PR> --human` and let Tim approve the prompt; the handoff report is still the better hand-off because it shows him the state he is approving.)

```bash
bash scripts/workflow/merge-handoff.sh <PR>
```

It prints what Tim needs to decide whether to merge — which review ran and whether it covers head, how many commits landed since, CI, threads, mergeable + how far behind main, when main was last merged in, the diff split into src / tests / docs / other, migrations, newly-registered env vars, UI + screenshots — and ends with two `!`-prefixed commands: one to re-run the report, one to merge.

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

An agent can run `merge-pr.sh` (with Tim's approval at the prompt), but that does not help when the script _itself_ is broken — the raw channels stay hard-blocked, and there is no hook bypass (PP-wi85). If a hotfix genuinely can't wait for the script to be fixed, that's Tim's call, made in his own shell (`gh pr merge <PR> --squash` run by him directly, or a fixed `--human` run). Document why in the merge commit or a follow-up comment. An agent should not look for a workaround here — flag the breakage and let Tim decide.

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
