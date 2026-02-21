# PR Workflow Scripts

Bash scripts for managing GitHub PR lifecycle: CI monitoring, Copilot review thread management, and readiness labeling.

## Architecture

All scripts use the **GitHub GraphQL API** for review thread operations (the REST API doesn't expose thread resolution state). They filter Copilot threads using an explicit author allowlist: `copilot-pull-request-reviewer` and `copilot-pull-request-reviewer[bot]`.

Scripts are designed for the **PinPoint orchestrator workflow** where multiple subagents work in parallel worktrees. The orchestrator (or a human) uses these from the main repo to monitor and manage PRs created by agents.

## Scripts

### PR Monitoring

| Script                    | Purpose                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------ |
| `pr-dashboard.sh [PR...]` | Status table: CI checks, unresolved Copilot thread count, draft state. All open PRs if no args.  |
| `monitor-gh-actions.sh`   | Watch all active CI runs in parallel, report failures. Writes signal files for async monitoring. |

### Copilot Thread Management

| Script                                         | Purpose                                                                                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `copilot-comments.sh <PR>`                     | Show unresolved Copilot comments formatted for agent prompts. `--all` includes resolved. `--raw` for JSON.                           |
| `respond-to-copilot.sh <PR> <path:line> <msg>` | Reply to and resolve a single thread. Match by file path + line number. Use `N/A` for file-level comments.                           |
| `resolve-copilot-threads.sh <PR>`              | Bulk-resolve threads older than the last commit (per-thread timestamp check). `--dry-run` to preview. `--all` to resolve regardless. |

### Readiness

| Script                | Purpose                                                                                                                                                                                 |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `label-ready.sh <PR>` | Label `ready-for-review` if: all CI passed, 0 unresolved Copilot threads, not draft. `--cleanup` removes associated worktree. `--force` skips Copilot gate. Fails closed on API errors. |

## Key Design Decisions

- **GraphQL for thread state**: REST `/pulls/{n}/comments` returns all comments regardless of resolution. Only GraphQL `reviewThreads` exposes `isResolved`.
- **Exact bot-only author match**: Scripts only accept `copilot-pull-request-reviewer` (GraphQL login) and `copilot-pull-request-reviewer[bot]` (REST style), preventing non-Copilot comments from being included.
- **Per-thread timestamp filtering** (resolve script): Each thread's `createdAt` is compared against the last commit date individually, preventing accidental resolution of threads from a newer review round.
- **Fail closed** (label-ready): If the Copilot API call fails, the script exits non-zero rather than defaulting to 0 threads. Use `--force` to override.
- **Reply endpoint** (respond script): Replies are posted via REST `POST /pulls/{pr}/comments/{id}/replies`, then thread resolution is done via GraphQL `resolveReviewThread`.
- **First-match for respond script**: When multiple threads match the same `path:line`, the script resolves the first one. Call it multiple times to resolve them sequentially.

## Dependencies

- `gh` CLI (authenticated)
- `jq` for JSON processing
- `python3` + `pinpoint-wt.py` (only for `label-ready.sh --cleanup`)

## Related Docs

- `AGENTS.md` — "GitHub Copilot Reviews" section defines the mandatory reply protocol
- `.claude/skills/tmf-orchestrator/SKILL.md` — Full orchestrator workflow referencing these scripts
