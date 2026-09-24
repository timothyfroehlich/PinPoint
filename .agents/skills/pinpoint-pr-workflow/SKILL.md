---
name: pinpoint-pr-workflow
description: The PR-lifecycle decisions the scripts and gates do not state — draft-first creation, CodeRabbit automated review on draft promotion, manual re-reviews, Codex fallback, exact-head review evidence, concurrent review adjudication, and why every push needs fresh CI and review. Also covers the merge handoff, screenshot gotchas, Dependabot lockfile trap, merge escape hatches, broken merge scripts, and GitHub MCP gotchas. Use when committing, opening or updating a PR, monitoring CI or review, addressing review comments, posting screenshots, handing a PR over to merge, landing the plane after Tim merges, or when a GitHub MCP call does something unexpected.
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
already in a shell. Open every agent-created PR as a **GitHub draft**, regardless of
size (`gh pr create --draft ...`). Promoting the draft (`gh pr ready`) is what triggers
CodeRabbit's review; it is separate from the PinPoint `ready-for-review` label applied
only at the end of Phase 3.

### Agent origin

Every PR opened by an agent carries exactly one origin label and a visible signature in
its description. This is a lightweight way to find the implementing session; it is not
a review, readiness, CI, or merge signal.

1. Use the full registered huddle name as the final line of the PR description:
   `—<huddle-name>`.
2. Add one label for the implementing harness:
   - `Claude-*` → `Claude`
   - `Codex-*` → `Codex`
   - `Antigravity-*` or `AGY-*` → `Agy`

Preserve the PR's other labels and description content. Do not replace the origin label
or signature on a PR another agent opened; its attribution remains with the original
implementer.

### `ownerless`: the unowned-PR queue

`ownerless` is the companion signal to the origin label. Origin says who opened the PR;
`ownerless` says nobody is driving it. It is applied only by unattended bots — scheduled
Claude cloud routines (in their own prompts), Dependabot and Renovate (from
`.github/dependabot.yml` and `.github/renovate.json`) — which open a PR and then stop, so
no session is watching CI, adjudicating review threads, or taking it to merge-ready.

`gh pr list --label ownerless` is therefore the queue of open work with no owner. When you
adopt one, you take on the full Phase 3 obligation for it, so remove the label in the same
step (`gh pr edit <PR> --remove-label ownerless`) — an adopted PR is no longer unowned.
Never apply `ownerless` to a PR you opened yourself; you own that one by definition.

### PR description template

```
## Summary

- [1-3 bullets summarizing what changed and why]

## Test Plan

- [ ] [bulleted markdown checklist of TODOs for testing the PR]

## Related Issues

Closes #N (if applicable)

—<YourFullRegisteredHuddleName>
```

---

## Phase 3: Review (CI + review + label)

### Waiting on CI or review

Run the watcher as a background command (Claude Code: Bash with `run_in_background`; other harnesses: their background-task equivalent) so the wait costs no tokens:

```bash
python3 scripts/workflow/pr-watch.py <PR> --phase <ci|review> --expected-head <HEAD_SHA>
```

It polls until a terminal verdict, then prints one JSON object on stdout (progress goes to stderr) and exits 0 passed / 1 act on it / 2 timed out or undetermined. Never hand-roll a polling loop.

---

### 3.1 Watch CI

After pushing a commit at `HEAD_SHA`, watch CI in the background:

```bash
python3 scripts/workflow/pr-watch.py <PR> --phase ci --expected-head <HEAD_SHA>
```

For a new draft PR, keep it draft until `CI Gate` succeeds for the current head, then
run `gh pr ready <PR>`. Promotion out of draft automatically triggers CodeRabbit review
on the current head commit. A green run for an older SHA does not qualify.

**Handling the CI result**:

- `outcome: "passed"` (exit 0): CI Gate passed on `HEAD_SHA`. If the PR is draft, run `gh pr ready <PR>` (which auto-triggers CodeRabbit review), then proceed to monitor review in 3.4.
- `outcome: "failed"` (exit 1): A run or CI Gate failed. The watcher saves the failed-step log and returns its path as `failure_artifact` (under `tmp/gh-monitor/`). Address the failure, commit, and push.
  - If judged to be a GitHub Actions **infra** flake (network timeout, runner loss, download 5xx, container start): log it with `bash scripts/workflow/log-gha-flake.sh <pr> <run-id> <class> "<symptom>"` before retrying.
- `outcome: "stale"` (exit 1): The PR head moved away from `expected_head`. The owner re-checks branch state.
- `outcome: "conflicting"` (exit 1): Merge conflict developed (`DIRTY` or `CONFLICTING`). Merge `origin/main` into the branch and push.
- `outcome: "timed_out"` or `"undetermined"` (exit 2): Re-run or investigate API reachability.

### 3.2 Check for review comments

Read threads via `mcp__github__pull_request_read(method: "get_review_comments", owner, repo, pullNumber, perPage: 100)`. Each thread carries `is_resolved` (snake_case), `is_outdated`, and a `PRRT_kwDOxxx` node ID for resolving.

### 3.3 Address review comments

Fixing, declining with a one-sentence signed reply, and resolving the thread is AGENTS.md §5 "Review comments"; the rubric is `REVIEW.md`.

Every unresolved thread counts, whoever opened it — the `threads` gate is author-agnostic. Resolve or decline each one before moving on.

### 3.4 Get the head commit reviewed

**Review Priority Chain:**
$$\text{CodeRabbit (Default)} \longrightarrow \text{Codex (Secondary / Fallback)} \longrightarrow \text{Local Attestation (Manual)}$$

#### 1. CodeRabbit: Default Automated Reviewer

- **Draft promotion auto-trigger:** All agent-created PRs start as drafts (`gh pr create --draft`). When current-head CI succeeds, promote the PR out of draft:
  ```bash
  gh pr ready <PR>
  ```
  Draft promotion automatically triggers a CodeRabbit review on the current head commit.
- **No auto re-reviews on commit push:** Pushing subsequent commits to an open PR does **not** automatically trigger a CodeRabbit re-review. Wait for replacement CI to succeed on the new head, then explicitly request a re-review:
  ```bash
  gh pr comment <PR> --body "@coderabbitai review"
  ```
  CodeRabbit edits its acknowledgement comment in place — "Review triggered" can become "Review rate limited", so check current status.
- **Hourly Quota & Rate Limiting:** We have an allowance of 5 CodeRabbit reviews per rolling hour. When rate-limited, CodeRabbit posts an issue comment containing `Review rate limited.`
- **Quota Fallback to Codex:** When CodeRabbit is rate-limited, immediately fall back to requesting a Codex review (see below). If Codex is also out of quota or unavailable, alert Tim and recommend either performing a local review attestation or waiting until the next CodeRabbit review slot becomes available.

#### 2. Codex: Secondary Reviewer & Rate-Limit Fallback

- **Manual request only:** Codex reviews are triggered strictly via explicit manual request and never run automatically on draft promotion or commit push.
- To request Codex review on the current head (after current-head CI passes):
  ```bash
  bash scripts/workflow/request-codex-review.sh <PR>
  ```
  This helper verifies that the authenticated account is the repository owner, the PR is open and ready, current-head CI passed, and the head lacks review coverage. It posts the SHA-pinned `@codex review` trigger with a hidden marker binding the trusted reaction witness to that SHA. Never request the same head twice.

#### 3. Concurrent Review Execution & Adjudication

Both CodeRabbit and Codex can review the same head. The review watch passes on the first qualifying review of the exact head and does not track the other reviewer; if a second review lands later, adjudicate its findings like any other — unresolved threads block the gate whoever opened them.

#### 4. Monitor review

```bash
python3 scripts/workflow/pr-watch.py <PR> --phase review --expected-head <HEAD_SHA>
```

**Handling the review result**:

- `outcome: "passed"` (exit 0): The gate label is `approved` (exact head covered by CodeRabbit approval, Codex evidence, or local attestation) AND 0 unresolved threads remain.
  - Proceed to UI screenshots in 3.5, apply the `ready-for-review` label in 3.6, then enter Phase 4 merge handoff.
- `outcome: "action_required"` (exit 1): Either `approved` with unresolved threads (>0), or the review state is `changes requested`.
  - Adjudicate findings: fix code or reply/decline threads.
  - If code changed, push fixes, wait for replacement CI, and re-request review.
  - The watch does not detect CodeRabbit rate limiting — a rate-limited review runs to `timed_out`. If CodeRabbit's comment says `Review rate limited`, fall back to Codex; if Codex is also unavailable, alert Tim.
- `outcome: "stale"` (exit 1): Branch head moved; re-orient to the new head.
- `outcome: "conflicting"` (exit 1): Merge conflict; merge `origin/main` into the branch and push.
- `outcome: "timed_out"` / `"undetermined"` (exit 2): Re-run watch or inspect GitHub API reachability.

The owning agent stays assigned through the whole loop: monitor current-head CI and review, address or explicitly decline every finding, resolve every thread, push fixes, and request a replacement review only after replacement CI succeeds. Never request the same head twice, self-attest without authorization, or hand off an unreviewed PR.

#### Local review and manual-attestation route

This older route remains valid when Tim explicitly chooses `/codex:review` or
`/code-review`. Agents cannot launch either local command. Finish the work, then check
that the review will see the intended diff:

```bash
bash scripts/workflow/review-preflight.sh <PR>
```

Both reviewers read **local git state in the session's working directory**. Neither reads the PR, neither knows its head SHA, and neither objects to being pointed somewhere else — so a review run from the wrong directory finds nothing and reports nothing, which is indistinguishable from a clean review. That is the one failure mode here that produces a false attestation nobody notices making.

The preflight checks what has to hold — you're on the PR's branch, local HEAD is the SHA that's actually pushed, the tree is clean, `main...HEAD` is non-empty, local `main` matches `origin/main`, and the PR is based on `main` — and prints both commands for Tim only when all of it passes. When something doesn't, it names it and prints no command; hand over the reasons, not a command you know is aimed at nothing.

The `main` == `origin/main` check is the least obvious and the easiest to dismiss. It is on the LOCAL branch deliberately: the Codex plugin's `detectDefaultBranch` reads `refs/remotes/origin/HEAD`, strips the `refs/remotes/origin/` prefix and returns the bare name, so git resolves the local branch. Meanwhile §5 says sync with `git fetch origin && git merge origin/main`, which advances your branch and never the `main` it merged from — so local `main` is stale as a matter of routine and the review quietly covers other people's already-merged work. On PR #1931 that was 34 files instead of the PR's 22. The remedy names the worktree holding `main`, because a branch checked out elsewhere cannot be fast-forwarded from here.

Then wait. This is a real stop — don't fill the time with more commits, because every push invalidates the review he is about to give you.

**When Tim types `/codex:review`, pick foreground vs background yourself — don't ask.** The plugin's command file instructs you to settle it with `AskUserQuestion`. Tim's global `CLAUDE.md` forbids that tool outright: interrupting the picker to type something returns a _fabricated_ answer, reporting whichever option was labelled "(Recommended)" as his choice. So use the plugin's own heuristic instead — foreground only when the diff is roughly 1–2 files with no sign of a directory-sized change, background in every other case including unclear size — and say in one line which you picked and why. This is an operational call, not one of the taste decisions §6 reserves for him (Tim, 2026-08-20).

**The Bash call behind it is subject to the same intermittent classifier block as
`mark-review.sh`.** `/codex:review` expands into an instruction for you to run
`node …/codex-companion.mjs review`, so the review does execute through your Bash tool
— the `disable-model-invocation` flag only stops you invoking the _slash command_. On
2026-08-21 that node call was refused with `Blocked by classifier` after succeeding
twice earlier in the same session. There is no allow rule for it, because the path
lives outside the repo in the plugin cache and would have to go in Tim's global
settings. If it is denied, say so and ask him to type the command again; do not
hand-roll the node invocation to get around it.

Address the findings. If the reviewed head remains current, attest it — **this step is
yours on the local route.** A clean local review with no marker still reads as
`not reviewed`:

```bash
bash scripts/workflow/mark-review.sh <PR> codex-plugin-cc base-main "<one-line findings summary>"   # /codex:review
bash scripts/workflow/mark-review.sh <PR> claude-code <depth> "<one-line findings summary>"         # /code-review <depth>
```

That posts the sticky SHA-pinned marker `<!-- pinpoint-review: {head_sha} -->` that the `reviewed` gate detects.

**The pair has to match what Tim actually ran.** `codex-plugin-cc base-main` is the exact attestation for `/codex:review`; `claude-code <depth>` is the one for the built-in `/code-review`, where `<depth>` is the level he chose (`low`, `medium`, `high`, `xhigh`, `max`, `ultra`). Do not substitute a custom focus, a different base, a depth he didn't run, or a result from before the final push. The marker records the review method as well as the SHA, so the merge handoff can state what actually ran.

#### Pushing after the review

Any push invalidates review coverage for the previous SHA — except a pure merge of `main`,
which the gate carries coverage across (PP-ojoj). Wait for replacement current-head CI, then
re-request review for the new head (see 3.4). Never copy
or refresh a marker over code that the named local review did not inspect. Historical
`claude-code:trivial` markers remain readable for old PRs, but agents must not create new
self-attestations: the exact-head Codex review or Tim-run local review must inspect every
update.

#### Why the review-handoff commands carry permission allow rules

`.claude/settings.json` has two `permissions.allow` entries, and they are the two
scripts in this phase:

```json
"allow": [
  "Bash(bash scripts/workflow/mark-review.sh *)",
  "Bash(bash scripts/workflow/review-preflight.sh *)"
]
```

`review-preflight.sh` is read-only and is required before the explicit local-review
route — so without the rule, that handoff raises a prompt for a script that only reads. (Tim
approved it on 2026-08-21, from the `/code-review medium` finding on #1931.)

The `mark-review.sh` entry is there for a sharper reason: the command was intermittently
denied. On 2026-08-03 an auto-mode session was refused with `Blocked by classifier` on PR #1815, while the same command succeeded four times across 2026-08-09/10 (PRs #1832, #1828, #1829, #1848). The block was contextual, not a standing rule — which is the worst shape for a required step, because it fails only sometimes and leaves the PR sitting at `unreviewed` with no path forward. A background subagent has no human to hand the command to at all. Rules are evaluated deny → ask → allow, and an explicit allow resolves the call before the classifier is consulted, so the entry makes the step deterministic. (PP-yx97. A new tool permission needs Tim's explicit approval each time; he gave it on 2026-08-11. This is not a CORE-SEC-010 surface — that rule governs prod-mutating Supabase tools, and its ban on `allow` applies to those.)

**What the rule does not do is make the attestation true.** It removes the harness's opinion about whether you earned the marker. An incorrect marker can make the gate claim a review that never happened. In Claude Code and Codex, the `merge-pr.sh` permission rule prompts Tim again; his direct merge request authorizes the agent to initiate the guarded merge in every harness. Neither changes the requirement that the review evidence be honest and exact-head.

Two limits worth knowing:

- Each rule matches the documented invocation — `bash scripts/workflow/<script> …` — and only that shape. **Use the relative path** — an absolute one does not match and falls through to the classifier. Chaining (`… && something-else`) does not inherit the allow either — each subcommand is matched on its own.

#### Readiness is not review

`pr-watch.py --check-ready` reports review state but does **not** gate on it. It answers
whether the current head may leave draft and receive its manual review request; gating
on review there would be circular. A PR may be GitHub-ready while still lacking the
final PinPoint `ready-for-review` label. Do not call it merge-ready until 3.6 is
satisfied.

### 3.5 Post UI screenshots (UI-touching PRs only)

If the diff touches `src/app/**`, `src/components/**`, any `.css`, or design tokens, screenshots must be posted before the PR can be called ready unless the edit genuinely has no rendered effect and the PR body records `<!-- no-visual-change -->`. Tim reviews rendered UI changes by eye, not by reading a diff. The commit-time `ui-screenshot-reminder.cjs` PostToolUse hook nudges on the first `git commit` that touches a UI glob; satisfy it with screenshots or the documented opt-out.

```
node scripts/workflow/pr-screenshots.mjs <PR>
```

Shoots the manifest in `scripts/workflow/ui-screenshot-manifest.json` (issues list, issue detail, report form, dashboard, a machine detail, collections — pass `--pages=a,b,c` to shoot a subset) at desktop (1440×900) and mobile (390×844) viewports, pushes the PNGs to the orphan `pr-screenshots` branch, and posts/updates one sticky PR comment (marker `<!-- pr-screenshots -->`) with a desktop|mobile table per page. Re-run after any UI-affecting push — it updates the same sticky comment in place, tagged with the new head SHA.

Two `--pages` gotchas: it only accepts the **equals** form (`--pages=machine-edit`); the space-separated form fails with `Unrecognized argument`. And a filtered run rebuilds the sticky comment from just the pages it shot, silently dropping the others — so always finish with an unfiltered run before handing the PR off.

Requires the local dev server (`pnpm run dev`) and Supabase (`supabase start`) running. First run (or a stale/missing login session) regenerates `e2e/.auth/*.json` via the `auth-setup` Playwright project, which resets + reseeds the local dev DB — same as running E2E tests locally, not a new risk.

**No visible change?** The screenshot check keys on file **paths**, so a UI-glob edit that renders nothing new (a pure refactor, a non-null-`!` removal) still trips the "screenshots?" nudge — and two identical screenshots would satisfy it without conveying anything. Record the claim instead: put `<!-- no-visual-change -->` in the PR **body**. `merge-handoff.sh` reads that marker and clears its `NO screenshots posted` nudge (posted screenshots always take precedence over it). Use it only when the change genuinely has no rendered effect.

### 3.6 Apply `ready-for-review` label

Once CI green + either exact-head Codex coverage (including an adjudicated finding-bearing review per 3.4) or manual attestation of head + zero unresolved review threads + no merge conflict + the screenshot requirement or documented opt-out in 3.5 satisfied, apply the label via `mcp__github__issue_write(method: "update", …)` or `gh pr edit <PR> --add-label ready-for-review`.

The label signals readiness, not merge authorization. A direct request from Tim in the active task authorizes the owning agent to run the guarded merge script; the script rechecks all gates.

**The label does not get the PR reviewed.** Applying it on a PR whose head is past its last review — or that was never reviewed at all — just moves the failure to merge time.

---

## Phase 4: Merge — Tim's decision (PP-wi85)

**Tim decides whether to merge.** If he explicitly requests it in the active task (for example, “merge it” with one unambiguous PR), the owning agent in any harness runs `bash scripts/workflow/merge-pr.sh <PR> --human`. The flag records Tim’s authorization; he need not repeat it in a shell. The script rechecks CI, exact-head review, unresolved threads, and conflicts. Claude Code and Codex also show a permission prompt; the direct user request authorizes the agent to initiate the guarded merge in every harness. If the PR target is ambiguous, clarify it. If a gate fails, stop and report the blocker. Raw channels (`gh pr merge`, `gh api PUT .../merge`, MCP `merge_pull_request`) remain prohibited for agents because they skip the gates. In PinPoint sessions Claude Code and Codex deny the raw merge channels for every repository; merge another repository's PR from that repository.

### 4.1 Handoff by default; merge on explicit request

Once 3.1–3.6 are satisfied, hand off with the report below if Tim has not requested a merge. If he has directly requested it, run the guarded script instead and verify the PR reached `MERGED`; do not ask him to repeat the request. Readiness alone never authorizes merging.

```bash
bash scripts/workflow/merge-handoff.sh <PR>
```

It prints what Tim needs to decide whether to merge — which review ran and whether it covers head, how many commits landed since, CI, threads, mergeable + how far behind main, when main was last merged in, the diff split into src / tests / docs / other, migrations, newly-registered env vars, UI + screenshots — and ends with two `!`-prefixed commands: one to re-run the report, one to merge.

**Why a script and not a format you fill in.** Every line of it is a fact you would otherwise be recalling: how many commits back the review was, what the line counts are, whether main has been merged in. Those are exactly the claims that drift, and Tim acts on them. `git` and `gh` already know all of it. Paste the block; add prose only for what the block cannot know (why a finding was declined, what to watch on deploy).

**The re-run line is part of the report, not decoration.** The block is a snapshot and is stale as soon as CI re-runs or anyone pushes. Tim re-runs it himself rather than asking you to re-check.

**The merge command only appears when all four gates actually pass.** An un-ready PR gets the blocking reasons instead — so don't hand over a merge command the report didn't print. If CI is still running, the report says so; hand him the automerge form, which waits rather than making him come back. Get the head reviewed first (Phase 3.4); automerge waits out CI, not an unreviewed head. The owning agent monitors the manually requested review outside this script:

```
! scripts/workflow/merge-pr.sh <PR> --human --automerge
```

Push completed work. Without an explicit merge request, report that the PR is ready for Tim and give the guarded command. After his explicit request, run the script and say “merged” only after verifying its result.

### 4.2 Escape hatches (Tim decides; you can inform, not invoke)

`merge-pr.sh` evaluates **4 gates**: `ci`, `threads`, `reviewed`, `no_conflict`. `--force` bypasses the review-state pair (`threads` + `reviewed`); `--bypass-merge-requirements` bypasses `ci` and passes `--admin`. Each bypass requires a separate explicit request from Tim; “merge it” alone authorizes neither. The `no_conflict` gate is NEVER bypassable; GitHub rejects conflicting merges regardless of `--admin`.

**On any FAIL the script removes the `ready-for-review` label if present** (and likewise on the `--automerge` RED path). The label's contract is "click-merge-without-thinking"; if a gate fails at merge time that contract is broken, so the label goes. Practical consequence: after Tim reports a FAIL, fix the underlying issue, push, and **re-apply the label** (3.6) before re-handing him the `--human` command — don't assume it survived.

**A `reviewed` FAIL is almost never a `--force` case.** `not reviewed` means no checker covers head, `stale review` means you pushed past the review record, and `changes requested` means a reviewer asked for changes on this head (or threads are open) — all describe an unfinished PR, not a broken gate. Take either honest path in 3.4 and cover head.

`--bypass-merge-requirements` is for a required check failing for known-irrelevant reasons (infrastructure flake, unrelated job) where the change has been manually verified safe — log the flake first with `bash scripts/workflow/log-gha-flake.sh <pr> <run-id> <class> "<symptom>"` (see `docs/runbooks/gha-flake-log.md`) — or an emergency hotfix where waiting for CI is not acceptable. Do NOT suggest bypassing when a merge conflict exists, or when the underlying state hasn't been manually verified.

### 4.3 If `merge-pr.sh` itself is broken

An owning agent can run `merge-pr.sh` after Tim’s explicit request, but that does not help when the script itself is broken. Raw channels remain prohibited for agents. If a hotfix genuinely cannot wait for a script fix, tell Tim why and let him choose a manual path in his own shell; do not work around the guard.

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
