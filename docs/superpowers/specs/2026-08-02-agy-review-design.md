# Design — agy (Antigravity CLI) as PinPoint's gate-satisfying PR reviewer

**Bead:** PP-c6xz · **Date:** 2026-08-02 · **Status:** design approved, not implemented

## Why

GitHub Copilot review is out of quota. On 2026-08-01 the allowance reset at ~02:00 UTC and
was exhausted by 20:57 UTC — 42 delivered reviews across 19 PRs, consistent with a
50-premium-request/month plan. More than half of that spend went to re-reviews of a PR
that had already been reviewed, which is the churn the 2026-08-01 request-only rule was
written to stop; the rule landed the same day it was being violated hardest.

PR #1801 (PP-4ric) retires Copilot outright and leaves the SHA-pinned marker as the only
thing satisfying the `reviewed` gate — which makes getting a PR reviewed a handoff to Tim.
This design is the rebuild on the other side of that demolition: Tim's **Google AI Plus**
plan, reached through the Antigravity CLI (`agy`), becomes the routine automated reviewer.

`#1801` deliberately left `_compute_review_state` in `_pr-gates.sh` "shaped for a second
reviewer." This is that second reviewer.

## Decisions

Each of these was decided explicitly; they are not defaults.

| Question                  | Decision                                                                                                                 |
| :------------------------ | :----------------------------------------------------------------------------------------------------------------------- |
| Gate role                 | **Gate-satisfying.** An agy marker and a Claude marker are each independently sufficient.                                |
| Posting                   | **The wrapper posts; agy never touches `gh`.** agy returns findings as JSON.                                             |
| Workspace                 | **Ephemeral detached worktree at the PR head**, created with `HUSKY=0` so no Supabase slot is allocated.                 |
| Permissions               | **Read-only allow-list.** No writes, no `gh`, no network tooling.                                                        |
| Review shape              | **Inline line comments + an overview**, matching what Copilot posted.                                                    |
| Invalid line numbers      | **Fail loudly with a specific error** so agy can correct itself. No silent demotion.                                     |
| Head moved mid-review     | **Post anyway**, with a warning in the overview body.                                                                    |
| Model                     | **Flag-controlled.** Default `gemini-3.6-flash-high`; `--pro` selects `gemini-3.1-pro-high`; `--model M` overrides both. |
| Where the procedure lives | **`pinpoint-pr-workflow` Phase 3.4.** No new skill.                                                                      |

## Architecture

### The pipeline — `scripts/workflow/agy-review.sh <PR> [--pro] [--model M] [--dry-run]`

1. Resolve `head_sha` from `gh pr view <PR> --json headRefOid`; `git fetch origin pull/<PR>/head`.
2. `HUSKY=0 git worktree add --detach <scratch>/agy-<PR>-<sha7> <head_sha>`, with a trap-on-exit
   teardown (`HUSKY=0 git worktree remove --force`) that runs on every exit path.
   `HUSKY=0` is load-bearing: `git worktree add` is a branch checkout, which fires
   `.husky/post-checkout` → `worktree_setup.py` → a Supabase slot, ports, and an `.env.local`
   that a read-only review has no use for and would leak on an unclean exit.
3. Write `<scratch>/pr-<PR>.diff` from `git diff --merge-base origin/main <head_sha>`.
4. Run agy from inside that worktree:
   `agy -p '<prompt>' --model <model> --print-timeout 15m`
   The worktree gives agy the repo exactly as it would merge — changed files in final form
   plus `matrix.ts`, `REVIEW.md`, and `.agents/skills/` at that commit — so cross-file checks
   ("does the permission matrix still agree?") read the right state.
5. Extract the JSON block from stdout; validate against the contract below.
6. Validate every finding's line against the diff hunks (see "Line validation").
7. Re-read head SHA. If it moved, continue — but prepend a warning to the overview body.
8. `POST /repos/{owner}/{repo}/pulls/<PR>/reviews` with `commit_id`, `event=COMMENT`,
   `body`, and `comments[]`.
9. **Only on 2xx**, write the sticky marker `<!-- pinpoint-agy-review: <reviewed_sha> -->`.

Step 9 is the only writer of the marker, and agy has no `gh` access, so agy cannot attest to
its own review. No valid JSON → no review → no marker → no gate pass.

### Why the head-moved case needs no special handling

The marker is pinned to the SHA that was actually reviewed. If head moved during the run, the
marker carries the older SHA, and gate 4's existing SHA comparison reports `stale_marker` on
its own. The review still posts because it is still useful; it just does not clear the gate.
No new branch in the gate logic.

### Identity

`gh` is authenticated as `timothyfroehlich`, so the review posts under Tim's account, not a bot
identity. Two consequences:

- `event` must be `COMMENT`. GitHub rejects `APPROVE`/`REQUEST_CHANGES` on your own PR.
- Every comment body is signed `—Antigravity` by the wrapper, so a reader can tell an agy
  finding from one Tim wrote by hand.

## The JSON contract

agy returns exactly one JSON object:

```
{
  "summary": "<markdown overview>",
  "findings": [
    {
      "path":     "src/lib/foo.ts",
      "line":     42,
      "side":     "RIGHT",
      "severity": "high" | "medium" | "low",
      "rule":     "CORE-SEC-007" | null,
      "body":     "<markdown comment>"
    }
  ]
}
```

The wrapper — not agy — appends the `—Antigravity` signature to each `body`. An empty
`findings` array is a valid, expected outcome: `REVIEW.md` says a clean review is a real
result and nits must not be manufactured to justify a pass.

## Line validation

GitHub only accepts an inline comment on a line present in that file's diff hunks. A single
bad line number 422s the entire POST and nothing lands.

The wrapper parses the hunk headers in `pr-<PR>.diff` and builds the valid RIGHT-side line set
per file. Every finding is checked before anything is posted. On failure it re-prompts agy with
a specific, actionable error:

```
findings[2]: src/lib/foo.ts:91 is not in the diff.
Valid RIGHT-side lines for that file: 12-34, 58-72.
```

Bounded retries (2), then hard-fail: exit non-zero, post nothing, write no marker, and save the
raw agy output for inspection. Findings are never silently demoted into the summary body — a
demoted finding creates no thread, and a finding with no thread cannot block gate 3.

## Gate changes

Both are small, and the larger one is "no change."

- **Gate 3 (`threads`)** — **no change.** After #1801 it counts unresolved threads from _any_
  author, so agy's inline threads block merge with no new machinery. This is what satisfies the
  requirement that unresolved findings block the gate. An earlier draft added a hidden
  `<!-- pinpoint-agy-finding -->` discriminator to identify agy threads by something other than
  author login; #1801 makes it unnecessary and it is dropped.
- **Gate 4 (`reviewed`) / `_compute_review_state`** — one new marker constant and one new state.
  `<!-- pinpoint-agy-review: <sha> -->` PASSes when its SHA is head and reports `stale_marker`
  when it is not, exactly parallel to the existing Claude marker. Both markers are independently
  sufficient.

Nothing else. There is no `currency` gate to touch (#1801 deletes it), and no `pr-watch`
review-polling thread to restore — agy never reviews unprompted.

## agy permissions

`~/.gemini/antigravity-cli/settings.json` currently holds only `colorScheme` and
`trustedWorkspaces`; there is no `permissions` block, which is why a headless `agy -p` run
auto-denies any tool needing the `command` permission and produces no output.

Rule vocabulary (confirmed against the v1.1.7 binary): `permissions.allow` / `permissions.deny`
taking `command(...)`, `read_file(...)`, `write_file(...)`, `mcp(...)`, `browser(...)`; also
`autoExecutionPolicy`, `allowedCommands`, `deniedCommands`.

Allow: `read_file(*)`, `command(rg)`, `command(fd)`, `command(cat)`, and read-only git
(`git show`, `git diff`, `git log`). Deny: `write_file(*)`, `command(gh)`.

Because the wrapper does all posting, agy genuinely needs zero write capability. This matters
more than it looks: the settings file appears to be **global**, so these rules likely apply to
every agy session on the machine, not just PinPoint. A tight list is the safe default for a rule
set that leaks. **Open item:** confirm whether a workspace-scoped settings file exists; if it
does, scope the rules there instead.

## Failure modes

| Condition                             | Behavior                                                                                                    |
| :------------------------------------ | :---------------------------------------------------------------------------------------------------------- |
| agy times out (15m)                   | Exit non-zero. No review, no marker. Worktree torn down by trap.                                            |
| No JSON / unparseable JSON            | Exit non-zero, raw output saved for inspection. No marker.                                                  |
| Finding cites a line outside the diff | Re-prompt agy with the exact valid ranges; 2 retries; then hard-fail.                                       |
| Finding cites a file not in the diff  | Same path — it is a hallucination and the error says so.                                                    |
| Head SHA moved during the review      | Post anyway with a warning in the overview; marker pins the reviewed SHA, so gate 4 reports `stale_marker`. |
| Zero findings                         | Post an overview-only review ("reviewed N files, no findings") and write the marker. A valid pass.          |
| `POST /reviews` non-2xx               | Exit non-zero. No marker.                                                                                   |
| Any exit path                         | Worktree removed by trap.                                                                                   |

## Change surface

1. `scripts/workflow/agy-review.sh` — new.
2. `scripts/workflow/_pr-gates.sh` — one marker constant, one state case.
3. `.agents/skills/pinpoint-pr-workflow/SKILL.md` Phase 3.4 — rewritten from "ask Copilot" to
   "run `agy-review.sh`, then close out every thread."
4. `~/.gemini/antigravity-cli/settings.json` — `permissions.allow` block (not in the repo).
5. `.agents/rules/antigravity.md` — its "Your review does not satisfy the merge gate" line
   becomes false and must be corrected.

### Sequencing

All of it lands **after #1801 merges**. Items 2 and 3 are files that PR rewrites wholesale;
`Claude-CopilotPurge` asked to be pinged before anyone edits them. Post a huddle note before
starting implementation.

## The closeout loop

This is the requirement that inline comments, rather than a prose summary, exist to serve.

After a review posts, Claude enumerates unresolved threads via GraphQL and, for each one,
either fixes the code or replies with a one-sentence decline signed `—Claude`, then resolves
the thread with the `resolveReviewThread` mutation. Every comment gets a fix or a reply; never
a silent ignore. Gate 3 passes only when the count reaches zero, so the loop is enforced rather
than trusted.

This is the same loop `pinpoint-pr-workflow` already documents for review comments. Phase 3.4
points at it rather than restating it.

## Testing plan

- **Phase 0 — permissions.** Write the `permissions.allow` block. Verify a headless read-only
  probe runs to completion with no prompt and no denial. Confirm whether the settings file is
  global or workspace-scoped.
- **Phase 1 — prompt iteration.** Claude hands Tim prompts to paste into an interactive `agy`
  session inside a prepared PR worktree. Each candidate is judged on: parseable JSON on the
  first try, diff-valid line numbers, real `CORE-*` citations, real findings without
  manufactured nits. Compare flash against pro on the same PR before fixing the default.
- **Phase 2 — `--dry-run`.** The wrapper builds and prints the exact API payload and posts
  nothing.
- **Phase 3 — live.** Post on a real PR, then run the closeout loop end to end and confirm
  gates 3 and 4 both go green.

## Out of scope

- Auto-review on push. agy reviews only when dispatched, matching the request-only model.
- Replacing Tim's `/code-review`. The Claude marker remains independently sufficient.
- Any use of the `claude-*` models agy exposes — routing through agy to reach Claude defeats
  the point of moving onto the Google AI Plus plan.
