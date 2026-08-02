# PR Workflow Scripts

Bash/Node scripts for managing GitHub PR lifecycle: CI monitoring, UI screenshots, readiness labeling, and human-only gate-enforced merge.

## Architecture

Scripts are designed for the **PinPoint orchestrator workflow** where multiple subagents work in parallel worktrees. The orchestrator (or a human) uses these from the main repo to monitor and manage PRs created by agents.

**Merging is human-only (PP-wi85).** `merge-pr.sh` is blocked for agents by the `block-direct-merge.cjs` PreToolUse hook, in ANY invocation shape (including `--dry-run`) — there is no agent bypass. Agents run every other script in this directory freely, including `pr-screenshots.mjs`, `mark-claude-review.sh`, and `merge-handoff.sh` (which _prints_ the merge command without being able to run it); only `merge-pr.sh` itself is off-limits. Tim runs it directly (`scripts/workflow/merge-pr.sh <PR> --human`) once an agent hands the PR off as ready.

## Scripts

### PR Monitoring

| Script                    | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pr-dashboard.sh [PR...]` | Status table: CI checks, review state, merge state, draft state. All open PRs if no args. The Review column shows the unresolved-thread count when there are any (they need action now), otherwise the review state: `reviewed`, `RE-REVIEW` (`stale_marker`), `NOT REVIEWED` (`unreviewed`).                                                                                                                                                                                                                                                    |
| `pr-watch.py <PR>`        | Stream CI run events. One timestamped line per event. Use with the Claude Code Monitor tool. Writes failure artifacts to `tmp/gh-monitor/`. Unresolved threads print a reminder but do **not** stop the watch — watching CI is a step _inside_ the fix→push→resolve loop. `--check-ready` also reports a `review` line naming the review state (the three below, or `unknown` if the API calls fail) — reported, not gated: this mode answers "is this PR worth Tim's `/code-review`?", and the review is what happens after that answer is yes. |

`pr-watch.py` exit codes: **0** passed, **1** a run or the CI Gate actually failed, **2** the outcome could not be determined — the GitHub API was unreachable (rate-limit 403, network drop, auth failure), so nothing was observed. Exit 2 is not a red CI: re-run the watch once the API is back rather than hunting for a broken test. (PP-qkl8)

### UI Screenshots

| Script                                                   | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pr-screenshots.mjs <PR> [--pages=a,b,c] [--force-auth]` | Shoots the pages in `ui-screenshot-manifest.json` at desktop (1440×900) + mobile (390×844), pushes PNGs to the orphan `pr-screenshots` branch, posts/updates one sticky PR comment (marker `<!-- pr-screenshots -->`). Agent-runnable — not a merge action. `--pages` needs the **equals** form; the space form errors. A filtered run rebuilds the sticky comment from only the pages it shot, so end with an unfiltered run. |
| `ui-screenshot-manifest.json`                            | Page manifest: id → `{ label, route, authRole, seedNeeds }`. Edit to add/remove shot targets.                                                                                                                                                                                                                                                                                                                                  |

### Readiness and Merge

| Script                                         | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `merge-handoff.sh <PR>`                        | **Agent-runnable, read-only.** Prints the merge handoff block: review depth + how many commits back it was, CI, threads, mergeable + distance behind main, last merge-from-main, diff split src/tests/docs/other, diff since the review, migrations, newly-registered env vars, UI + screenshots, bead. Ends with two `!`-prefixed commands — re-run the report, and merge. The merge command is printed **only** when all four gates pass. Fetches via `refs/pull/<PR>/head` and reads both sides off `FETCH_HEAD`, so it updates no ref and works from any worktree.                                                                                                                                                              |
| `merge-pr.sh <PR> --human [-a]`                | **Human-only — blocked for agents.** Re-evaluates all 4 gates (`ci`, `threads`, `reviewed`, `no_conflict`) and squash-merges if all pass. Removes ready-for-review label on failure. `--human` is required to actually merge (defense-in-depth for non-Claude-Code harnesses); `--dry-run` doesn't need it but agents can't run the script at all inside Claude Code, dry-run included. `-a`/`--automerge` polls until the gates go green (merge), a gate hard-fails (stop, exit 1), or the budget expires (stop, exit 2, PR untouched). It does **not** wait out an unreviewed head: `reviewed` never WAITs, so an unattested head hard-fails on the **first** poll. Run `/code-review` and let the agent attest before firing it. |
| `mark-claude-review.sh <PR> <depth> [summary]` | Posts/updates a sticky SHA-pinned review marker comment (`<!-- pinpoint-claude-review: <head_sha> -->`) — the only thing that satisfies the `reviewed` gate. What it attests to is Tim having run `/code-review`; an agent posting it for a review nobody ran is a false attestation, not a shortcut. `<depth>` (`low`\|`medium`\|`high`\|`xhigh`\|`max`\|`ultra`\|`trivial`) records WHICH review ran, in a second HTML comment; it is required because there is no default that would not be a guess (PP-9onv).                                                                                                                                                                                                                   |
| `_pr-gates.sh`                                 | Shared bash helper sourced by `merge-pr.sh` and `merge-handoff.sh`. Defines the gate functions and the review-marker lookup (`_marker_record`, whose first two fields are `_marker_verdict` — one implementation, so the gate and the handoff report cannot disagree about whether head was reviewed).                                                                                                                                                                                                                                                                                                                                                                                                                              |

### Gates (evaluated by `merge-pr.sh`, defined in `_pr-gates.sh`)

| Gate          | Passes when                                                                                         | Bypass kind |
| ------------- | --------------------------------------------------------------------------------------------------- | ----------- |
| `ci`          | `CI Gate` check is SUCCESS/NEUTRAL/SKIPPED                                                          | `admin`     |
| `threads`     | Zero unresolved review threads, from any author                                                     | `force`     |
| `reviewed`    | Hard backstop — head must be reviewed. PASS on `marker` only; FAIL on `stale_marker` / `unreviewed` | `force`     |
| `no_conflict` | PR is MERGEABLE (never bypassable — GitHub rejects conflicting merges)                              | `none`      |

### Review state (`reviewed`)

**Copilot review was retired on 2026-08-02 (PP-4ric)** — the free tier was too small to review PinPoint's PRs, so no bot reviews this repo. The review that satisfies the gate is Tim running `/code-review` over the branch, which an agent **cannot** launch: it is a Claude Code harness built-in only he can trigger. So the review is a handoff, and `mark-claude-review.sh` is what records it. The exception is a genuinely trivial change (a typo, a comment, a one-line mechanical fix), where the marker summary should say why it was trivial.

`_compute_review_state` in `_pr-gates.sh` reports three states:

| State          | Meaning                                         | `reviewed` |
| -------------- | ----------------------------------------------- | ---------- |
| `marker`       | **Some** review marker pins head's SHA          | PASS       |
| `stale_marker` | Markers exist, none pins head — newest reported | FAIL       |
| `unreviewed`   | No marker on this PR at all                     | FAIL       |

The `marker` test is membership — does _any_ marker pin head — not "does the newest one". A PR normally carries exactly one, since `mark-claude-review.sh` rewrites a single sticky comment, but a second session or a hand-posted comment can leave two. If reader and writer each picked a comment and picked differently, re-attesting would rewrite one the gate never reads, and a genuinely reviewed head would report `stale_marker` forever with `--force` as the only way out.

Nothing here WAITs. Under Copilot a request could be outstanding with an answer genuinely on its way, so `awaiting` was a legitimate hold; with no bot in the loop there is no such state, and a WAIT would poll for an hour before timing out on a review that was never going to arrive on its own.

**`stale_marker` is the one worth reading carefully.** It is the successor to the old `pushed_after` and the same trap: the PR visibly HAS a review, so the reflex is to read the gate as flaky rather than as "the commit about to merge was never looked at". Nothing re-attests automatically, and that is deliberate — a 3-commit fixup should not inherit the review of the commit before it. If the pushes were the review's own findings, say so when you re-attest; if they were new work, it needs a fresh `/code-review`.

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

The agent reads these tokens from script stdout to decide next steps. The skill (pinpoint-pr-workflow) documents what to do for each token; scripts emit prescriptive advice only where the remedy is otherwise undiscoverable. That is the `reviewed` and `threads` gates: every FAIL is followed by indented continuation lines naming the action that clears it, PR number already substituted. The `reviewed` remedy names **both** steps — Tim runs `/code-review`, then the agent attests — because printing `mark-claude-review.sh` alone reads as "attest and move on", which is the false attestation the gate exists to prevent. Continuation lines are indented and carry no status token, so token parsing is unaffected.

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
- **Mechanical script output**: scripts emit status tokens (PASS, WARN, WAIT, FAIL, BLOCK) and the skill documents what to do per token. The `reviewed` and `threads` gates are the deliberate exception — they append indented `remedy:` lines, because which state you are in decides the action and the token alone doesn't say.
- **Merge is human-only (PP-wi85)**: `gh pr merge`, MCP `merge_pull_request`, AND `scripts/workflow/merge-pr.sh` itself (any flags, including `--dry-run`) are all blocked for an agent by the `.claude/hooks/block-direct-merge.cjs` PreToolUse hook. There is no agent-usable bypass — the old `.claude-merge-bypass` sentinel was removed entirely. `merge-pr.sh` also refuses to execute a merge without `--human` at the script level, as defense-in-depth for harnesses that don't wire the Claude Code hook.
- **Fail closed on API errors**: gates that can't determine state exit non-zero.

## Dependencies

- `gh` CLI (authenticated)
- `jq` for JSON processing
- `python3` (for `pr-watch.py`)

## Related Docs

- `.agent/skills/pinpoint-pr-workflow/SKILL.md` — Full skill documenting token responses and MCP call sequences
- `.agent/skills/pinpoint-orchestrator/SKILL.md` — Orchestrator workflow referencing these scripts
