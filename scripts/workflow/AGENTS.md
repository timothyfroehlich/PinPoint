# PR Workflow Scripts

Bash/Node scripts for managing GitHub PR lifecycle: CI monitoring, UI screenshots, readiness labeling, and the gate-enforced, Tim-approved merge.

## Architecture

Scripts are designed for the **PinPoint orchestrator workflow** where multiple subagents work in parallel worktrees. The orchestrator (or a human) uses these from the main repo to monitor and manage PRs created by agents.

**The merge decision is Tim's (PP-wi85, reversed for the script per Tim 2026-08-19).** An agent MAY run `merge-pr.sh`, but the `block-direct-merge.cjs` PreToolUse hook turns any invocation of it (including `--dry-run`) into an approval prompt Tim must accept before it runs — the merge is still his call. The raw channels (`gh pr merge`, `gh api PUT .../merge`, MCP `merge_pull_request`) stay hard-blocked, because they skip the script's gate re-checks. Agents run every other script in this directory freely, including `pr-screenshots.mjs`, `mark-review.sh`, and `merge-handoff.sh` (which _prints_ the merge command). The normal close is still a handoff: an agent finishes the PR and either runs `scripts/workflow/merge-pr.sh <PR> --human` (Tim approves the prompt) or hands Tim the command to run himself.

## Scripts

### PR Monitoring

| Script                    | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pr-dashboard.sh [PR...]` | Status table: CI checks, review state, merge state, draft state. All open PRs if no args. The Review column shows the unresolved-thread count when there are any (they need action now), otherwise the review state: `reviewed`, `RE-REVIEW` (`stale_marker`), `NOT REVIEWED` (`unreviewed`).                                                                                                                                                                                                                                                     |
| `pr-watch.py <PR>`        | Stream CI run events. One timestamped line per event. Use with the Claude Code Monitor tool. Writes failure artifacts to `tmp/gh-monitor/`. Unresolved threads print a reminder but do **not** stop the watch — watching CI is a step _inside_ the fix→push→resolve loop. `--check-ready` also reports a `review` line naming the review state (the three below, or `unknown` if the API calls fail) — reported, not gated: this mode answers "is this PR worth Tim's `/codex:review`?", and the review is what happens after that answer is yes. |

`pr-watch.py` exit codes: **0** passed, **1** a run or the CI Gate actually failed, **2** the outcome could not be determined — the GitHub API was unreachable (rate-limit 403, network drop, auth failure), so nothing was observed. Exit 2 is not a red CI: re-run the watch once the API is back rather than hunting for a broken test. (PP-qkl8)

### UI Screenshots

| Script                                                   | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pr-screenshots.mjs <PR> [--pages=a,b,c] [--force-auth]` | Shoots the pages in `ui-screenshot-manifest.json` at desktop (1440×900) + mobile (390×844), pushes PNGs to the orphan `pr-screenshots` branch, posts/updates one sticky PR comment (marker `<!-- pr-screenshots -->`). Agent-runnable — not a merge action. `--pages` needs the **equals** form; the space form errors. A filtered run rebuilds the sticky comment from only the pages it shot, so end with an unfiltered run. |
| `ui-screenshot-manifest.json`                            | Page manifest: id → `{ label, route, authRole, seedNeeds }`. Edit to add/remove shot targets.                                                                                                                                                                                                                                                                                                                                  |

### Readiness and Merge

| Script                                              | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `merge-handoff.sh <PR>`                             | **Agent-runnable, read-only.** Prints the merge handoff block: review depth + how many commits back it was, CI, threads, mergeable + distance behind main, last merge-from-main, diff split src/tests/docs/other, diff since the review, migrations, newly-registered env vars, UI + screenshots, bead. Ends with two `!`-prefixed commands — re-run the report, and merge. The merge command is printed **only** when all four gates pass. Fetches via `refs/pull/<PR>/head`, reads both sides off `FETCH_HEAD`, and passes `--refmap=` so the base fetch does not fast-forward `origin/main` through the configured refspec — it updates no ref and works from any worktree. If `gh` and the pull ref disagree about head, it says so and blocks: the gate answers would be about one commit and the diff about another.                 |
| `merge-pr.sh <PR> --human [-a]`                     | **Merge decision is Tim's — an agent may run it, the hook prompts him to approve.** Re-evaluates all 4 gates (`ci`, `threads`, `reviewed`, `no_conflict`) and squash-merges if all pass. Removes ready-for-review label on failure. `--human` is required to actually merge (defense-in-depth for non-Claude-Code harnesses); `--dry-run` doesn't need it. Inside Claude Code the `block-direct-merge.cjs` hook turns any invocation (dry-run included) into an approval prompt. `-a`/`--automerge` polls until the gates go green (merge), a gate hard-fails (stop, exit 1), or the budget expires (stop, exit 2, PR untouched). It does **not** wait out an unreviewed head: `reviewed` never WAITs, so an unattested head hard-fails on the **first** poll. Get Tim's `/codex:review` and attest the completed result before firing it. |
| `review-preflight.sh <PR>`                          | Checks that a Codex review launched here would actually cover this PR — right branch, local HEAD == the pushed head, clean tree, non-empty `main...HEAD` — then prints the `/codex:review` command for Tim and the matching `mark-review.sh`. Prints **no** command when a check fails. `/codex:review` reviews local git state and never reads the PR, so a run from the wrong worktree finds nothing and is indistinguishable from a clean review; this is the step that catches that. The base is always `main` and is not a parameter — it has to match a pair `mark-review.sh` accepts, and only `base-main` is one. Exit 0 ready, 1 not ready, 2 usage.                                                                                                                                                                              |
| `mark-review.sh <PR> <reviewer> <detail> [summary]` | Posts/updates a sticky SHA-pinned review marker comment (`<!-- pinpoint-review: <head_sha> -->`) — the only thing that satisfies the `reviewed` gate. For Codex, the only accepted pair is `codex-plugin-cc base-main`, attesting a completed `/codex:review`. A marker for a review nobody ran is a false attestation, not a shortcut. `mark-claude-review.sh` remains a compatibility wrapper for legacy Claude records.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `_pr-gates.sh`                                      | Shared bash helper sourced by `merge-pr.sh` and `merge-handoff.sh`. Defines the gate functions and the review-marker lookup (`_marker_record`, whose first two fields are `_marker_verdict` — one implementation, so the gate and the handoff report cannot disagree about whether head was reviewed).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |

### Gates (evaluated by `merge-pr.sh`, defined in `_pr-gates.sh`)

| Gate          | Passes when                                                                                         | Bypass kind |
| ------------- | --------------------------------------------------------------------------------------------------- | ----------- |
| `ci`          | `CI Gate` check is SUCCESS/NEUTRAL/SKIPPED                                                          | `admin`     |
| `threads`     | Zero unresolved review threads, from any author                                                     | `force`     |
| `reviewed`    | Hard backstop — head must be reviewed. PASS on `marker` only; FAIL on `stale_marker` / `unreviewed` | `force`     |
| `no_conflict` | PR is MERGEABLE (never bypassable — GitHub rejects conflicting merges)                              | `none`      |

### Review state (`reviewed`)

**Copilot review was retired on 2026-08-02 (PP-4ric).** The primary review that satisfies the gate is Codex, run by Tim with `/codex:review` — the plugin marks that command `disable-model-invocation`, so an agent cannot launch it. Run `review-preflight.sh <PR>` before asking: the review reads local git state, not the PR, so one launched from the wrong worktree reviews an empty diff and reports nothing, which reads as a clean review. `mark-review.sh` records only a completed result for the exact head SHA. The exception is a genuinely trivial change (a typo, a comment, a one-line mechanical fix), where the marker summary should say why it was trivial.

`_compute_review_state` in `_pr-gates.sh` reports three states:

| State          | Meaning                                         | `reviewed` |
| -------------- | ----------------------------------------------- | ---------- |
| `marker`       | **Some** review marker pins head's SHA          | PASS       |
| `stale_marker` | Markers exist, none pins head — newest reported | FAIL       |
| `unreviewed`   | No marker on this PR at all                     | FAIL       |

The `marker` test is membership — does _any_ marker pin head — not "does the newest one". A PR normally carries exactly one, since `mark-review.sh` rewrites a single sticky comment, but a second session or a hand-posted comment can leave two. If reader and writer each picked a comment and picked differently, re-attesting would rewrite one the gate never reads, and a genuinely reviewed head would report `stale_marker` forever with `--force` as the only way out.

Nothing here WAITs. Under Copilot a request could be outstanding with an answer genuinely on its way, so `awaiting` was a legitimate hold; with no bot in the loop there is no such state, and a WAIT would poll for an hour before timing out on a review that was never going to arrive on its own.

**`stale_marker` is the one worth reading carefully.** It is the successor to the old `pushed_after` and the same trap: the PR visibly HAS a review, so the reflex is to read the gate as flaky rather than as "the commit about to merge was never looked at". Nothing re-attests automatically, and that is deliberate — a 3-commit fixup should not inherit the review of the commit before it. Get a fresh `/codex:review` after every changed head.

**Coverage is judged by SHA equality, not by timestamps.** The marker pins the commit that was actually reviewed. Comparing "the review is newer than the push" instead reported "covers head" for a review of an earlier tree submitted after a later push (observed on PR #1784, under the old Copilot gate — the failure mode is the reviewer-independent one, so the SHA comparison stays).

## Status Token Vocabulary

Scripts emit machine-parseable status with these prefixes:

| Token    | Meaning                                                     | Action                        |
| -------- | ----------------------------------------------------------- | ----------------------------- |
| `PASS:`  | Gate passed                                                 | Continue                      |
| `FAIL:`  | Hard failure                                                | Block; fix underlying issue   |
| `WAIT:`  | Transient state (e.g., GitHub computing mergeable)          | Retry; may resolve on its own |
| `WARN:`  | Soft gate proceeding with a notice                          | Read the notice; not blocking |
| `BLOCK:` | State mismatch requiring user action (e.g., merge conflict) | Resolve, push, retry          |

The agent reads these tokens from script stdout to decide next steps. Scripts emit prescriptive advice only where the remedy is otherwise undiscoverable. That is the `reviewed` and `threads` gates: every FAIL is followed by indented continuation lines naming the action that clears it, PR number already substituted. The `reviewed` remedy names **all three** steps — preflight, Tim runs `/codex:review`, then the agent attests — because printing `mark-review.sh` alone reads as "attest and move on", which is the false attestation the gate exists to prevent. Continuation lines are indented and carry no status token, so token parsing is unaffected.

## MCP vs Script — When to use which

The pinpoint-pr-workflow skill defaults to MCP tools for per-operation reads and writes. Scripts handle composite enforcement.

| Operation                                      | Use MCP                                        | Use Script                                                                                                  |
| ---------------------------------------------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Read PR metadata, reviews, threads, check_runs | `pull_request_read(method: ...)`               | —                                                                                                           |
| Apply/remove PR label                          | `issue_write(method: "update", labels: [...])` | —                                                                                                           |
| Get failed CI logs                             | `get_job_logs(failed_only, tail_lines)`        | —                                                                                                           |
| Stream CI runs in real time                    | —                                              | `pr-watch.py`                                                                                               |
| Merge a PR                                     | —                                              | `merge-pr.sh --human` (agent may run it; the hook prompts Tim to approve before it merges)                  |
| Composite gate evaluation                      | —                                              | `merge-pr.sh` (sources `_pr-gates.sh`) — an agent may run it, but every invocation prompts Tim for approval |
| Post UI screenshots                            | —                                              | `pr-screenshots.mjs` (agent-runnable)                                                                       |

MCP field-naming gotcha: responses use snake_case (`is_resolved`, `submitted_at`, `head.sha`). GraphQL we previously used was camelCase.

## Key Design Decisions

- **MCP first for reads and per-op writes**: typed tool calls beat shell-escaped gh CLI for the agent's use cases. Scripts wrap composite enforcement that can't be a single API call.
- **Mechanical script output**: scripts emit status tokens (PASS, WARN, WAIT, FAIL, BLOCK) and the table above says what to do per token. The `reviewed` and `threads` gates are the deliberate exception — they append indented `remedy:` lines, because which state you are in decides the action and the token alone doesn't say.
- **The merge decision is Tim's (PP-wi85, reversed for the script per Tim 2026-08-19)**: an agent MAY run `scripts/workflow/merge-pr.sh` (any flags, including `--dry-run`), but the `.claude/hooks/block-direct-merge.cjs` PreToolUse hook turns every invocation into an approval prompt Tim must accept — a hook `ask` prompts in every permission mode, including bypassPermissions. The raw channels `gh pr merge`, `gh api PUT .../merge`, and MCP `merge_pull_request` stay hard-blocked (they skip the script's gate re-checks); the old `.claude-merge-bypass` sentinel was removed entirely. `merge-pr.sh` also refuses to execute a merge without `--human` at the script level, as defense-in-depth for harnesses that don't wire the Claude Code hook.
- **Fail closed on API errors**: gates that can't determine state exit non-zero.

## Dependencies

- `gh` CLI (authenticated)
- `jq` for JSON processing
- `python3` (for `pr-watch.py`)

## Related Docs

- `.agents/skills/pinpoint-pr-workflow/SKILL.md` — Full skill: the review handoff, the merge handoff, and the MCP call sequences. Status-token responses are the table above, not there.
- `.agents/skills/pinpoint-orchestrator/SKILL.md` — Orchestrator workflow referencing these scripts
