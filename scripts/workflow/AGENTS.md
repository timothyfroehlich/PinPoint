# PR Workflow Scripts

Bash scripts for managing GitHub PR lifecycle: CI monitoring, thread resolution, and readiness labeling.

## Architecture

Most Copilot review operations now use the **GitHub MCP server** directly (v0.31.0+):

- `pull_request_read(method: "get_review_comments")` — fetch review threads
- `add_reply_to_pull_request_comment` — reply to threads
- Thread resolution remains in a shell script (`resolve-thread.sh`) until `github/github-mcp-server` PR #1919 merges.

Scripts are designed for the **PinPoint orchestrator workflow** where multiple subagents work in parallel worktrees.

## Scripts

### CI Monitoring

| Script                  | Purpose                                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| `monitor-gh-actions.sh` | Watch all active CI runs in parallel, report failures. Writes signal files for async monitoring. |

### Thread Resolution (MCP gap stopgap)

| Script                                  | Purpose                                                           |
| --------------------------------------- | ----------------------------------------------------------------- |
| `resolve-thread.sh <thread-id> [id...]` | Resolve one or more review threads by GraphQL node ID (`PRRT_…`). |

### Readiness

| Script                | Purpose                                                                                                                                                                                 |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `label-ready.sh <PR>` | Label `ready-for-review` if: all CI passed, 0 unresolved Copilot threads, not draft. `--cleanup` removes associated worktree. `--force` skips Copilot gate. Fails closed on API errors. |

### Orchestration

| Script                    | Purpose                                                                |
| ------------------------- | ---------------------------------------------------------------------- |
| `orchestration-status.sh` | Combined startup: PR list + worktree health + beads + security alerts. |
| `stale-worktrees.sh`      | Report stale/active/dirty worktrees. `--clean` to auto-remove.         |

## Key Design Decisions

- **MCP-first**: Review thread listing and replies go through MCP tools, not shell scripts. Only `resolveReviewThread` uses GraphQL directly (MCP gap).
- **Fail closed** (label-ready): If the Copilot API call fails, the script exits non-zero rather than defaulting to 0 threads. Use `--force` to override.
- **Single consolidated API call** (label-ready): Uses `gh pr view --json statusCheckRollup` to get CI + PR metadata in one call.

## Dependencies

- `gh` CLI (authenticated)
- `jq` for JSON processing
- `python3` + `pinpoint-wt.py` (only for `label-ready.sh --cleanup`)

## Related Docs

- `AGENTS.md` — "GitHub Copilot Reviews" section defines the MCP-first reply protocol
- `.agent/skills/pinpoint-orchestrator/SKILL.md` — Full orchestrator workflow
