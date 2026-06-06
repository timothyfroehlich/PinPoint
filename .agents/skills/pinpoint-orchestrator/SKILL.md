---
name: pinpoint-orchestrator
description: Orchestrate parallel subagent work in git worktrees — task selection, end-to-end dispatch, monitoring, follow-up, and cleanup.
---

# Pinpoint Orchestrator

Coordinate multiple subagents working in parallel across isolated git worktrees.

## When to Use This Skill

- Multiple independent beads issues ready to work (`bd ready` shows 2+ items)
- Assigning an issue end-to-end to a subagent (implement → PR → Copilot → CI green)
- Copilot review feedback on multiple PRs needs addressing
- Parallel feature development across branches
- User says "spin up agents", "orchestrate", "parallel work", "dispatch"

## Scripts Reference

```bash
# Orchestration startup (ONE call for full situational awareness)
./scripts/workflow/orchestration-status.sh               # PR dashboard + worktree health + beads + security alerts
./scripts/workflow/orchestration-status.sh --prs-only    # Just PR dashboard
./scripts/workflow/orchestration-status.sh --security-only  # Just Dependabot alerts

# PR monitoring
./scripts/workflow/pr-dashboard.sh [PR numbers...]       # CI + Copilot + merge status table (all open PRs if no args)
./scripts/workflow/pr-watch.py <PR>                      # Stream CI + review events (Monitor-tool compatible; canonical)
./scripts/workflow/pr-watch.py --check-ready <PR>        # One-shot readiness check (structured tokens)

# Copilot thread inspection + reply → use MCP via pinpoint-pr-workflow skill Phase 3
# (mcp__github__pull_request_read / add_reply_to_pull_request_comment / pull_request_review_write)

# Readiness label + merge: pinpoint-pr-workflow skill Phases 3.5 + 4
# Apply label via mcp__github__issue_write or `gh pr edit --add-label`
bash scripts/workflow/merge-pr.sh <PR>                   # Composite gate-then-merge enforcer (--dry-run, --force)
bash scripts/workflow/merge-pr.sh <PR> --dry-run         # Preview gate evaluation without merging

# Worktree health
./scripts/workflow/stale-worktrees.sh                    # Report stale/active/dirty worktrees
./scripts/workflow/stale-worktrees.sh --clean            # Auto-remove stale worktrees

# Worktree management (post-checkout hook auto-configures ports + Supabase)
git worktree list                                             # Show all worktrees
python3 scripts/worktree_cleanup.py <worktree-path>           # Full cleanup (Supabase stop, Docker volumes, manifest, worktree removal)
```

---

## Lead Orchestrator Role

You are a **coordinator, not an implementer**:

- **DO** launch subagents, review their output, send them follow-up corrections
- **DO** check CI dashboards, manage beads
- **DON'T** directly fix code in worktrees — message the subagent instead

If a subagent can't be reached (GC'd, session ended), spawn a new one on the same branch.

---

## Phase 1: Task Selection

```bash
bd ready                    # Issues with no blockers
bd list --status=open       # All open issues
```

Present options to user. Before proceeding, verify tasks are independent:

- No task blocks another (`bd show <id>`)
- Tasks don't modify the same files

---

## Phase 2: Worktree Setup

`isolation: "worktree"` handles creation automatically. The Husky `post-checkout` hook runs `scripts/worktree_setup.py` to allocate ports and generate configs.

> **Known bug — dispatch-from-linked-worktree** (anthropics/claude-code#47548): Dispatching `Agent(isolation: "worktree")` from inside a linked (non-primary) worktree, e.g. `.claude/worktrees/agent-*`, silently switches the parent worktree's branch to the subagent's new branch. Fires at N=1. **Always dispatch from the main worktree** — the original clone where `.git/` is a directory. The `WorktreeCreate` hook does NOT fix this bug (it is path-based, not race-based).
>
> **Parallel-batch race mitigated — hook active** (anthropics/claude-code#47266): The `.claude/hooks/worktree-create.sh` hook (PP-bg45) wraps `git worktree add` with `lockf(1)` (macOS `flock(2)` equivalent) on `~/.config/pinpoint/worktree-add.lock` — a kernel-level lock shared across all Claude sessions on the host — plus retry + exponential backoff. **Any N `Agent(isolation: "worktree")` calls per message are now safe from the main worktree** — the hook serializes worktree creation at the OS level. The prior N=1-per-message rule from PR #1353 is relaxed.
>
> **Fallback**: If the hook is disabled or missing, revert to the N=1-per-message rule: dispatch one, confirm `.claude/worktrees/agent-*` appeared on disk, then dispatch the next.

Manual worktree creation is for the lead's own use only:

```bash
git worktree add ../pinpoint-worktrees/<branch-name> -b <branch-name>
```

---

## Phase 3: Agent Dispatch

```
Agent(
  subagent_type: "general-purpose",
  isolation: "worktree",
  run_in_background: true,
  mode: "bypassPermissions",
  name: "<short-name>",          # optional but useful — makes the agent addressable via SendMessage({to: name})
  prompt: "<full prompt — see template below>"
)
```

**Model**: omit `model` to inherit the session model (usually correct). Override only when confident a tier fits: a heavier model for judgment-heavy work, a lighter one for mechanical, well-specified changes.

**Quality is self-enforced** — hooks don't fire for subagents. Every prompt MUST include:

1. Beads issue context (`bd show` output)
2. Specific files to modify and what to change
3. Quality gate: "Run `pnpm run check` before returning."
4. Full PR lifecycle: "Create PR, poll for Copilot review, address comments, verify CI green."
5. Structured return format: branch, PR#, CI status, Copilot status, blockers

**Prompt template:**

```markdown
## Task: <issue title>

<beads issue ID and description>

## Files to Modify

<specific files and what to change>

## Notes

<any task-specific context>

## Quality Gates

Run `pnpm run check` before returning.
If Copilot review doesn't arrive within 5 minutes, note timeout and return.

## Return Format

Report back with:

- **Branch**: <branch name>
- **PR**: #<number>
- **CI**: passing/failing/pending
- **Copilot**: no comments / N comments addressed / pending timeout
- **Blockers**: none or description
```

Full annotated version: `references/agent-prompt-template.md`.

---

## Phase 4: Monitor Loop

### Dashboard

```bash
./scripts/workflow/pr-dashboard.sh 940 941 942       # Specific PRs
./scripts/workflow/pr-dashboard.sh                    # All open PRs
./scripts/workflow/pr-watch.py <PR>                   # Stream one PR's CI + review events
```

### Follow-Up via SendMessage

A spawned agent keeps its context — continue it with `SendMessage` using its ID or name rather than spawning fresh. Common scenarios:

- Subagent returns "Copilot pending" → wait for review → send the actual comments
- CI fails → get failure logs → send failure context
- User requests changes → send review feedback

### Handle Failures

**CI fails** → Get context, then message the subagent:

```bash
gh run view <run-id> --log-failed | tail -50
```

**Copilot comments** → Inspect via MCP (see pinpoint-pr-workflow skill Phase 3.2-3.3), then message the subagent:

```
mcp__github__pull_request_read(method: "get_review_comments", owner, repo, pullNumber, perPage: 100)
```

**Infrastructure failures**:

```bash
gh run rerun <run-id> --failed
```

### Label Ready PRs

See pinpoint-pr-workflow skill Phase 3.5. Apply `ready-for-review` after CI green + zero unresolved Copilot threads via:

```
mcp__github__issue_write(method: "update", owner, repo, issue_number: <PR>, labels: [<existing>..., "ready-for-review"])
```

Or fallback: `gh pr edit <PR> --add-label ready-for-review`.

---

## Phase 5: Completion

### Beads Issue Lifecycle

**Do NOT close beads issues when a PR is created.** Issues stay `in_progress` until PR **merges**.

| Event                   | Beads Action                            |
| ----------------------- | --------------------------------------- |
| Agent creates PR        | Issue stays `in_progress`               |
| PR merges               | `bd close <id> --reason="PR #N merged"` |
| PR closed without merge | `bd update <id> --status=open`          |

### Final Summary

```
## Orchestration Complete

PRs Ready for Review:
- #123: Fix machine dropdown — All checks passing

PRs Needing Attention:
- #124: Add owner link — 2 Copilot comments

Remaining Worktrees:
- feat/task-def (PR #124 needs work)
```

### Cleanup

Worktrees created by `Agent(isolation: "worktree")` are cleaned up by Claude Code's `WorktreeRemove` hook (runs `scripts/worktree_cleanup.py`). For manually created worktrees, run the script yourself — plain `git worktree remove` leaks slot entries and Docker volumes:

```bash
python3 scripts/worktree_cleanup.py ../pinpoint-worktrees/<branch>
```

---

## Proactive Beads Maintenance

### On Session Start

- `bd ready -n 50` (default limit is 10, which hides work)
- `bd list --status=in_progress` to check for stale in-progress issues
- Cross-reference: any in-progress issues whose PRs are already merged? Close them
- Check for closed issues still blocking others (`bd blocked` → `bd dep remove`)

### During Work

- PR **merges** → immediately close the beads issue
- Agent creates PR → issue stays `in_progress`
- Discover new work → `bd create`
- Stale dependencies → `bd dep remove` to unblock

### On Session End

- `bd list --status=in_progress` — anything done? Close it
- `bd dolt pull` if using beads remote sync

---

## Anti-Patterns

- **DON'T assume hooks enforce quality for subagents** — include `pnpm run check` in the prompt
- **DON'T forget to check Copilot comments before merging**
- **DON'T fix code yourself as the orchestrator** — message the subagent
- **DON'T dispatch from a linked worktree** — bug #47548 (see Phase 2)

## Error Recovery

| Problem                                      | Fix                                                                                                                                    |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Subagent fails to create PR                  | Check output, verify worktree state, message it with context                                                                           |
| Permission denied on worktree                | Add paths to `.claude/settings.json`, restart session                                                                                  |
| Worktree creation fails                      | `supabase stop` (current worktree only — **never** `--all`), then re-create with `git worktree add`                                    |
| `.git/config.lock` race on parallel dispatch | anthropics/claude-code#47266. Serialize: one `Agent(isolation: "worktree")` per message, confirm worktree appeared, then dispatch next |
| Parent branch flips after dispatch           | anthropics/claude-code#47548. You dispatched from a linked worktree. Always dispatch from the main worktree                            |
| Husky post-checkout hook fails               | Check `.husky/post-checkout` for merge conflict markers                                                                                |
