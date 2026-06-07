# PR Workflow Scripts

Bash scripts for managing GitHub PR lifecycle: CI monitoring, readiness labeling, and gate-enforced merge.

## Architecture

Scripts are designed for the **PinPoint orchestrator workflow** where multiple subagents work in parallel worktrees. The orchestrator (or a human) uses these from the main repo to monitor and manage PRs created by agents.

## Scripts

### PR Monitoring

| Script                    | Purpose                                                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `pr-dashboard.sh [PR...]` | Status table: CI checks, merge state, draft state. All open PRs if no args.                                                                 |
| `pr-watch.py <PR>`        | Stream CI run events. One timestamped line per event. Use with the Claude Code Monitor tool. Writes failure artifacts to `tmp/gh-monitor/`. |

### Readiness and Merge

| Script             | Purpose                                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `merge-pr.sh <PR>` | Re-evaluates the gates (CI, no-conflict) and squash-merges if all pass. Removes ready-for-review label on failure. `--dry-run` to preview. |
| `_pr-gates.sh`     | Shared bash helper sourced by merge-pr.sh. Defines the gate functions.                                                                     |

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

| Operation                                      | Use MCP                                        | Use Script                                    |
| ---------------------------------------------- | ---------------------------------------------- | --------------------------------------------- |
| Read PR metadata, reviews, threads, check_runs | `pull_request_read(method: ...)`               | —                                             |
| Apply/remove PR label                          | `issue_write(method: "update", labels: [...])` | —                                             |
| Get failed CI logs                             | `get_job_logs(failed_only, tail_lines)`        | —                                             |
| Stream CI runs in real time                    | —                                              | `pr-watch.py`                                 |
| Merge a PR                                     | —                                              | `merge-pr.sh` (direct merges blocked by hook) |
| Composite gate evaluation                      | —                                              | `merge-pr.sh` (sources `_pr-gates.sh`)        |

MCP field-naming gotcha: responses use snake_case (`is_resolved`, `submitted_at`, `head.sha`). GraphQL we previously used was camelCase.

## Key Design Decisions

- **MCP first for reads and per-op writes**: typed tool calls beat shell-escaped gh CLI for the agent's use cases. Scripts wrap composite enforcement that can't be a single API call.
- **Mechanical script output**: scripts emit status (FAIL, WAIT, BLOCK, PASS), never prescriptive advice. The skill documents what to do per token.
- **Direct merge blocked**: `gh pr merge` and MCP `merge_pull_request` are blocked by the `.claude/hooks/block-direct-merge.cjs` PreToolUse hook. Use `merge-pr.sh` to enforce gate re-checks. Bypass via `.claude-merge-bypass` sentinel file (single-use, deleted on hook fire).
- **Fail closed on API errors**: gates that can't determine state exit non-zero.

## Dependencies

- `gh` CLI (authenticated)
- `jq` for JSON processing
- `python3` (for `pr-watch.py`)

## Related Docs

- `.agent/skills/pinpoint-pr-workflow/SKILL.md` — Full skill documenting token responses and MCP call sequences
- `.agent/skills/pinpoint-orchestrator/SKILL.md` — Orchestrator workflow referencing these scripts
