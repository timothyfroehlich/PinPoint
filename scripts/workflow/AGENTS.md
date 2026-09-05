# PR Workflow Scripts

Bash/Node scripts for managing GitHub PR lifecycle: CI monitoring, UI screenshots, readiness labeling, and the gate-enforced, Tim-approved merge.

## Architecture

Scripts are designed for the **PinPoint orchestrator workflow** where multiple subagents work in parallel worktrees. The orchestrator (or a human) uses these from the main repo to monitor and manage PRs created by agents.

**The PinPoint merge decision is Tim's (PP-wi85, reversed for the script per Tim 2026-08-19).** An agent MAY run `merge-pr.sh`, but the `block-direct-merge.cjs` PreToolUse hook turns any invocation of it (including `--dry-run`) into an approval prompt Tim must accept before it runs — the merge is still his call. The raw PinPoint channels (`gh pr merge`, `gh api PUT .../merge`, MCP `merge_pull_request`) stay hard-blocked, because they skip the script's gate re-checks. This boundary applies to implicit current-repository targets and explicit `timothyfroehlich/PinPoint` targets; a non-PinPoint target statically explicit in command arguments or MCP input follows that repository's policy and the user's authorization. Environment-only selectors remain fail-closed. Agents run every other script in this directory freely, including `pr-screenshots.mjs` and `merge-handoff.sh` (which _prints_ the merge command). The normal close follows `pinpoint-pr-workflow`: draft PR, current-head CI, exact-head automatic Codex coverage, resolved threads, final label, then handoff.

## Scripts

### PR Monitoring

| Script                                        | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pr-dashboard.sh [PR...]`                     | Status table: CI checks, review state, merge state, draft state. All open PRs if no args. One repository GraphQL snapshot batches metadata, checks, native reviews, and threads; targeted pagination is exceptional, and REST comments are fetched only where native exact-head evidence is insufficient. The Review column shows unresolved threads when there are any, otherwise: `reviewed`, `RE-REVIEW` (`stale_approval`), `NOT APPROVED` (`not_approved`), or `NOT REVIEWED` (`unreviewed`).                                                                                                                                                                           |
| `pr-watch.py <PR>`                            | Stream CI run events. One timestamped line per event. Use with the Claude Code Monitor tool. The first host process for a repository+PR+watch mode holds the XDG-state lock and polls GitHub; concurrent invocations with the same precheck semantics follow its atomic local state with zero GitHub reads. Normal and `--force` watches have separate owners. A later invocation never trusts an unlocked terminal cache. Writes failure artifacts to `tmp/gh-monitor/`. Unresolved threads persist in shared state so every follower prints the reminder, but do **not** stop the watch. `--check-ready` remains a direct readiness snapshot rather than a shared monitor. |
| `codex-reaction-witness.sh <PR> <SHA> <TIME>` | Trusted helper for `.github/workflows/codex-reaction-witness.yaml`. After a ready/synchronize event it requires a fresh connector-bot `eyes`, continuously verifies that the named SHA remains head, then posts a SHA-pinned witness only if that same reaction changes to `+1`. A native exact-head review supersedes the need for a witness.                                                                                                                                                                                                                                                                                                                               |

`pr-watch.py` exit codes: **0** passed, **1** a run or the CI Gate actually failed, **2** the outcome could not be determined — the GitHub API was unreachable (rate-limit 403, network drop, auth failure) or the bounded watch expired without a terminal verdict. Exit 2 is not a red CI: re-run the watch once evidence is available rather than hunting for a broken test. (PP-qkl8)

Shared monitor state lives under `$XDG_STATE_HOME/pinpoint/pr-watch/` (falling back to `~/.local/state`) and carries schema version, repository, PR, current head, leader PID, status, timestamp, short detail, and an optional failure-artifact path. The process-held lock is the liveness proof; JSON alone is never ownership or reusable terminal evidence.

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

`merge-handoff.sh`'s `ui` line keys on file **paths**, so it reads `UI file(s) changed`, never `the UI changed`. A UI-glob edit that renders nothing new (a pure refactor, a non-null-`!` removal) can carry the marker `<!-- no-visual-change -->` in the PR **body** to clear the `NO screenshots posted` nudge — mirroring `pr-screenshots.mjs`'s `<!-- pr-screenshots -->` token. Posted screenshots always take precedence over the marker. It is informational only, below the divider — never a merge gate. (PP-lhjg)

### Gates (evaluated by `merge-pr.sh`, defined in `_pr-gates.sh`)

| Gate          | Passes when                                                                                                                                                                 | Bypass kind |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `ci`          | `CI Gate` check is SUCCESS/NEUTRAL/SKIPPED                                                                                                                                  | `admin`     |
| `threads`     | Zero unresolved review threads, from any author                                                                                                                             | `force`     |
| `reviewed`    | Hard backstop — an automatic Codex review or manual marker must cover head. PASS on `approval` / `clean_comment` / `clean_reaction` / `reviewed` / `marker`; FAIL otherwise | `force`     |
| `no_conflict` | PR is MERGEABLE (never bypassable — GitHub rejects conflicting merges)                                                                                                      | `none`      |

### Review state (`reviewed`)

**Automatic Codex GitHub review is the default path.** The gate accepts a native review pinned to the exact head, the connector's no-major-issues issue comment pinned to a 10- or 40-character prefix of that head, or a trusted GitHub Actions comment witnessing a fresh connector-bot `eyes`→`+1` transition while that exact SHA remained head. Direct reactions are never merge evidence because GitHub does not attach a commit SHA to them. A finding-bearing native review relies on the separate thread gate: every finding must be fixed or explicitly declined, replied to, and resolved. Native reviews and clean comments must come from exact account `chatgpt-codex-connector[bot]`; the clean comment must also carry exact app slug `chatgpt-codex-connector` and the known clean-result prefix. Reaction witnesses require exact account `github-actions[bot]`, exact app slug `github-actions`, and the SHA-pinned witness marker. The existing SHA-pinned `mark-review.sh` route remains valid after Tim explicitly runs a local review. Automatic review is first for every head. If its bounded witness conclusively finishes without exact-head evidence, one `@codex review` fallback is allowed for that unchanged head. A slow or still-running attempt is not eligible, the comment must never repeat for the same head, and every new head restarts automatic-first.

`_compute_review_state` in `_pr-gates.sh` reports eleven states:

| State                  | Meaning                                                                    | `reviewed` |
| ---------------------- | -------------------------------------------------------------------------- | ---------- |
| `approval`             | Latest Codex review approved the current head SHA                          | PASS       |
| `clean_comment`        | Trusted Codex clean comment pins the current head                          | PASS       |
| `clean_reaction`       | Trusted workflow pins a fresh Codex `eyes`→`+1` transition to head         | PASS       |
| `reviewed`             | `COMMENTED`/`CHANGES_REQUESTED` review pins head; threads own adjudication | PASS       |
| `marker`               | Manual review marker pins the current head SHA                             | PASS       |
| `stale_approval`       | Latest Codex approval names a different SHA                                | FAIL       |
| `stale_clean_comment`  | Trusted Codex clean comment names another SHA                              | FAIL       |
| `stale_clean_reaction` | Trusted reaction witness names another SHA                                 | FAIL       |
| `stale_marker`         | Manual review marker names a different SHA                                 | FAIL       |
| `not_approved`         | Non-approval review is stale or unusable (`DISMISSED`/`PENDING`/unknown)   | FAIL       |
| `unreviewed`           | Neither review path covers this PR                                         | FAIL       |

Within the automatic Codex path, compare precedence only among records for the same head. A later `CHANGES_REQUESTED` or `COMMENTED` review of that head overrides an earlier clean result; no delayed review, clean comment, or manual marker for an older SHA can invalidate current-head coverage. A current manual marker remains independently valid.

Nothing here WAITs. The gate reports the current snapshot and fails on an unreviewed or stale head; the owning agent waits for automatic review outside the merge script. `merge-pr.sh --automerge` must stop rather than hide that unfinished state.

**Every accepted path is SHA-pinned.** Native reviews carry `commit_id`; clean comments name the reviewed SHA; the reaction-witness workflow observes a fresh `eyes`, continuously verifies the event SHA is still head, and only then records the later `+1` against that SHA. A delayed reaction for an older head therefore cannot satisfy a newer head's gate.

## Status Token Vocabulary

Scripts emit machine-parseable status with these prefixes:

| Token    | Meaning                                                     | Action                        |
| -------- | ----------------------------------------------------------- | ----------------------------- |
| `PASS:`  | Gate passed                                                 | Continue                      |
| `FAIL:`  | Hard failure                                                | Block; fix underlying issue   |
| `WAIT:`  | Transient state (e.g., GitHub computing mergeable)          | Retry; may resolve on its own |
| `WARN:`  | Soft gate proceeding with a notice                          | Read the notice; not blocking |
| `BLOCK:` | State mismatch requiring user action (e.g., merge conflict) | Resolve, push, retry          |

The agent reads these tokens from script stdout to decide next steps. The `reviewed` remedy says to await a clean automatic current-head result, permits one `@codex review` fallback only after the bounded automatic witness conclusively misses that unchanged head, and reserves local attestation for a local review Tim explicitly runs. Continuation lines are indented and carry no status token, so token parsing is unaffected.

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
- **The PinPoint merge decision is Tim's (PP-wi85, reversed for the script per Tim 2026-08-19)**: an agent MAY run `scripts/workflow/merge-pr.sh` (any flags, including `--dry-run`), but the `.claude/hooks/block-direct-merge.cjs` PreToolUse hook turns every invocation into an approval prompt Tim must accept — a hook `ask` prompts in every permission mode, including bypassPermissions. Raw PinPoint channels stay hard-blocked because they skip the script's gate re-checks; a non-PinPoint target statically explicit in command arguments or MCP input follows that repository's policy and the user's authorization. Environment-only selectors remain fail-closed. The old `.claude-merge-bypass` sentinel was removed entirely. `merge-pr.sh` also refuses to execute a merge without `--human` at the script level, as defense-in-depth for harnesses that don't wire the Claude Code hook.
- **Fail closed on API errors**: gates that can't determine state exit non-zero.

## Dependencies

- `gh` CLI (authenticated)
- `jq` for JSON processing
- `python3` (for `pr-watch.py`)

## Related Docs

- `.agents/skills/pinpoint-pr-workflow/SKILL.md` — Full skill: the review handoff, the merge handoff, and the MCP call sequences. Status-token responses are the table above, not there.
