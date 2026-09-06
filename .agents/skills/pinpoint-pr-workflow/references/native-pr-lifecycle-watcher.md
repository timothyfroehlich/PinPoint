# Native PR Lifecycle Watcher

Read this reference whenever waiting for current-head CI or exact-head Codex review evidence.

## Named agent

Invoke the project-scoped agent named `pr-lifecycle-watcher`. Give it exactly this five-field envelope and no implementation context, command, history, or transcript:

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

| Harness     | Definition                                | Model                      | Boundary                                                                                                                               |
| :---------- | :---------------------------------------- | :------------------------- | :------------------------------------------------------------------------------------------------------------------------------------- |
| Codex       | `.codex/agents/pr-lifecycle-watcher.toml` | `gpt-5.3-codex-spark`, low | Read-only sandbox; required watcher MCP server with only `watch_pr_lifecycle` enabled. Codex has no per-agent built-in-tool allowlist. |
| Claude Code | `.claude/agents/pr-lifecycle-watcher.md`  | `haiku`, low               | Background, two turns, only `mcp__pr_lifecycle_watch__watch_pr_lifecycle`.                                                             |
| Antigravity | `.agents/agents/pr-lifecycle-watcher.md`  | `flash`                    | Subagent-only, command execution off, only `watch_pr_lifecycle`, registered by workspace `.agents/mcp_config.json`.                    |

Each agent calls `watch_pr_lifecycle` exactly once and returns its terminal JSON unchanged. It cannot inspect implementation, mutate state, request review, adjudicate findings, resolve threads, run another command, or retry.

## Owner lifecycle

1. Push the intended head and invoke the named agent with `phase: "ci"`.
2. On `outcome: "passed"`, promote a draft PR, then run `bash scripts/workflow/request-codex-review.sh <PR>` exactly once for that head.
3. Invoke the named agent with the same envelope except `phase: "review"`.
4. The capable owner handles every terminal outcome, mutation, finding, label, screenshot, and merge handoff. A changed head restarts at step 1.

The MCP server accepts no command field. It verifies that `worktree` resolves to its current Git worktree and constructs only this shell-free argv:

```text
python3 scripts/workflow/pr-watch.py <PR> --phase <ci|review> --expected-head <SHA> --json
```

It preserves the existing XDG leader/follower coordination and `tmp/gh-monitor` telemetry. Codex's MCP tool timeout is 65 minutes, above the watcher's one-hour ceiling. Claude's native MCP timeout already exceeds the ceiling. Use `--print-timeout 65m` for Antigravity headless validation.

If the harness cannot discover the project-scoped named agent, report the broken installation as a blocker. Parent-agent hooks reject direct long-running `pr-watch.py` calls; do not recreate the old prompt-only generic subagent.

Terminal JSON and exit semantics are authoritative in `scripts/workflow/AGENTS.md`.
