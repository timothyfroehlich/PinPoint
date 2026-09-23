# Native PR Lifecycle Watcher

Read this reference whenever waiting for current-head CI or exact-head Codex review evidence.

## Primary Method: Subway Watch

Run the watcher as a non-blocking background command via Subway:

```bash
subway watch --pr <PR> --phase <ci|review> --expected-head <SHA>
```

`subway watch` directly invokes `scripts/workflow/pr-watch.py` without LLM mediation, saving 100% of context tokens during passive waiting. On failure, it automatically injects a `failure_summary` into the terminal JSON on `stdout`.

## Fallback: Named Agent

If Subway is unavailable, invoke the project-scoped agent named `pr-lifecycle-watcher`. Give it exactly this five-field envelope:

```json
{
  "worktree": "/absolute/path/to/the/current/worktree",
  "pr": 1234,
  "title": "Exact PR title",
  "phase": "ci",
  "expected_head": "40-character-lowercase-head-sha"
}
```

The same named agent handles `phase: "ci"` and `phase: "review"`. Project definitions keep the logical name and system contract aligned:

| Harness     | Definition                                | Model               | Boundary                                                                                                                                                                                                                                     |
| :---------- | :---------------------------------------- | :------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Codex       | `.codex/agents/pr-lifecycle-watcher.toml` | `gpt-5.6-luna`, low | Read-only sandbox; `.codex/config.toml` registers the watcher MCP as non-fatal at session startup, with only `watch_pr_lifecycle` enabled for child inheritance. The owner lifecycle still fails closed if the named watcher is unavailable. |
| Claude Code | `.claude/agents/pr-lifecycle-watcher.md`  | `haiku`, low        | Background, two turns, only `mcp__pr_lifecycle_watch__watch_pr_lifecycle`.                                                                                                                                                                   |
| Antigravity | `.agents/agents/pr-lifecycle-watcher.md`  | `flash`             | Subagent-only, command execution off, no built-in tools, and an inline watcher MCP server exposing only `watch_pr_lifecycle`.                                                                                                                |

Each agent calls `watch_pr_lifecycle` exactly once and returns its terminal JSON unchanged. It cannot inspect implementation, mutate state, request review, adjudicate findings, resolve threads, run another command, or retry.

## Owner lifecycle

1. Push the intended head and invoke the named agent with `phase: "ci"`.
2. On `outcome: "passed"`, promote a draft PR to trigger CodeRabbit; for a later head, request `@coderabbitai review`. Use `request-codex-review.sh <PR> <reply-ID>` only after a trusted current-head CodeRabbit usage-limit reply.
3. Invoke the named agent with the same envelope except `phase: "review"`.
4. The capable owner handles every terminal outcome, mutation, finding, label, screenshot, and merge handoff. A changed head restarts at step 1.

The MCP server accepts no command field. It verifies that `worktree` resolves to its current Git worktree and constructs only this shell-free argv:

```text
python3 scripts/workflow/pr-watch.py <PR> --phase <ci|review> --expected-head <SHA> --json
```

It preserves the existing XDG leader/follower coordination and `tmp/gh-monitor` telemetry. Codex's MCP tool timeout is 65 minutes, above the watcher's one-hour ceiling. Claude's native MCP timeout already exceeds the ceiling. Use `--print-timeout 65m` for Antigravity headless validation.

If the harness cannot discover the project-scoped named agent, report the broken installation as a blocker. Parent-agent hooks reject direct long-running `pr-watch.py` calls; do not recreate the old prompt-only generic subagent.

Terminal JSON and exit semantics are authoritative in `scripts/workflow/AGENTS.md`.
