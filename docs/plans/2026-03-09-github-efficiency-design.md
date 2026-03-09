# GitHub Workflow Efficiency Rewrite

**Date**: 2026-03-09
**Bead**: PinPoint-e0e1
**Status**: Approved

## Problem

Our workflow shell scripts make excessive GitHub API calls, causing 403 rate-limit errors.
The root cause is `monitor-gh-actions.sh` polling for Copilot reviews every 20 seconds
(~600 REST calls per CI run across 5 PRs). Other scripts (`copilot-comments.sh`,
`respond-to-copilot.sh`, `pr-dashboard.sh`) also make redundant calls that the GitHub
MCP server now handles natively.

## Solution

Replace shell scripts with GitHub MCP server calls. The official `github/github-mcp-server`
(v0.31.0+) now supports reading PR reviews, listing review comments, and replying to
review threads. The one remaining gap — `resolveReviewThread` — stays as a thin shell script
until PR #1919 merges upstream.

## Architecture

### MCP replaces these scripts (delete them)

| Script                       | API calls | MCP replacement                                           |
| :--------------------------- | :-------- | :-------------------------------------------------------- |
| `copilot-comments.sh`        | 5/PR      | `pull_request_read` + review comment tools                |
| `respond-to-copilot.sh`      | 3/comment | `add_reply_to_pull_request_comment` + `resolve-thread.sh` |
| `pr-dashboard.sh`            | 3/PR × N  | Agents call MCP tools directly                            |
| `resolve-copilot-threads.sh` | 2 + N     | MCP listing + `resolve-thread.sh`                         |

### New script: `resolve-thread.sh`

Single-purpose GraphQL wrapper. Accepts one or more thread node IDs, runs
`resolveReviewThread` mutation for each. ~15 lines. Will be deleted when
`github/github-mcp-server` PR #1919 merges.

### Rewrite: `monitor-gh-actions.sh`

Remove the review-polling subshell (lines 68-89) that burns ~600 REST calls per CI run.
Keep `gh run watch` for CI status monitoring. Review detection moves to MCP — agents check
for new reviews after CI completes, not via polling.

### Skill updates

**`pinpoint-ready-to-review`**: MCP-only workflow. Steps:

1. Watch CI via `monitor-gh-actions.sh` (no review polling)
2. Spawn lightweight subagent (Haiku / Gemini Flash) to fetch Copilot comments via MCP
3. Address comments, reply via MCP, resolve via `resolve-thread.sh`
4. Label via `label-ready.sh`

**`pinpoint-github-monitor`**: Remove review-polling references. CI-only monitoring.

**`AGENTS.md § GitHub Copilot Reviews`**: MCP-first instructions, `resolve-thread.sh` for
the one gap.

### Subagent pattern for large responses

Skills instruct agents to spawn a lightweight subagent (Claude Haiku, Gemini Flash, or
equivalent small/fast model) to fetch PR review data via MCP tools. The subagent returns
a structured summary: `file:line`, comment body, resolved status. This protects the main
context window from large API responses.

Each agent platform (Claude Code, Gemini, Codex) implements subagents differently. The
skill describes the **intent** and **model guidance**, not platform-specific mechanics.

## API call reduction (estimated)

| Scenario                      | Before    | After                            |
| :---------------------------- | :-------- | :------------------------------- |
| CI run monitoring (5 PRs)     | ~600 REST | ~10 REST (gh run watch uses SSE) |
| Copilot comment fetch (1 PR)  | 5 calls   | 0 shell calls (MCP)              |
| Respond + resolve (1 comment) | 3 calls   | 1 GraphQL (resolve only)         |
| Dashboard refresh (5 PRs)     | 15 calls  | 0 shell calls (MCP)              |
| Label ready (1 PR)            | 4 calls   | 3 calls                          |

## Future: PR #1919 lands

When `github/github-mcp-server` merges `resolveReviewThread` support:

- Delete `resolve-thread.sh`
- Update skills to use MCP for resolve
- Zero shell scripts remain in the Copilot workflow
