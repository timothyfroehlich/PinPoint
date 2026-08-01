---
name: pinpoint-pr-workflow
description: Full PR lifecycle for PinPoint — commit, push, CI monitoring, explicitly requesting the Copilot review (request-only since 2026-08-01), Copilot + human review handling, UI screenshots, readiness labeling, human-only gate-enforced merge handoff, and post-merge deploy-watch/cleanup/handoff. Use when committing changes, opening PRs, watching CI, requesting or chasing a Copilot review, addressing review comments, posting screenshots, handing a PR to Tim to merge, or landing the plane after Tim merges (watching the deploy, cleanup, handoff).
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

Default to `pnpm run check` (~12s; covers type, lint, format, unit tests, yamllint, actionlint, ruff, shellcheck). Use `pnpm run preflight` (full + integration) before commit for non-trivial changes, especially: migrations, security/auth changes, server actions, middleware.

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

## Phase 3: Review (CI + Copilot + label)

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

Exit 0 = all passed, or stopped for a new Copilot review. Exit 1 = failure — read `tmp/gh-monitor/failure-<RUN_ID>.md`.

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

Copilot review threads count here too — a PR is not ready while Copilot has open threads. Resolve or decline each one (per 3.3) before moving on.

### 3.4 Request the Copilot review — explicitly, once, when you have stopped iterating

**The merge bar has not moved: a PR still cannot merge without a review covering the HEAD commit** — a Copilot review or a SHA-pinned Claude marker — with all its threads resolved. Review is mandatory, not on-demand, not discretionary, and the Claude marker is not a shortcut around it.

**What changed on 2026-08-01 is only _when_ you spend the review.** The repo is now configured **request-only**: pushing a commit does not produce a review, applying `ready-for-review` does not produce a review, CI going green does not produce a review. Nothing asks on your behalf. Previously Copilot reviewed every intermediate push — so an agent churning through CI failures, review fixes and merge-from-main commits piled up reviews that were superseded within minutes, at real quota cost. Now you control the timing: **spend the review on the commit you intend to be final.**

The consequence is that requesting is a **step in finishing a PR**, not an optional extra. If you never ask, head is never reviewed and the `reviewed` gate blocks the merge until a human notices. It is easy to forget; Tim accepted that risk deliberately in exchange for not burning quota on work that isn't ready.

#### The one canonical way to ask

```bash
gh pr edit <PR> --add-reviewer "@copilot"
```

`@copilot` is a `gh`-native special value for `--add-reviewer` (documented by GitHub; verified on `gh` 2.97). It resolves to `copilot-pull-request-reviewer[bot]` — the exact login `_pr-gates.sh` and `pr-watch.py` match. Use this form and only this form:

- Don't hand-roll `POST /repos/{owner}/{repo}/pulls/{n}/requested_reviewers` — one command beats a remembered payload.
- Don't reach for an MCP `request_copilot_review` tool. It isn't reliably there — the `github` plugin is absent from the installed-plugin set, and a session's tool catalog may expose no GitHub MCP tools at all. The `docs/superpowers/` notes that reference the tool are records of a 2026-05 setup, not a current guarantee. `gh` is always present.
- Don't request at `gh pr create` time. Opening the PR is the start of iteration, not the end of it.

#### Sequencing — this is the whole point of the change

1. Finish the work. Push everything: the implementation, the CI fixes, the self-review fixes, the merge-from-main.
2. Do your own manual pass over `git diff origin/main...HEAD` against `REVIEW.md`. Fix what you find and push that too.
3. **Only now** run `gh pr edit <PR> --add-reviewer "@copilot"` — **once**.
4. Wait for the review, then handle its threads per 3.2/3.3.

**If you push after requesting, the request is spent and the review no longer covers head.** There is no auto re-request, by design — a 3-commit fixup that re-requested on each push would spend three reviews, which is exactly the quota burn this change exists to eliminate. So: batch your fixes, stop iterating, then re-request **once**:

```bash
gh pr edit <PR> --add-reviewer "@copilot"   # same command re-requests
```

Live casework from the night this changed: on PRs #1779 and #1780 the agent pushed a fix ~3 minutes after Copilot's review landed, invalidating it. Under request-only that pattern yields no valid review at all.

#### If the request produces nothing (the Claude fallback)

Requesting is not optional and the fallback is not a substitute for it. `mark-claude-review.sh` is for the case where you **did** request and Copilot still didn't deliver — it silently skipped the `review_requested` event (PR #1342 / #1326), or it's quota-limited. It is **not** a way to skip asking.

Once you have requested and Copilot has not produced a review of head:

1. Review the PR diff yourself — a deliberate manual pass over `git diff origin/main...HEAD` against `REVIEW.md`, the canonical rubric. (`/code-review` is a harness built-in that only Tim can trigger; `ultra` is user-triggered and billed. An agent can launch neither.)
2. Address serious findings the same way you handle Copilot threads: fix → push → re-request. A fix changes the head SHA and re-arms the `reviewed` gate. Consciously decline the rest.
3. `bash scripts/workflow/mark-claude-review.sh <PR> "<one-line findings summary>"` — posts the SHA-pinned sticky marker `<!-- pinpoint-claude-review: <head_sha> -->` that the `reviewed` gate detects.

The marker attests that **you actually read the diff**. Posting it without having done the pass is a false attestation, not a shortcut.

**A Copilot comment saying it _couldn't_ review is not a review** (PP-jw0s). When Copilot is quota-limited or finds nothing to analyze, it still posts a review object with a real timestamp — and both gates used to count it, going green on a review that read nothing. They now match those bodies and treat them as absent, so a quota-limited PR takes the honest path: WAIT, then FAIL with the `mark-claude-review.sh` remedy printed. If you see that FAIL during a quota outage, the gate is working — run the fallback above, don't `--force`.

#### What the gates check today (and what's changing)

`merge-pr.sh` enforces the review at merge time via the `reviewed` gate (PASSes on a Copilot review OR a SHA-matched Claude marker; WAITs inside a 600s window; FAILs after it with no review of either kind). The companion `currency` gate never hard-fails — it only WARN-proceeds once its timer runs out. Both honour the marker.

**Caveat while PP-lzaw is open:** both timers are still keyed to the **head push**, which only made sense when Copilot arrived unprompted. Until PP-lzaw re-keys them to the review _request_, a PR where nobody requested a review will sit through a 600s `currency` wait for something that is never coming and then land on a `reviewed` FAIL. Don't read that FAIL as "post the marker" — read it as "you forgot to request." Request, wait for the review, and let the gate pass honestly. Don't tell Tim a PR is "ready" or "done" while head is still unreviewed.

### 3.5 Post UI screenshots (UI-touching PRs only)

If the diff touches `src/app/**`, `src/components/**`, any `.css`, or design tokens, screenshots must be posted before the PR can be called ready — Tim reviews UI by eye, not by reading a diff. The commit-time `ui-screenshot-reminder.cjs` PostToolUse hook nudges on the first `git commit` that touches a UI glob; don't ignore it.

```
node scripts/workflow/pr-screenshots.mjs <PR>
```

Shoots the manifest in `scripts/workflow/ui-screenshot-manifest.json` (issues list, issue detail, report form, dashboard, a machine detail, collections — pass `--pages a,b,c` to shoot a subset) at desktop (1440×900) and mobile (390×844) viewports, pushes the PNGs to the orphan `pr-screenshots` branch, and posts/updates one sticky PR comment (marker `<!-- pr-screenshots -->`) with a desktop|mobile table per page. Re-run after any UI-affecting push — it updates the same sticky comment in place, tagged with the new head SHA.

Requires the local dev server (`pnpm run dev`) and Supabase (`supabase start`) running. First run (or a stale/missing login session) regenerates `e2e/.auth/*.json` via the `auth-setup` Playwright project, which resets + reseeds the local dev DB — same as running E2E tests locally, not a new risk.

### 3.6 Apply `ready-for-review` label

Once CI green + you requested the review per 3.4 and it landed (or you ran the fallback) + zero unresolved review threads (including Copilot) + that review covers the head commit + no merge conflict + screenshots posted (if UI-touching, per 3.5):

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

**The label does not request the Copilot review.** Tim considered wiring the request to `ready-for-review` (or to CI green) and rejected it: requesting stays an explicit, deliberate act (3.4). Applying the label on a PR whose head was never reviewed just moves the failure to merge time.

---

## Phase 4: Merge — human-only (PP-wi85)

**Merging is human-only, via ANY path.** Direct `gh pr merge`, MCP `merge_pull_request`, AND `scripts/workflow/merge-pr.sh` itself are ALL blocked for an agent by the `block-direct-merge.cjs` PreToolUse hook — including `merge-pr.sh --dry-run`. There is no agent-usable bypass; the old `.claude-merge-bypass` sentinel was removed entirely. If you want to sanity-check gate-relevant PR state without running the script, read it via MCP (`pull_request_read`) instead — you cannot invoke `merge-pr.sh` at all, not even to preview.

### 4.1 Agent's terminal state: handoff, not merge

Once 3.1–3.6 are satisfied (CI green, review requested per 3.4 and covering the head commit, threads resolved, no conflict, screenshots posted if UI-touching), your job on this PR is done. Tell Tim it's ready and hand him the exact command to run himself:

```
! scripts/workflow/merge-pr.sh <PR> --human
```

If CI is still running, hand him the automerge form instead — it waits rather than making him come back. Get the head reviewed first (Phase 3.4); automerge waits out CI, not an unreviewed head — and under request-only a review you never asked for never arrives, so it would just burn the timeout:

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

- `-a` / `--automerge` — poll the gates instead of evaluating once, and merge the moment they all pass. Fire it while CI is still running; that's the point. It does **not** wait out an unreviewed head — `reviewed` hard-fails 600s after a head push with no Copilot review and no Claude marker, and a hard failure ends the run — so make sure head is reviewed first: request per 3.4, or post the marker when Copilot is quota-limited or has skipped a request you did make. Ends in exactly one of three states, each named on exit: `MERGED`, `RED` (a gate hard-failed — no merge, `ready-for-review` dropped), or `TIMED OUT` (still waiting when the budget expired — PR untouched, label intact, exit code 2). A WAIT keeps it polling; only a hard failure stops it. `AUTOMERGE_TIMEOUT` (default 3600s) and `AUTOMERGE_POLL_INTERVAL` (default 30s) tune it. Mutually exclusive with `--dry-run`. Prints the gate block on the first poll and again whenever the picture changes, so a long wait stays readable.
- `--force` — bypass `currency` + `threads` + `reviewed` (review-state) gates. Requires manual permission approval.
- `--bypass-merge-requirements` — bypass `ci` gate AND pass `--admin` to `gh pr merge`,
  overriding GitHub branch-protection rules. Requires manual permission approval.

Combine `--force --bypass-merge-requirements` to bypass `currency` + `threads` + `reviewed` + `ci` together.
The `no_conflict` gate is NEVER bypassable — GitHub rejects conflicting merges regardless of `--admin`.

`merge-pr.sh` evaluates **5 gates**: `ci`, `currency`, `threads`, `reviewed`, `no_conflict`. The `reviewed` gate is the hard backstop that no head commit merges unreviewed — prefer running the Claude fallback (Phase 3.4) to satisfy it before handoff, rather than telling Tim to `--force` past it.

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

**`--force`** — for Copilot/review-state issues (bypasses `currency` + `threads` + `reviewed`):

- API failure on the `threads`, `currency`, or `reviewed` gate where the underlying state has been manually verified fine
- Copilot has silently-skipped a merge-from-main commit and the diff was reviewed manually
- The `threads` / `currency` / `reviewed` gates are known to fail and that's being explicitly accepted

Prefer the Claude fallback (Phase 3.4 — manual diff review + `mark-claude-review.sh`) over asking Tim to `--force` a `reviewed`-gate failure: the fallback makes the guarantee true rather than skipping it, and you can do it before handoff.

**A `reviewed` FAIL because you never requested the review is neither a `--force` case nor a marker case** — it's an unfinished PR. Request it (3.4), wait, then hand off.

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
