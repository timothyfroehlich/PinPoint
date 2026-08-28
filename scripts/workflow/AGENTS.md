# PR Workflow Scripts

Bash/Node scripts for managing GitHub PR lifecycle: CI monitoring, UI screenshots, readiness labeling, and the gate-enforced, Tim-approved merge.

## Architecture

Scripts are designed for the **PinPoint orchestrator workflow** where multiple subagents work in parallel worktrees. The orchestrator (or a human) uses these from the main repo to monitor and manage PRs created by agents.

**The PinPoint merge decision is Tim's (PP-wi85, reversed for the script per Tim 2026-08-19).** An agent MAY run `merge-pr.sh`, but the `block-direct-merge.cjs` PreToolUse hook turns any invocation of it (including `--dry-run`) into an approval prompt Tim must accept before it runs — the merge is still his call. The raw PinPoint channels (`gh pr merge`, `gh api PUT .../merge`, MCP `merge_pull_request`) stay hard-blocked, because they skip the script's gate re-checks. This boundary applies to implicit current-repository targets and explicit `timothyfroehlich/PinPoint` targets; a statically explicit non-PinPoint target follows that repository's policy and the user's authorization. Agents run every other script in this directory freely, including `pr-screenshots.mjs` and `merge-handoff.sh` (which _prints_ the merge command). The normal close follows `pinpoint-pr-workflow`: draft PR, current-head CI, exact-head automatic Codex coverage, resolved threads, final label, then handoff.

## Scripts

### PR Monitoring

| Script                    | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pr-dashboard.sh [PR...]` | Status table: CI checks, review state, merge state, draft state. All open PRs if no args. The Review column shows unresolved threads when there are any, otherwise: `reviewed`, `RE-REVIEW` (`stale_approval`), `NOT APPROVED` (`not_approved`), or `NOT REVIEWED` (`unreviewed`).                                                                                                                                                                                                                                           |
| `pr-watch.py <PR>`        | Stream CI run events. One timestamped line per event. Use with the Claude Code Monitor tool. Writes failure artifacts to `tmp/gh-monitor/`. Unresolved threads print a reminder but do **not** stop the watch — watching CI is a step _inside_ the fix→push→resolve loop. `--check-ready` also reports a `review` line naming the review state (from the vocabulary below, or `unknown` if the API calls fail) — reported, not gated: this mode answers whether the current head can leave draft and enter automatic review. |

`pr-watch.py` exit codes: **0** passed, **1** a run or the CI Gate actually failed, **2** the outcome could not be determined — the GitHub API was unreachable (rate-limit 403, network drop, auth failure), so nothing was observed. Exit 2 is not a red CI: re-run the watch once the API is back rather than hunting for a broken test. (PP-qkl8)

### UI Screenshots

| Script                                                   | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                        |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pr-screenshots.mjs <PR> [--pages=a,b,c] [--force-auth]` | Shoots the pages in `ui-screenshot-manifest.json` at desktop (1440×900) + mobile (390×844), pushes PNGs to the orphan `pr-screenshots` branch, posts/updates one sticky PR comment (marker `<!-- pr-screenshots -->`). Agent-runnable — not a merge action. `--pages` needs the **equals** form; the space form errors. A filtered run rebuilds the sticky comment from only the pages it shot, so end with an unfiltered run. |
| `ui-screenshot-manifest.json`                            | Page manifest: id → `{ label, route, authRole, seedNeeds }`. Edit to add/remove shot targets.                                                                                                                                                                                                                                                                                                                                  |

### Readiness and Merge

| Script                          | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `merge-handoff.sh <PR>`         | **Agent-runnable, read-only.** Prints the merge handoff block: review depth + how many commits back it was, CI, threads, mergeable + distance behind main, last merge-from-main, diff split src/tests/docs/other, diff since the review, migrations, newly-registered env vars, UI + screenshots, bead. Ends with two `!`-prefixed commands — re-run the report, and merge. The merge command is printed **only** when all four gates pass. Fetches via `refs/pull/<PR>/head`, reads both sides off `FETCH_HEAD`, and passes `--refmap=` so the base fetch does not fast-forward `origin/main` through the configured refspec — it updates no ref and works from any worktree. If `gh` and the pull ref disagree about head, it says so and blocks: the gate answers would be about one commit and the diff about another. |
| `merge-pr.sh <PR> --human [-a]` | **Merge decision is Tim's — an agent may run it, the hook prompts him to approve.** Re-evaluates all 4 gates and squash-merges if all pass. `--automerge` never waits out review; the owning agent monitors automatic review outside this script.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| `_pr-gates.sh`                  | Shared bash helper sourced by `merge-pr.sh` and `merge-handoff.sh`. It evaluates both the native Codex GitHub review and the existing manual marker workflow.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

### Gates (evaluated by `merge-pr.sh`, defined in `_pr-gates.sh`)

| Gate          | Passes when                                                                                                                                              | Bypass kind |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `ci`          | `CI Gate` check is SUCCESS/NEUTRAL/SKIPPED                                                                                                               | `admin`     |
| `threads`     | Zero unresolved review threads, from any author                                                                                                          | `force`     |
| `reviewed`    | Hard backstop — an automatic Codex review or manual marker must cover head. PASS on `approval` / `clean_comment` / `reviewed` / `marker`; FAIL otherwise | `force`     |
| `no_conflict` | PR is MERGEABLE (never bypassable — GitHub rejects conflicting merges)                                                                                   | `none`      |

### Review state (`reviewed`)

**Automatic Codex GitHub review is the default path.** The gate accepts a native review pinned to the exact head, or the connector's no-major-issues issue comment pinned to a 10- or 40-character prefix of that head. A finding-bearing native review relies on the separate thread gate: every finding must be fixed or explicitly declined, replied to, and resolved. Both automatic records must come from exact account `chatgpt-codex-connector[bot]`; the comment must also carry exact app slug `chatgpt-codex-connector` and the known clean-result prefix. The existing SHA-pinned `mark-review.sh` route remains valid after Tim explicitly runs a local review. Every push needs a fresh review; comment `@codex review` only when Tim explicitly asks for a manual trigger.

`_compute_review_state` in `_pr-gates.sh` reports nine states:

| State                 | Meaning                                                                    | `reviewed` |
| --------------------- | -------------------------------------------------------------------------- | ---------- |
| `approval`            | Latest Codex review approved the current head SHA                          | PASS       |
| `clean_comment`       | Trusted Codex clean comment pins the current head                          | PASS       |
| `reviewed`            | `COMMENTED`/`CHANGES_REQUESTED` review pins head; threads own adjudication | PASS       |
| `marker`              | Manual review marker pins the current head SHA                             | PASS       |
| `stale_approval`      | Latest Codex approval names a different SHA                                | FAIL       |
| `stale_clean_comment` | Trusted Codex clean comment names another SHA                              | FAIL       |
| `stale_marker`        | Manual review marker names a different SHA                                 | FAIL       |
| `not_approved`        | Non-approval review is stale or unusable (`DISMISSED`/`PENDING`/unknown)   | FAIL       |
| `unreviewed`          | Neither review path covers this PR                                         | FAIL       |

Within the automatic Codex path, compare precedence only among records for the same head. A later `CHANGES_REQUESTED` or `COMMENTED` review of that head overrides an earlier clean comment; no delayed review, clean comment, or manual marker for an older SHA can invalidate current-head coverage. A current manual marker remains independently valid.

Nothing here WAITs. The gate reports the current snapshot and fails on an unreviewed or stale head; the owning agent waits for automatic review outside the merge script. `merge-pr.sh --automerge` must stop rather than hide that unfinished state.

**Coverage is judged by SHA equality, not timestamps.** GitHub's `commit_id` identifies the commit Codex reviewed. Comparing submission time instead could accept a review of an earlier tree submitted after a later push.

## Status Token Vocabulary

Scripts emit machine-parseable status with these prefixes:

| Token    | Meaning                                                     | Action                        |
| -------- | ----------------------------------------------------------- | ----------------------------- |
| `PASS:`  | Gate passed                                                 | Continue                      |
| `FAIL:`  | Hard failure                                                | Block; fix underlying issue   |
| `WAIT:`  | Transient state (e.g., GitHub computing mergeable)          | Retry; may resolve on its own |
| `WARN:`  | Soft gate proceeding with a notice                          | Read the notice; not blocking |
| `BLOCK:` | State mismatch requiring user action (e.g., merge conflict) | Resolve, push, retry          |

The agent reads these tokens from script stdout to decide next steps. The `reviewed` remedy says to await a clean automatic current-head result and reserves `@codex review` or local attestation for Tim's explicit request. Continuation lines are indented and carry no status token, so token parsing is unaffected.

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
- **The PinPoint merge decision is Tim's (PP-wi85, reversed for the script per Tim 2026-08-19)**: an agent MAY run `scripts/workflow/merge-pr.sh` (any flags, including `--dry-run`), but the `.claude/hooks/block-direct-merge.cjs` PreToolUse hook turns every invocation into an approval prompt Tim must accept — a hook `ask` prompts in every permission mode, including bypassPermissions. Raw PinPoint channels stay hard-blocked because they skip the script's gate re-checks; explicit non-PinPoint targets follow their own repository policy. The old `.claude-merge-bypass` sentinel was removed entirely. `merge-pr.sh` also refuses to execute a merge without `--human` at the script level, as defense-in-depth for harnesses that don't wire the Claude Code hook.
- **Fail closed on API errors**: gates that can't determine state exit non-zero.

## Dependencies

- `gh` CLI (authenticated)
- `jq` for JSON processing
- `python3` (for `pr-watch.py`)

## Related Docs

- `.agents/skills/pinpoint-pr-workflow/SKILL.md` — Full skill: the review handoff, the merge handoff, and the MCP call sequences. Status-token responses are the table above, not there.
