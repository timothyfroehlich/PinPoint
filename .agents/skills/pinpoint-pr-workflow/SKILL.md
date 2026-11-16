---
name: pinpoint-pr-workflow
description: The PR-lifecycle decisions GitHub's native gates do not state — draft-first creation, Tim's UI approval while a draft, marking ready for the automated Claude Review check, adjudicating its findings, and why every push needs fresh CI and review. Also covers the merge on Tim's request (`gh pr merge`, never `--admin`), keeping the branch up to date, the Dependabot lockfile trap, merge escape hatches, post-merge worktree reaping, and GitHub MCP gotchas. Use when committing, opening or updating a PR, monitoring CI or review, addressing review comments, posting screenshots, merging or reporting a PR ready, landing the plane after a merge, or when a GitHub MCP call does something unexpected.
---

# PinPoint PR Workflow

End-to-end pipeline from "I have changes" to "merged in main".

## When to use — pick your entry phase

- Uncommitted changes in tree → **Phase 1: Commit**
- Local commits, no PR yet → **Phase 2: PR**
- PR open, required checks or conversations not yet clean → **Phase 3: Review**
- Required checks green, every conversation resolved → **Phase 4: Merge** (Tim's decision — report ready, or merge on his explicit request)
- The PR has merged → **Phase 5: after the merge**

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

Before opening the PR, stop for Tim's approval of any UI change (rendered screenshots, the
AGENTS.md "Early UI review gate") and of any feature-spec requirement edit (the exact diff,
AGENTS.md "Documentation"). With those approved, or with neither in the change, open the PR.

Prefer MCP `create_pull_request` for typed argument handling, or `gh pr create` if you're
already in a shell. Open every agent-created PR as a **GitHub draft**, regardless of
size (`gh pr create --draft ...`). It stays draft through CI and any UI approval (3.5);
marking it ready (3.4) is what starts Claude Review.

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

## Phase 3: Review (CI, UI approval, Claude Review, threads)

The order: push → CI (3.1) → while still a draft, Tim's UI approval if the diff touches a UI path (3.5) → mark ready → Claude Review (3.4) → adjudicate its findings and every other thread (3.2–3.3). Each later push repeats CI and Claude Review on the new commits.

### Waiting on CI

Run the watcher as a background command (Claude Code: Bash with `run_in_background`; other harnesses: their background-task equivalent) so the wait costs no tokens. It polls until a terminal verdict, then prints one JSON object on stdout (progress goes to stderr) and exits 0 passed / 1 act on it / 2 timed out or undetermined. Never hand-roll a polling loop.

---

### 3.1 Watch CI

After pushing a commit at `HEAD_SHA`, watch CI in the background:

```bash
python3 scripts/workflow/pr-watch.py <PR> --phase ci --expected-head <HEAD_SHA>
```

A green `CI Gate` on the current head is what the ruleset requires. A green run for an
older SHA does not qualify.

**Handling the CI result**:

- `outcome: "passed"` (exit 0): CI Gate passed on `HEAD_SHA`, and on a ready PR Claude Review passed too. On a draft, continue with 3.5 (UI paths) or mark ready (3.4). On a ready PR, adjudicate the `unresolved_threads` it reports (3.3).
- `outcome: "failed"` (exit 1): CI Gate or Claude Review failed; `ci_gate` and `claude_review` say which. When it can fetch the failed-step log, the watcher saves it and returns its path as `failure_artifact` (under `tmp/gh-monitor/`); if `failure_artifact` is null, open `detail_url` for the run log. Address the failure, commit, and push.
  - If judged to be a GitHub Actions **infra** flake (network timeout, runner loss, download 5xx, container start): log it with `bash scripts/workflow/log-gha-flake.sh <pr> <run-id> <class> "<symptom>"` before retrying.
- `outcome: "stale"` (exit 1): The PR head moved away from `expected_head`. The owner re-checks branch state.
- `outcome: "conflicting"` (exit 1): Merge conflict developed (`DIRTY` or `CONFLICTING`). Merge `origin/main` into the branch and push.
- `outcome: "timed_out"` or `"undetermined"` (exit 2): Re-run or investigate API reachability.

### 3.2 Check for review comments

Read threads via `mcp__github__pull_request_read(method: "get_review_comments", owner, repo, pullNumber, perPage: 100)`. Each thread carries `is_resolved` (snake_case), `is_outdated`, and a `PRRT_kwDOxxx` node ID for resolving.

### 3.3 Address review comments

Fixing, declining with a one-sentence signed reply, and resolving the thread is AGENTS.md §5 "Review comments"; the rubric is `REVIEW.md`.

Every unresolved thread counts, whoever opened it — Claude Review's findings, Tim's comments, another agent's. The ruleset requires every conversation resolved, so fix or decline each one and resolve it.

### 3.4 Claude Review

The reviewer is the required `Claude Review` check (`.github/workflows/claude-review.yaml`, spec `docs/feature-specs/pr-lifecycle-monitoring.md`). It reads `REVIEW.md` from `main`, so a PR cannot rescope its own review.

1. **Mark ready.** With current-head CI green and any UI approval in (3.5): `gh pr ready <PR>`. Claude Review runs on that event with a full review of the PR. On a draft its job is skipped.
2. **Wait for it.** After `gh pr ready`, run the 3.1 watch again on the same head: on a ready PR it waits for Claude Review as well as CI Gate, and its verdict counts the unresolved threads.
3. **Adjudicate every finding.** Findings arrive as inline review comments: fix each, or decline it with a one-sentence signed reply, then resolve the thread (3.3). A finding re-raised after a decline gets the same reply and is resolved again.
4. **Every push is reviewed.** Each later push gets an incremental review of its new commits (main's changes left out), with fresh CI. A comment starting with `/claude-review` re-runs the latest run on the current head, for a run that failed or never ran.

A local `/code-review` by the owning agent is optional, useful before marking a large change ready so findings are fixed before they become threads. Pass the level first, then the PR number (`medium 1234`; the reverse order silently runs at the last-used level, and omitting the PR number diffs against a possibly stale local `main`). It leaves no gate evidence.

### 3.5 Get Tim's UI approval (UI-touching PRs, while still a draft)

When the PR's own diff (from its merge base with `main`) touches a path in `scripts/workflow/ui-paths.txt` (`src/app/**/*.tsx`, `src/components/**`, any `.css`, Tailwind config, design tokens), the required `UI Approval` check waits for Tim's sign-off until he has signed off on at least one head of the PR. Tim reviews rendered UI by eye, not by reading a diff. Get it while the PR is a draft, before updating E2E tests and before marking the PR ready for Claude Review, so no E2E work rides on a layout he has not seen. The commit-time `ui-screenshot-reminder.cjs` hook nudges on the first UI commit.

1. **Capture.** With the dev server (`pnpm run dev`) and Supabase (`pnpm supabase:start`) running:
   ```
   node scripts/workflow/pr-screenshots.mjs [--pages=a,b,c]
   ```
   It shoots the pages in `scripts/workflow/ui-screenshot-manifest.json` at the three review viewports (`pinpoint-design-bible` §4: desktop 1440×900, large mobile 430×932, small mobile 320×568) into `tmp/pr-screenshots/<short-sha>/` and prints one path per PNG. `--pages` takes only the equals form. The first run, or a stale login, regenerates `e2e/.auth/*.json` through the `auth-setup` Playwright project, which resets and reseeds the local dev DB. For a state the manifest cannot reach (a dialog open, a toggle set), shoot it in the browser pane (`preview_start`, then `resize_window` and a screenshot) at the same three sizes.
2. **Show.** Put the screenshots in front of Tim in the session, each page's three sizes together, and offer the running dev server for hands-on review. In Claude Code Desktop that is `SendUserFile` (`display: "render"`) and the browser pane (`preview_start`); a harness that cannot show images gives him the printed paths and the dev server URL. For an ownerless or cloud-routine PR, the Desktop session that adopts it presents them; under the orchestrator, the lead collects them into its artifact (the `pinpoint-orchestrator` skill in Claude Code).
3. **Record his approval.** When Tim approves in the session, or clicks Approve in the orchestrator artifact, run:
   ```
   bash scripts/workflow/approve-ui.sh <PR> --head <sha> --source chat|artifact
   ```
   `--head` is the commit the screenshots came from, so capture from a committed, pushed tree. If the PR head has since moved past it, the script records the approval on the current head only when the PR's own UI diff there is the same patch as at the commit Tim saw (a merge of `main` that left the PR's UI changes alone, clean or conflicted), and says which head he saw; otherwise it refuses and names the UI files that changed. On a head that waits for sign-off it approves the `ui-approval` environment deployment that head's UI Approval run is waiting on, and only that one; on a head whose check already passed on an earlier sign-off it records the approval as a PR comment. Run it only on Tim's own approval; never call the `pending_deployments` API directly. Tim can also approve on GitHub from the run's "Review deployments".

After Tim's first sign-off the check does not wait again on this PR: not for E2E updates, merges of `main` (clean or conflicted), merge-queue commits, or later UI commits. Whether Tim sees a later UI change is the owning agent's call, made on every UI commit after his sign-off:

- **Show him again** when the change is one he would want to see: a new or reworked layout, a component or control added, removed, or moved, a changed user flow, or a visible change to copy, color, spacing, or hierarchy beyond a small fix. Repeat steps 1–3 for the new head; the script records his fresh approval as a PR comment.
- **Don't re-ask** for merges of `main` and their conflict resolutions, fixes that keep the look he approved (a review finding, a typo, an a11y attribute), refactors or type-only edits with no rendered effect, and test-only changes.
- When unsure, show him: an extra look costs him less than a layout he never saw reaching `main`. Say in the PR's state report which UI commits after his sign-off you judged minor.

A UI-path edit with no rendered effect on a PR he has not yet signed off still waits: tell Tim it renders nothing new and let him approve it from the description.

---

## Phase 4: Merge — Tim's decision

**Tim decides whether to merge.** GitHub's ruleset `6326455` enforces the gates natively: required checks `CI Gate`, `Claude Review`, and `UI Approval`, every conversation resolved, and merging through the merge queue. Green checks alone never authorize a merge; Tim's explicit request does.

### 4.1 Report ready by default; merge on explicit request

**Without an explicit merge request**, report the PR as ready: its URL and the output of `gh pr checks <PR> --required`. Add prose only for what the checks cannot say (why a finding was declined, what to watch on deploy).

**When Tim directly asks to merge** an unambiguous PR (for example, “merge it” with one PR in play), the owning agent in any harness runs it; he need not repeat the decision in a shell. If the target is ambiguous, clarify it first.

```bash
gh pr merge <PR> --squash          # gates already pass
gh pr merge <PR> --auto --squash   # GitHub merges once the required checks pass
```

Both put the PR in the merge queue: the first once the gates pass, `--auto` as soon as they do. Use `--auto` when checks are still running, and always when Tim asks for several merges at once. Say “merged” only on the queue watch's `merged` verdict; a PR armed or waiting in the queue is “queued to merge”.

**The merge queue.** The queue builds a commit of `main` plus every PR ahead plus this one and runs CI Gate on it; Claude Review and UI Approval pass there without a new review or sign-off, since each PR passed them on its own head. A branch behind `main` merges as it is. The queue removes a PR whose combined commit conflicts or fails CI Gate; its owning session merges `main` in (`gh pr update-branch <PR>` or locally, never `--rebase`; AGENTS.md §5 Branches), fixes the failure, and runs `gh pr merge` again.

**Watch the queue.** Right after `gh pr merge`, run the watcher in the background (as in 3.1), pinned to the head you enqueued:

```bash
python3 scripts/workflow/pr-watch.py <PR> --phase queue --expected-head <HEAD_SHA>
```

It also waits while auto-merge is armed and GitHub has not yet enqueued the PR. A PR whose own checks go red is never enqueued and the watch runs to its 1h ceiling, so after `--auto` on a head still in CI, run the 3.1 watch first.

- `outcome: "merged"` (exit 0): the PR merged as `merge_commit`. Go to Phase 5.
- `outcome: "removed"` (exit 1): the queue dropped the PR and it is still open. `detail_url`, `failing_jobs`, and `failure_artifact` describe the failed `merge_group` run; all three are empty when no run failed, as for a conflict or a manual dequeue. Fix it as the merge-queue paragraph above says.
- `outcome: "not_queued"` (exit 1): when the watch began the PR was neither in the queue nor armed for auto-merge, so nothing will merge it. If `gh pr merge` printed an error, fix what it names; otherwise the queue dropped the PR before the watch began, so read why on the PR page and handle it as `removed`.
- `outcome: "stale"` or `"conflicting"` (exit 1): as in 3.1. A push to a queued PR drops it from the queue.
- `outcome: "timed_out"` or `"undetermined"` (exit 2): re-run the watch.

**A refused merge means a gate is unmet.** Read `gh pr checks <PR> --required` and the unresolved conversations, fix what is missing, and merge again. `gh pr merge` is the one merge path: `--admin` is denied to agents (they act through Tim's account, and the ruleset's admin bypass is his), as are the raw API and MCP merge channels.

### 4.2 Escape hatches (Tim decides; you can inform, not invoke)

When a gate cannot pass for reasons unrelated to the change (an infrastructure flake, a broken workflow, an emergency hotfix), tell Tim which gate and why, and let him choose: he merges himself, or uses his admin bypass. Log a GitHub Actions flake first with `bash scripts/workflow/log-gha-flake.sh <pr> <run-id> <class> "<symptom>"` (see `docs/runbooks/gha-flake-log.md`). Do not suggest a bypass when a merge conflict exists or the change has not been manually verified safe.

### 4.3 Dependabot PRs: back-to-back lockfile merges

When two or more Dependabot PRs that both touch `pnpm-lock.yaml` (or any lockfile) are open at once, the second can carry a lockfile that is broken against current `main`.

**The trap:** each Dependabot PR's lockfile diff adds entries in slightly different alphabetical zones based on its own snapshot of main. After the first PR merges, git's textual three-way merge of the second doesn't see a conflict because the additions live in non-overlapping line ranges — but both PRs may add the _same_ transitive dep (e.g., `brace-expansion@5.0.6`). The merged lockfile carries a duplicated mapping key, which `pnpm install --frozen-lockfile` rejects with `ERR_PNPM_BROKEN_LOCKFILE`.

**Why `rebase-strategy: auto` in `.github/dependabot.yml` doesn't save you:** "auto" means Dependabot rebases when _the dependency version_ is out of date, not when _the lockfile region_ has shifted under it. Two independent Dependabot PRs against the same main can both stay "current" by Dependabot's definition while their lockfile diffs collide.

**What the up-to-date rule changes:** the ruleset requires the branch current with `main`, so the second PR must be updated before it can merge, and the duplicate key then fails the `pnpm install --frozen-lockfile` step of that PR's CI (first in `Static checks, unit tests, build`) instead of breaking `main`. A red install step with `ERR_PNPM_BROKEN_LOCKFILE` on an updated Dependabot PR is this trap, not a flake.

**Rule:** after the first of two lockfile-touching Dependabot PRs merges, comment `@dependabot rebase` on each remaining one (Dependabot's own command: it regenerates the lockfile against current `main`, which dedupes the entry). `gh pr update-branch <PR>` also brings it current, but a textual merge keeps the duplicate, so prefer the Dependabot rebase for lockfile PRs. Wait for the regenerated PR's CI before reporting it ready.

**Casework:** 2026-05-19 — PRs #1379 and #1381 each added `brace-expansion@5.0.6:` to `packages:` independently. Both merged within ~1 minute, before branches had to be up to date. Main's `Setup Dependencies` broke until a manual dedup of `pnpm-lock.yaml` was bundled into PR #1383.

---

## Phase 5: after the merge

Work isn't done at "git push" — it's done when the change is **merged, deployed clean, and cleaned up**.

### 5.1 Main's CI verdict, and the deployment if the PR could break it

**Main's CI verdict.** Main runs one CI run at a time (`ci.yml` concurrency, PP-yva7.7): a merge that lands during a main run waits, and a newer merge cancels the waiting run, so your merge's own run may read `cancelled`. Each main run tests every change since the last main commit a run passed on, so a later run covers your merge. Find it in `gh run list --branch main --workflow CI --event push --limit 20`: the oldest non-cancelled run at or after your merge whose E2E jobs ran (`gh run view <id>`). On red, the suspects are the commits since the last green main run. Re-running a main run while a newer merge's run is waiting cancels that waiting run.

**The deployment.** After Tim merges, consider watching the deployment — only if the PR could break it. A merge that breaks prod isn't done, so when the change actually reaches the deployed app, it's worth watching the production deploy land and confirming no build, migration, or runtime errors. That means: anything under `src/`, a migration, a dependency or `next.config.ts` change, an env-registry change, or anything on the `vercel-build` path. **Skip it otherwise** — docs, skills, beads, GitHub workflows, and dev-only scripts can't affect the deploy, and watching a run that was never at risk just burns time. This is a judgement call, not a mandate; if you're not present when Tim merges, it's his to do or to ask you to pick back up.

### 5.2 Cleanup — non-destructive now, destructive on confirmation

Close the bead, file genuine follow-up beads, and hand off freely. For destructive cleanup beyond the merged branch's own worktree (deleting other branches or volumes), wait for explicit confirmation.

**Stop the merged branch's services.** Once the PR merges, stop the dev server you started (`pnpm run dev:stop` from inside the worktree, or `preview_stop` for one `preview_start` launched) and the worktree's Supabase stack (`pnpm supabase:stop` from inside the worktree — data is kept, `pnpm supabase:start` brings it back). A merged branch's stack is idle memory on a host running several of them. Skip it when you have a concrete reason the stack is still in use: follow-up work in this same worktree is next, Tim is still looking at the preview, or another session shares the stack. Say which you did in the hand-off.

**Then reap the merged worktree:**

```bash
python3 scripts/worktree_reap.py --apply --branch <branch>
```

It removes the merged branch's worktree, its Supabase stack and volumes, and its slot, only on positive proof (the merged PR's head is local `HEAD` and the tree is clean); anything else it leaves alone and reports. A worktree that still holds a live process, your own session's shell included, reads KEEP and stays; a later run from another session, or the SessionStart reap nudge, reclaims it. If it reports the volume state `UNKNOWN`, run `python3 scripts/worktree_reap.py --apply` once the daemon is reachable. Skip the reap for the same reasons you skip stopping the stack.

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
- Spec: `docs/feature-specs/pr-lifecycle-monitoring.md`
