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

### Antigravity Candidates

Some work is well-suited for Antigravity — Google's CLI agent harness (currently Gemini), which has full local environment access (Supabase, dev server, browser via Playwright) but is **less inquisitive** than Claude Sonnet. Because Antigravity won't stop mid-task to ask clarifying questions, every bead it executes must be decision-closed before it starts.

Tag those issues with the `agy-ready` label so they're easy to discover and dispatch. Follow `.agents/skills/pinpoint-agy-execute/SKILL.md` to drive a tagged bead end-to-end to ready-for-review from an Antigravity session.

> Commands below use `bd` (the [beads](https://github.com/timothyfroehlich/beads) issue tracker that PinPoint uses for task management — the full command reference is loaded at session start via the `bd prime` hook). `<id>` refers to a beads issue ID like `PP-3or`.

**Triage gates — ALL must pass before tagging `agy-ready`:**

1. **Decision-closed (iron).** No "discuss with user", no architectural forks, no TBDs. Every interpretive choice has a written answer in the bead description, acceptance criteria, or a linked decision bead. If the bead has "Option A / Option B / Option C" branches with no chosen winner, it is NOT ready. (This is the load-bearing gate — Antigravity will pick the first plausible option and ship it.)
2. **Scope-pinned.** Specific files, or unambiguous "do X wherever pattern Y appears" instructions. Acceptance criteria must be writable as concrete test assertions.
3. **Concrete acceptance.** End-state is testable: "X test passes", "Y string no longer in repo", "form has `type=email autocomplete=current-password`", "DB constraint rejects bad insert". Not "improve UX", not "make it cleaner".
4. **Concrete verification plan.** Bead names the exact command(s) to run: `pnpm run check`, `pnpm run preflight`, `pnpm exec playwright test e2e/path/file.spec.ts --project=chromium`. If verification needs CI (e.g., Supabase branch DB), say so explicitly.
5. **UI work is mechanical OR pre-approved.** Rename, prop rewire, copy change, icon swap, class addition (`motion-reduce:`), `aria-foo` add, delete dead element. Or: pre-approved mockup / exact dimensions / linked design bible section. NO "does this look right?" judgment.
6. **Self-contained.** No dependency on an open PR, no cross-bead coordination, no waiting on a teammate.

**Workflow:**

- Tag during grooming: `bd label add agy-ready <id>` and append a one-line fit note.
- If a fixable gate fails (missing verification plan, undecided UI, open Option A/B fork), leave a `bd comment` describing the gap instead of tagging — surface for refinement.
- Discover candidates: `bd query "label=agy-ready AND status=open" --priority-max=2` (priority filter is a heuristic — pick P1/P2 first).
- After Antigravity ships a PR, treat it like any other agent PR: Copilot review, CI, ready-for-review label, then Tim merges.

**When in doubt, default to FAIL.** Under-tagging is safe — Antigravity just has fewer candidates to pick from. Over-tagging causes Antigravity to make judgment calls it was never meant to make, silently shipping wrong choices. If a gate is ambiguous, add a `bd comment` describing the gap and skip the tag.
