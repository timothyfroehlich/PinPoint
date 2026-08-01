# PR Workflow Scripts

Bash/Node scripts for managing GitHub PR lifecycle: CI monitoring, UI screenshots, readiness labeling, and human-only gate-enforced merge.

## Architecture

Scripts are designed for the **PinPoint orchestrator workflow** where multiple subagents work in parallel worktrees. The orchestrator (or a human) uses these from the main repo to monitor and manage PRs created by agents.

**Merging is human-only (PP-wi85).** `merge-pr.sh` is blocked for agents by the `block-direct-merge.cjs` PreToolUse hook, in ANY invocation shape (including `--dry-run`) — there is no agent bypass. Agents run every other script in this directory freely, including `pr-screenshots.mjs` and `mark-claude-review.sh`; only `merge-pr.sh` itself is off-limits. Tim runs it directly (`scripts/workflow/merge-pr.sh <PR> --human`) once an agent hands the PR off as ready.

## Scripts

### PR Monitoring

| Script                    | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pr-dashboard.sh [PR...]` | Status table: CI checks, Copilot review state, merge state, draft state. All open PRs if no args. The Copilot column shows the unresolved-thread count when there are any (they need action now), otherwise the review state: `reviewed`, `marker`, `awaiting`, `OVERDUE`, `RE-REQUEST` (`pushed_after`), `NOT ASKED` (`never_requested`).                                                                                    |
| `pr-watch.py <PR>`        | Stream CI run events. One timestamped line per event. Use with the Claude Code Monitor tool. Writes failure artifacts to `tmp/gh-monitor/`. `--check-ready` also reports a `copilot-review` line naming the review state (the six below, or `unknown` if the API calls fail); it treats `awaiting` as OK (the request resolves by waiting), which the `reviewed` merge gate does not — check-ready green is not "will merge". |

`pr-watch.py` exit codes: **0** passed (or stopped for a new Copilot review), **1** a run or the CI Gate actually failed, **2** the outcome could not be determined — the GitHub API was unreachable (rate-limit 403, network drop, auth failure), so nothing was observed. Exit 2 is not a red CI: re-run the watch once the API is back rather than hunting for a broken test. (PP-qkl8)

### UI Screenshots

| Script                                                   | Purpose                                                                                                                                                                                                                                                     |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pr-screenshots.mjs <PR> [--pages a,b,c] [--force-auth]` | Shoots the pages in `ui-screenshot-manifest.json` at desktop (1440×900) + mobile (390×844), pushes PNGs to the orphan `pr-screenshots` branch, posts/updates one sticky PR comment (marker `<!-- pr-screenshots -->`). Agent-runnable — not a merge action. |
| `ui-screenshot-manifest.json`                            | Page manifest: id → `{ label, route, authRole, seedNeeds }`. Edit to add/remove shot targets.                                                                                                                                                               |

### Readiness and Merge

| Script                                 | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `merge-pr.sh <PR> --human [-a]`        | **Human-only — blocked for agents.** Re-evaluates all 5 gates (`ci`, `currency`, `threads`, `reviewed`, `no_conflict`) and squash-merges if all pass. Removes ready-for-review label on failure. `--human` is required to actually merge (defense-in-depth for non-Claude-Code harnesses); `--dry-run` doesn't need it but agents can't run the script at all inside Claude Code, dry-run included. `-a`/`--automerge` polls until the gates go green (merge), a gate hard-fails (stop, exit 1), or the budget expires (stop, exit 2, PR untouched). It does **not** wait out an unreviewed head: `reviewed` only WAITs while a review request newer than head is outstanding, so with no such request it hard-fails on the **first** poll. Request the review before firing it; only if Copilot is quota-limited or has already skipped does `mark-claude-review.sh` stand in. |
| `mark-claude-review.sh <PR> [summary]` | Posts/updates a sticky SHA-pinned Claude-review marker comment (`<!-- pinpoint-claude-review: <head_sha> -->`) that satisfies the `reviewed` gate. Reach for it when Copilot was asked and could not answer (the `overdue` state) — a marker mechanically clears `pushed_after` and `never_requested` too, but the sanctioned remedy for those is to ask, and both gates say so in a note.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `_pr-gates.sh`                         | Shared bash helper sourced by merge-pr.sh. Defines the gate functions.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

### Gates (evaluated by `merge-pr.sh`, defined in `_pr-gates.sh`)

| Gate          | Passes when                                                                                                                                                                                                  | Bypass kind |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------- |
| `ci`          | `CI Gate` check is SUCCESS/NEUTRAL/SKIPPED                                                                                                                                                                   | `admin`     |
| `currency`    | Soft report of where the PR stands with its reviewer. PASS on `marker`/`covered`, WAIT on `awaiting`, WARN-and-proceed on `overdue`/`pushed_after`/`never_requested`. Never hard-fails on a recognised state | `force`     |
| `threads`     | Zero unresolved Copilot review threads                                                                                                                                                                       | `force`     |
| `reviewed`    | Hard backstop — head must be covered. PASS on `marker`/`covered`, WAIT on `awaiting` only, FAIL on `overdue`/`pushed_after`/`never_requested`                                                                | `force`     |
| `no_conflict` | PR is MERGEABLE (never bypassable — GitHub rejects conflicting merges)                                                                                                                                       | `none`      |

A Copilot review whose body says it could not review (quota limit, nothing to analyze) is **not** counted as a review by either review-state gate — it carries a real login and timestamp, so counting it made both gates green on a review that read nothing (PP-jw0s).

### Review state (shared by `currency` and `reviewed`)

**Since 2026-08-01 only the PR-open review fires automatically; a push past it needs an explicit `gh pr edit <PR> --add-reviewer "@copilot"`.** Both gates are built around that. They answer one question — where does this PR stand with its reviewer? — from one shared computation (`_compute_review_state` in `_pr-gates.sh`), so they cannot drift apart the way they once did. It reports six states, and the two gates differ only in how they map them:

| State             | Meaning                                                         | `currency` | `reviewed` |
| ----------------- | --------------------------------------------------------------- | ---------- | ---------- |
| `marker`          | A SHA-pinned Claude review marker covers head                   | PASS       | PASS       |
| `covered`         | A substantive Copilot review carries head's SHA                 | PASS       | PASS       |
| `awaiting`        | A request newer than head is outstanding, under 600s old        | WAIT       | WAIT       |
| `overdue`         | Same, past 600s — Copilot was asked and did not answer          | WARN       | FAIL       |
| `pushed_after`    | Head is newer than the newest request — you pushed after asking | WARN       | FAIL       |
| `never_requested` | No Copilot `review_requested` event exists on this PR at all    | WARN       | FAIL       |

`marker` and `covered` are decided before the request clock is consulted, so a head that already has a documented review never sits out a timer. `awaiting` is the only state waiting resolves; the other three are terminal, and each names the one action that clears it. The merge bar itself is unchanged — a review covering head is still required. What changed is _when_ the wait is spent and how precisely the non-covering states are named.

**The 600s window is measured from the review request, not from the head push (PP-lzaw).** Under request-only Copilot a timer keyed to the push counts down against a review nobody asked for, so every un-re-requested PR lands on the `reviewed` FAIL whose documented remedy is the Claude marker. That makes the marker the default path rather than the fallback, gutting the guarantee the gate exists to provide. A timer only makes sense once someone has actually asked, so `awaiting` is the only state it applies to. `--add-reviewer` re-requests when Copilot is already assigned, so it is the right command whether or not a request already exists.

**Coverage is judged by the review's `commit_id`, not by comparing `submitted_at` against the head commit date (PP-lzaw).** Copilot stamps every review with the commit it actually read; the timestamp comparison reported "covers head" for a review of an earlier tree that happened to be submitted after a later push (observed on PR #1784). Any matching review counts, not just the newest — a review whose `commit_id` is head demonstrably read head, whatever landed after it.

Two things to know when reading a verdict:

- **`pushed_after` can be a lag artifact.** The request clock comes from the issue timeline, which is eventually consistent and can trail a fresh `review_requested` event by up to a minute. When Copilot is a pending reviewer right now, both gates append a note saying so — re-run before acting on it. A pending request is never treated as coverage: Copilot reviews the head as of the **request**, not as of when it runs.
- **"Newer than head" is measured against the head commit's committer date**, because GitHub exposes no push timestamp for a PR head. The two can differ, so a state can be named wrongly for a while (typically `awaiting`/`overdue` where `pushed_after` was meant). Neither skew can open a merge path — coverage itself is decided by `commit_id`.

`never_requested` does not occur in practice while the repo's PR-open auto-request is enabled (it fires ~1s after PR creation). It is kept distinct so the gate still means something the moment that setting is turned off. `pushed_after` is the state that actually bites today.

A Claude marker that covers a head no request covers still PASSes, but both gates print a note saying the marker is standing in — it is the fallback for a request Copilot did not answer, not a substitute for asking.

## Status Token Vocabulary

Scripts emit machine-parseable status with these prefixes:

| Token    | Meaning                                                     | Action                        |
| -------- | ----------------------------------------------------------- | ----------------------------- |
| `PASS:`  | Gate passed                                                 | Continue                      |
| `FAIL:`  | Hard failure                                                | Block; fix underlying issue   |
| `WAIT:`  | Transient state (e.g., GitHub computing mergeable)          | Retry; may resolve on its own |
| `WARN:`  | Soft gate proceeding with a notice                          | Read the notice; not blocking |
| `BLOCK:` | State mismatch requiring user action (e.g., merge conflict) | Resolve, push, retry          |

The agent reads these tokens from script stdout to decide next steps. The skill (pinpoint-pr-workflow) documents what to do for each token; scripts emit prescriptive advice only where the remedy is otherwise undiscoverable. That is the two review-state gates: every `reviewed` FAIL, and `currency`'s `pushed_after` and `never_requested` warnings, are followed by indented continuation lines naming the one action that clears the state, PR number already substituted (PP-jw0s, PP-lzaw). Only `overdue` offers `mark-claude-review.sh`; the other two name the `--add-reviewer` command instead, because offering the marker on "you never asked" is what turns the fallback into the default path. Both gates also append a `note:` when a Claude marker is standing in for a request nobody made, and when a `pushed_after` verdict is probably timeline lag. Continuation lines are indented and carry no status token, so token parsing is unaffected.

## MCP vs Script — When to use which

The pinpoint-pr-workflow skill defaults to MCP tools for per-operation reads and writes. Scripts handle composite enforcement.

| Operation                                      | Use MCP                                        | Use Script                                                                                                   |
| ---------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Read PR metadata, reviews, threads, check_runs | `pull_request_read(method: ...)`               | —                                                                                                            |
| Apply/remove PR label                          | `issue_write(method: "update", labels: [...])` | —                                                                                                            |
| Get failed CI logs                             | `get_job_logs(failed_only, tail_lines)`        | —                                                                                                            |
| Stream CI runs in real time                    | —                                              | `pr-watch.py`                                                                                                |
| Merge a PR                                     | —                                              | `merge-pr.sh --human` (human-only — blocked for agents via ANY invocation shape)                             |
| Composite gate evaluation                      | —                                              | `merge-pr.sh` (sources `_pr-gates.sh`) — Tim runs it; an agent cannot invoke it at all, not even `--dry-run` |
| Post UI screenshots                            | —                                              | `pr-screenshots.mjs` (agent-runnable)                                                                        |

MCP field-naming gotcha: responses use snake_case (`is_resolved`, `submitted_at`, `head.sha`). GraphQL we previously used was camelCase.

## Key Design Decisions

- **MCP first for reads and per-op writes**: typed tool calls beat shell-escaped gh CLI for the agent's use cases. Scripts wrap composite enforcement that can't be a single API call.
- **Mechanical script output**: scripts emit status tokens (PASS, WARN, WAIT, FAIL, BLOCK) and the skill documents what to do per token. The review-state gates are the deliberate exception — they append indented continuation lines (`remedy:`, `note:`, a bare instruction), because which of six states you are in decides the action and the token alone doesn't say.
- **Merge is human-only (PP-wi85)**: `gh pr merge`, MCP `merge_pull_request`, AND `scripts/workflow/merge-pr.sh` itself (any flags, including `--dry-run`) are all blocked for an agent by the `.claude/hooks/block-direct-merge.cjs` PreToolUse hook. There is no agent-usable bypass — the old `.claude-merge-bypass` sentinel was removed entirely. `merge-pr.sh` also refuses to execute a merge without `--human` at the script level, as defense-in-depth for harnesses that don't wire the Claude Code hook.
- **Fail closed on API errors**: gates that can't determine state exit non-zero.

## Dependencies

- `gh` CLI (authenticated)
- `jq` for JSON processing
- `python3` (for `pr-watch.py`)

## Related Docs

- `.agent/skills/pinpoint-pr-workflow/SKILL.md` — Full skill documenting token responses and MCP call sequences
- `.agent/skills/pinpoint-orchestrator/SKILL.md` — Orchestrator workflow referencing these scripts
