# PinPoint Development Instructions (Claude Code)

@AGENTS.md

## Claude Code-Specific

### Context7 MCP Integration

- **When**: Working with libraries (Drizzle, Supabase, Next.js, shadcn/ui, Vitest)
- **Process**: `resolve-library-id` → `get-library-docs` → Apply current patterns

### Specialized Subagents

- **enforcer** - Code review with XML-guided workflows
- **investigator** - Deep read-only analysis and diagnostics
- **Explore** - Fast codebase exploration and search

### Sandbox & Playwright

- The macOS sandbox blocks Chromium's Mach port IPC, causing `MachPortRendezvousServer: Permission denied` crashes.
- Playwright commands are excluded from sandboxing via `excludedCommands` in `.claude/settings.local.json`. If you see Mach port errors, verify the command prefix matches an entry there (env var prefixes like `SKIP_SUPABASE_RESET=true` need separate entries).
- `gh` CLI TLS errors are fixed by `enableWeakerNetworkIsolation: true` in the same file.
- Use `pnpm run dev:status` to check if Next.js/Supabase/Postgres are running — don't hand-roll curl health checks.

### Working Style

- If you've spent more than 3 tool calls on environment setup without reproducing
  the actual issue, stop and ask the user for guidance.
- For simple PRs (< 5 files changed), do not spawn more than 2 sub-agents.
- Do not over-engineer or spawn excessive parallel agents for straightforward tasks.

### Worktree Dispatch Safety

Two upstream Claude Code bugs require active enforcement when the user asks you to dispatch subagents via `Agent(isolation: "worktree")`. "Main worktree" below means the original repository clone — the worktree where `.git/` is a directory, not a file pointing into `.git/worktrees/`. It is **not** about being on the `main` branch.

1. **Dispatch only from the main worktree.** If your CWD is inside `.claude/worktrees/agent-*` or any other linked (non-primary) worktree, **refuse and explain**: upstream bug [anthropics/claude-code#47548](https://github.com/anthropics/claude-code/issues/47548) silently switches the parent worktree's branch to the subagent's new branch when dispatched from a linked worktree — even at N=1. Tell the user you need to switch back to the main worktree first, or ask whether they want to accept the risk.

2. **Serialize: one `isolation: "worktree"` Agent call per message.** Two or more parallel `Agent(isolation: "worktree")` calls in a single message can race on `.git/config.lock` ([anthropics/claude-code#47266](https://github.com/anthropics/claude-code/issues/47266)) — the upstream reproducer is N=3 with 2 of 3 failing, and we have no evidence that N=2 is reliably safe. Dispatch one, confirm its worktree appeared on disk, then dispatch the next. If the user asks for 2+ in one message, push back: explain the race, offer to serialize.

If the user explicitly overrides ("yes, do it anyway"), proceed. These rules require push-back + explanation, not silent compliance.

See `pinpoint-orchestrator` skill Phase 2 for the full technical record.
