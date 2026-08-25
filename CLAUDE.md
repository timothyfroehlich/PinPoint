# PinPoint Development Instructions (Claude Code)

@AGENTS.md

## Agent skills

### Issue tracker

PinPoint tracks durable project work in Beads. See `docs/agents/issue-tracker.md`.

### Domain docs

PinPoint uses single-context domain documentation. See `docs/agents/domain.md`.

## Claude Code-Specific

### Code review

`REVIEW.md` at the repo root is the canonical review rubric. Read it before launching the code-review skill.

Codex reviews every eligible PR update automatically. Author-side draft/CI/review ownership, the 51-line re-draft threshold, and explicit-request-only manual review paths are canonical in `pinpoint-pr-workflow` Phase 3.

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
- **Cleanup**: `python3 scripts/worktree_cleanup.py <worktree-path>` owns the complete teardown: Supabase, Docker volumes, Git removal/prune, then slot release. Claude's `WorktreeRemove` hook invokes the same module via `--claude-hook`; configure Codex cleanup as `python3 scripts/worktree_cleanup.py .`. Plain `git worktree remove` or `rm -rf` bypasses resource cleanup; `scripts/worktree_orphan_sweep.py --apply` reconciles leaks.
- **Reaping**: `scripts/worktree_reap.py` identifies landed worktrees and delegates teardown to `worktree_cleanup.py`. Its Git inventory includes Claude, Codex, Antigravity, and manual paths without provider-specific filtering. It reaps only on positive proof (merged PR with `HEAD == headRefOid` + clean tree, or zero commits ahead of `origin/main` with no PR); dry-run by default, `--apply` to reclaim. `merge-pr.sh` reaps the merged branch's worktree on merge. The SessionStart hook runs the sweep **and** reap dry-runs every 6h.
- **Branch creation**: `Agent(isolation:"worktree")` handles branch creation automatically. AGENTS.md §5 "Branches" rules still apply if you create a branch manually inside an existing worktree.

### Parallel Subagent Workflow

For multiple independent tasks, use worktree-isolated subagents.

**Primary**: Standalone subagents with `isolation: "worktree"` + `run_in_background: true`. Use `SendMessage` (by agent ID or `name`) for follow-up (review comments, CI fixes). The `post-checkout` hook automatically allocates ports and generates configs.

**Quality Enforcement**: Hooks don't fire for subagents, so the dispatch prompt is the enforcement. Point the agent at AGENTS.md §5 "Which tests to run" — the tiered list — not at `pnpm run check` alone, which is a static gate that runs no tests.

**Anti-patterns**:

- DON'T dispatch `Agent(isolation: "worktree")` from a linked (non-primary) worktree — see "Worktree Dispatch Safety" above (bug #47548, WorktreeCreate hook cannot fix this)
- DON'T fire N+ `Agent(isolation: "worktree")` calls without the WorktreeCreate hook active — with the hook any N is safe from the main worktree (flock serializes); without it, serialize to N=1-per-message

See `pinpoint-orchestrator` skill for the full workflow and known-bug details.

### Session Completion (Claude Code specifics)

The "Landing the plane" checklist (`pinpoint-pr-workflow` skill, Phases 4–5) applies to the lead agent and solo sessions.
