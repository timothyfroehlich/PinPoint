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

### Code review

`REVIEW.md` at the repo root is the canonical review rubric, shared with Antigravity. Read it before launching the code-review skill.

**No bot reviews this repo — Copilot review was retired 2026-08-02 (PP-4ric).** A review covering the head commit is still required to merge, and the reviewer is Tim running `/code-review`, which you cannot launch. Finish your churn first, then hand him the command to paste — `/code-review <depth> --comment <PR#>`. `--comment` posts the findings to the PR as inline review comments, which both block the merge until you resolve them and satisfy the `reviewed` gate by pinning head (PP-97tt); the `<PR#>` is required for it to post at all, and `ultra` ignores it. A review that found nothing posts nothing, so attest that case yourself with `bash scripts/workflow/mark-claude-review.sh <PR> <depth> "<findings>"` (`<depth>` = the `/code-review` level he ran). Every kind of evidence pins a SHA, so a later push invalidates it. Full rules: `pinpoint-pr-workflow` Phase 3.4.

### Sandbox network isolation

- `gh` CLI TLS errors are fixed by `enableWeakerNetworkIsolation: true` in `.claude/settings.local.json`.

### Working Style

- If you've spent more than 3 tool calls on environment setup without reproducing
  the actual issue, stop and ask the user for guidance.
- For simple PRs (< 5 files changed), do not spawn more than 2 sub-agents.
- Do not over-engineer or spawn excessive parallel agents for straightforward tasks.

### Status Vocabulary

- **"Shipped" means the change is live in production — deployed, nothing less.** Never call work "shipped" at an earlier stage. Use precise words for the rungs below it: _implemented_ (code written, local checks green), _PR opened / in review_ (pushed, PR exists, CI pending), _merged_ (on `main`). Match the word to the actual rung — don't let an earlier stage borrow a later word.

### Worktree Dispatch Safety

Two upstream Claude Code bugs affect `Agent(isolation: "worktree")` dispatch. One (`#47548`) requires active enforcement — the hook cannot fix it. The other (`#47266`) is mitigated by the `WorktreeCreate` hook (PP-bg45) at the OS lock level. "Main worktree" below means the original repository clone — the worktree where `.git/` is a directory, not a file pointing into `.git/worktrees/`. It is **not** about being on the `main` branch.

1. **Dispatch only from the main worktree.** If your CWD is inside `.claude/worktrees/agent-*` or any other linked (non-primary) worktree, **refuse and explain**: upstream bug [anthropics/claude-code#47548](https://github.com/anthropics/claude-code/issues/47548) silently switches the parent worktree's branch to the subagent's new branch when dispatched from a linked worktree — even at N=1. Tell the user you need to switch back to the main worktree first, or ask whether they want to accept the risk. The `WorktreeCreate` hook does NOT fix this bug.

2. **Parallel dispatch is safe when the `WorktreeCreate` hook is active.** The `.claude/hooks/worktree-create.sh` hook (PP-bg45) wraps `git worktree add` with `lockf(1)` on `~/.config/pinpoint/worktree-add.lock` — a kernel-level exclusive lock shared across all Claude sessions on the host — plus retry + exponential backoff. Any N `Agent(isolation: "worktree")` calls per message are safe from the main worktree while this hook is registered in `.claude/settings.json`. The prior N=1-per-message rule from PR #1353 ([anthropics/claude-code#47266](https://github.com/anthropics/claude-code/issues/47266)) is relaxed.

   **Fallback (hook disabled or missing):** Serialize — one `Agent(isolation: "worktree")` call per message. Dispatch, confirm the new `.claude/worktrees/agent-*` directory appeared on disk, then dispatch the next.

If the user explicitly overrides ("yes, do it anyway"), proceed. These rules require push-back + explanation, not silent compliance.

See `pinpoint-orchestrator` skill Phase 2 for the full technical record.

### Worktrees (Claude Code specifics)

- **Dispatch**: `isolation: "worktree"` works out of the box — Claude Code creates the worktree, the `post-checkout` hook configures it (slot allocation, ports, `.env.local`, `.claude/launch.json`).
- **Cleanup**: Claude Code's `WorktreeRemove` hook runs `scripts/worktree_cleanup.py` (stops Supabase, removes Docker volumes, deallocates slot) **when something removes a worktree** — it does not remove finished worktrees itself, and it never fires for a background agent that just commits, pushes and ends. Manual `git worktree remove /path` or `rm -rf` skips the hook entirely — slot manifest entry and Docker volumes leak. `scripts/worktree_orphan_sweep.py` reconciles the slot manifest, active worktrees, and Supabase Docker resources.
- **Reaping**: `scripts/worktree_reap.py` is what actually removes worktrees whose work has landed (it delegates teardown to `worktree_cleanup.py`). The sweep cannot see them — a worktree still on disk is "active" by its definition. Reaps only on positive proof (merged PR with `HEAD == headRefOid` + clean tree, or zero commits ahead of `origin/main` with no PR); dry-run by default, `--apply` to reclaim. `merge-pr.sh` reaps the merged branch's worktree on merge. The SessionStart hook runs the sweep **and** the reap in dry-run mode every 6h and surfaces a one-line nudge when either finds something.
- **Branch creation**: `Agent(isolation:"worktree")` handles branch creation automatically. AGENTS.md §5 "Branches" rules still apply if you create a branch manually inside an existing worktree.

### Parallel Subagent Workflow

For multiple independent tasks, use worktree-isolated subagents.

**Primary**: Standalone subagents with `isolation: "worktree"` + `run_in_background: true`. Use `SendMessage` (by agent ID or `name`) for follow-up (review comments, CI fixes). The `post-checkout` hook automatically allocates ports and generates configs.

**Quality Enforcement**: Self-enforced via prompt instructions (`pnpm run check` before returning). Hooks don't fire for subagents.

**Anti-patterns**:

- DON'T dispatch `Agent(isolation: "worktree")` from a linked (non-primary) worktree — see "Worktree Dispatch Safety" above (bug #47548, WorktreeCreate hook cannot fix this)
- DON'T fire N+ `Agent(isolation: "worktree")` calls without the WorktreeCreate hook active — with the hook any N is safe from the main worktree (flock serializes); without it, serialize to N=1-per-message

See `pinpoint-orchestrator` skill for the full workflow and known-bug details.

### Session Completion (Claude Code specifics)

The "Landing the plane" checklist (`pinpoint-pr-workflow` skill, Phases 4–5) applies to the lead agent and solo sessions.
