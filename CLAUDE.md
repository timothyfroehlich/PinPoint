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
