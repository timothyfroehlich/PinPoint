# PR Workflow Scripts

Bash/Node scripts for managing GitHub PR lifecycle: CI monitoring, UI screenshots, readiness labeling, and human-only gate-enforced merge.

## Architecture

Scripts are designed for the **PinPoint orchestrator workflow** where multiple subagents work in parallel worktrees. The orchestrator (or a human) uses these from the main repo to monitor and manage PRs created by agents.

**Merging is human-only (PP-wi85).** `merge-pr.sh` is blocked for agents by the `block-direct-merge.cjs` PreToolUse hook, in ANY invocation shape (including `--dry-run`) — there is no agent bypass. Agents run every other script in this directory freely, including `pr-screenshots.mjs` and `mark-claude-review.sh`; only `merge-pr.sh` itself is off-limits. Tim runs it directly (`scripts/workflow/merge-pr.sh <PR> --human`) once an agent hands the PR off as ready.

## Scripts

### PR Monitoring

| Script                    | Purpose                                                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `pr-dashboard.sh [PR...]` | Status table: CI checks, merge state, draft state. All open PRs if no args.                                                                 |
| `pr-watch.py <PR>`        | Stream CI run events. One timestamped line per event. Use with the Claude Code Monitor tool. Writes failure artifacts to `tmp/gh-monitor/`. |

### UI Screenshots

| Script                                                   | Purpose                                                                                                                                                                                                                                                     |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pr-screenshots.mjs <PR> [--pages a,b,c] [--force-auth]` | Shoots the pages in `ui-screenshot-manifest.json` at desktop (1440×900) + mobile (390×844), pushes PNGs to the orphan `pr-screenshots` branch, posts/updates one sticky PR comment (marker `<!-- pr-screenshots -->`). Agent-runnable — not a merge action. |
| `ui-screenshot-manifest.json`                            | Page manifest: id → `{ label, route, authRole, seedNeeds }`. Edit to add/remove shot targets.                                                                                                                                                               |

### Readiness and Merge

| Script                                 | Purpose                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `merge-pr.sh <PR> --human`             | **Human-only — blocked for agents.** Re-evaluates all 5 gates (`ci`, `currency`, `threads`, `reviewed`, `no_conflict`) and squash-merges if all pass. Removes ready-for-review label on failure. `--human` is required to actually merge (defense-in-depth for non-Claude-Code harnesses); `--dry-run` doesn't need it but agents can't run the script at all inside Claude Code, dry-run included. |
| `mark-claude-review.sh <PR> [summary]` | Posts/updates a sticky SHA-pinned Claude-review marker comment (`<!-- pinpoint-claude-review: <head_sha> -->`) that satisfies the `reviewed` gate when Copilot skips.                                                                                                                                                                                                                               |
| `_pr-gates.sh`                         | Shared bash helper sourced by merge-pr.sh. Defines the gate functions.                                                                                                                                                                                                                                                                                                                              |

### Gates (evaluated by `merge-pr.sh`, defined in `_pr-gates.sh`)

| Gate          | Passes when                                                                                                                                    | Bypass kind |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `ci`          | `CI Gate` check is SUCCESS/NEUTRAL/SKIPPED                                                                                                     | `admin`     |
| `currency`    | Latest Copilot review covers head (WARN-proceeds if stale past 600s)                                                                           | `force`     |
| `threads`     | Zero unresolved Copilot review threads                                                                                                         | `force`     |
| `reviewed`    | Head commit covered by a Copilot review OR a SHA-pinned Claude marker; WAITs inside the 600s window, FAILs after with no review of either kind | `force`     |
| `no_conflict` | PR is MERGEABLE (never bypassable — GitHub rejects conflicting merges)                                                                         | `none`      |

## Status Token Vocabulary

Scripts emit machine-parseable status with these prefixes:

| Token    | Meaning                                                     | Action                        |
| -------- | ----------------------------------------------------------- | ----------------------------- |
| `PASS:`  | Gate passed                                                 | Continue                      |
| `FAIL:`  | Hard failure                                                | Block; fix underlying issue   |
| `WAIT:`  | Transient state (e.g., GitHub computing mergeable)          | Retry; may resolve on its own |
| `BLOCK:` | State mismatch requiring user action (e.g., merge conflict) | Resolve, push, retry          |

The agent reads these tokens from script stdout to decide next steps. Scripts never emit prescriptive advice; the skill (pinpoint-pr-workflow) documents what to do for each token.

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
- **Mechanical script output**: scripts emit status (FAIL, WAIT, BLOCK, PASS), never prescriptive advice. The skill documents what to do per token.
- **Merge is human-only (PP-wi85)**: `gh pr merge`, MCP `merge_pull_request`, AND `scripts/workflow/merge-pr.sh` itself (any flags, including `--dry-run`) are all blocked for an agent by the `.claude/hooks/block-direct-merge.cjs` PreToolUse hook. There is no agent-usable bypass — the old `.claude-merge-bypass` sentinel was removed entirely. `merge-pr.sh` also refuses to execute a merge without `--human` at the script level, as defense-in-depth for harnesses that don't wire the Claude Code hook.
- **Fail closed on API errors**: gates that can't determine state exit non-zero.

## Dependencies

- `gh` CLI (authenticated)
- `jq` for JSON processing
- `python3` (for `pr-watch.py`)

## Related Docs

- `.agent/skills/pinpoint-pr-workflow/SKILL.md` — Full skill documenting token responses and MCP call sequences
- `.agent/skills/pinpoint-orchestrator/SKILL.md` — Orchestrator workflow referencing these scripts
