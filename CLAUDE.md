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

Two upstream Claude Code bugs affect `Agent(isolation: "worktree")` dispatch. One (`#47548`) requires active enforcement — the hook cannot fix it. The other (`#47266`) is mitigated by the `WorktreeCreate` hook (PP-bg45) at the OS lock level. "Main worktree" below means the original repository clone — the worktree where `.git/` is a directory, not a file pointing into `.git/worktrees/`. It is **not** about being on the `main` branch.

1. **Dispatch only from the main worktree.** If your CWD is inside `.claude/worktrees/agent-*` or any other linked (non-primary) worktree, **refuse and explain**: upstream bug [anthropics/claude-code#47548](https://github.com/anthropics/claude-code/issues/47548) silently switches the parent worktree's branch to the subagent's new branch when dispatched from a linked worktree — even at N=1. Tell the user you need to switch back to the main worktree first, or ask whether they want to accept the risk. The `WorktreeCreate` hook does NOT fix this bug.

2. **Parallel dispatch is safe when the `WorktreeCreate` hook is active.** The `.claude/hooks/worktree-create.sh` hook (PP-bg45) wraps `git worktree add` with `lockf(1)` on `~/.config/pinpoint/worktree-add.lock` — a kernel-level exclusive lock shared across all Claude sessions on the host — plus retry + exponential backoff. Any N `Agent(isolation: "worktree")` calls per message are safe from the main worktree while this hook is registered in `.claude/settings.json`. The prior N=1-per-message rule from PR #1353 ([anthropics/claude-code#47266](https://github.com/anthropics/claude-code/issues/47266)) is relaxed.

   **Fallback (hook disabled or missing):** Serialize — one `Agent(isolation: "worktree")` call per message. Dispatch, confirm the new `.claude/worktrees/agent-*` directory appeared on disk, then dispatch the next.

If the user explicitly overrides ("yes, do it anyway"), proceed. These rules require push-back + explanation, not silent compliance.

See `pinpoint-orchestrator` skill Phase 2 for the full technical record.

### Worktrees (Claude Code specifics)

- **Dispatch**: `isolation: "worktree"` works out of the box — Claude Code creates the worktree, the `post-checkout` hook configures it (slot allocation, ports, `.env.local`, `.claude/launch.json`).
- **Cleanup**: Claude Code's `WorktreeRemove` hook automatically runs `scripts/worktree_cleanup.py` (stops Supabase, removes Docker volumes, deallocates slot). Manual `git worktree remove /path` or `rm -rf` skips the hook — slot manifest entry and Docker volumes leak. `scripts/worktree_orphan_sweep.py` reconciles the slot manifest, active worktrees, and Supabase Docker resources; the SessionStart hook runs it in dry-run mode every 6h and surfaces a one-line nudge when orphans accumulate.
- **Branch creation**: `Agent(isolation:"worktree")` handles branch creation automatically. AGENTS.md §4 "Branch Management" rules still apply if you create a branch manually inside an existing worktree.

### Parallel Subagent Workflow

For multiple independent tasks, use worktree-isolated subagents.

**Primary**: Standalone subagents with `isolation: "worktree"` + `run_in_background: true`. Use `resume` for follow-up (Copilot comments, CI fixes). The `post-checkout` hook automatically allocates ports and generates configs.

**Fallback**: Agent Teams for bidirectional real-time communication. Note: `isolation: "worktree"` is broken when `team_name` is set — teammates land in the lead's repo. Create worktrees manually with `git worktree add`.

**Quality Enforcement**:

- **Standalone subagents**: Self-enforced via prompt instructions (`pnpm run check` before returning). Hooks don't fire.
- **Agent Teams**: `TaskCompleted` hook runs `pnpm run check`; `TeammateIdle` hook blocks unpushed commits. Requires `isolation: "worktree"` for correct CWD (broken — see above).

**Anti-patterns**:

- DON'T use Agent Teams as default — standalone subagents have working worktree isolation
- DON'T forget to check Copilot comments before merging
- DON'T dispatch `Agent(isolation: "worktree")` from a linked (non-primary) worktree — see "Worktree Dispatch Safety" above (bug #47548, WorktreeCreate hook cannot fix this)
- DON'T fire N+ `Agent(isolation: "worktree")` calls without the WorktreeCreate hook active — with the hook any N is safe from the main worktree (flock serializes); without it, serialize to N=1-per-message

See `pinpoint-orchestrator` skill for the full workflow and known-bug details.

### Session Completion (Claude Code specifics)

The `TeammateIdle` hook enforces push-before-idle automatically for teammates. The manual "Landing the Plane" checklist in AGENTS.md applies to the lead agent and solo sessions.

### Antigravity

Antigravity is Google's CLI agent harness (currently Gemini) with full local environment access. Beads tagged `agy-ready` are cleared for autonomous execution; `agy-ui` additionally marks beads whose acceptance requires browser verification.

- **Triage gates and tagging workflow:** `pinpoint-agy-triage` skill.
- **Handing a bead to Antigravity:** `pinpoint-agy-dispatch` skill (run in Claude Code; emits a copy-paste prompt for the Antigravity 2.0 agent manager).
- **Executing a bead inside Antigravity:** `pinpoint-agy-execute` skill.
