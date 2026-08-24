---
name: pinpoint-orchestrator
description: Coordinating parallel subagent work in git worktrees — the lead's coordinator-not-implementer boundary, the two upstream Claude Code worktree bugs and what each one actually requires (dispatch only from the main worktree for #47548; the `WorktreeCreate` lock relaxes the old N=1 rule for #47266), why the bead rather than the prompt carries scope and what a mechanical-refactor bead must name out-of-scope, the lead's backstop when an owning session exits before automatic review completes, the beads-close-on-merge lifecycle, and what actually removes a finished subagent's worktree (`worktree_reap.py` reaps on proof, `worktree_cleanup.py` tears down, and neither fires for an agent that just commits and ends). Use when dispatching subagents, when a parent branch flips after dispatch, when deciding whether a PR is ready to hand Tim, when finished worktrees are piling up on disk, or when the user says "spin up agents", "orchestrate", or "parallel work".
---

# Pinpoint Orchestrator

Coordinate multiple subagents working in parallel across isolated git worktrees.

## When to Use This Skill

- Multiple independent beads issues ready to work (`bd ready` shows 2+ items)
- Assigning an issue end-to-end to a subagent (implement → PR → CI green)
- Review feedback on multiple PRs needs addressing
- Parallel feature development across branches
- User says "spin up agents", "orchestrate", "parallel work", "dispatch"

## Situational awareness

`./scripts/workflow/orchestration-status.sh` is one call for the full picture — PR dashboard,
worktree health, beads, security alerts (`--prs-only`, `--worktrees-only`, `--beads-only`,
`--security-only` narrow it). `pr-dashboard.sh [PRs...]` and `pr-watch.py <PR>` cover CI.

**The merge decision is Tim's (PP-wi85, reversed for the script per Tim 2026-08-19).** The
lead MAY run `bash scripts/workflow/merge-pr.sh <PR> --human`, but `block-direct-merge.cjs`
turns it into an approval prompt Tim must accept before it runs. The raw channels (`gh pr
merge`, `gh api PUT .../merge`, MCP `merge_pull_request`) stay hard-blocked. Normal flow is
still to finish the PR and hand it off — either you run the script and Tim approves the
prompt, or you hand him `! scripts/workflow/merge-pr.sh <PR> --human` to run himself.

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
bd ready -n 50              # Issues with no blockers. The default limit is 10, which hides work
bd list --status=open       # All open issues
```

Present options to the user. Before proceeding, verify tasks are independent:

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

---

## Phase 3: Agent Dispatch

`Agent(subagent_type: "general-purpose", isolation: "worktree", run_in_background: true, mode: "bypassPermissions", name: "<short-name>")`. The optional `name` makes the agent addressable via `SendMessage({to: name})`.

**Model**: omit `model` to inherit the session model (usually correct). Override only when confident a tier fits: a heavier model for judgment-heavy work, a lighter one for mechanical, well-specified changes.

**Quality is self-enforced** — hooks don't fire for subagents. Keep the prompt **small** — the bead is the source of truth and the subagent can read it. Every prompt MUST include:

1. The bead ID + "First run `bd show <id>` && `bd update <id> --claim`, then work from the bead." The bead carries scope, files, line numbers, and acceptance criteria — do NOT restate them in the prompt (two places to drift).
2. Only context that ISN'T already in the bead — cross-bead conflicts, a reference PR, sequencing constraints. Omit when there's nothing to add.
3. Quality gate: point the agent at **AGENTS.md §5 "Which tests to run"** and tell it to run the tiers matching what it touched. Do **not** write "run `pnpm run check`" and stop — `check` is a static gate that runs no unit tests and no pytest (PP-4zcj), so that instruction cannot fail on a broken test and CI becomes the first thing that notices (PP-lql4).
4. Full PR lifecycle: "Create PR, verify CI green."
5. Structured return format: branch, PR#, CI status, blockers

Ready-to-use prompt, follow-up template, and the annotated rationale for each part: [references/agent-prompt-template.md](references/agent-prompt-template.md).

> **The bead must be complete — especially for mechanical refactors.** Because the agent executes the bead literally and you're no longer restating scope in the prompt, the bead has to carry it. A "convert/rename only X" bead MUST include an explicit **out-of-scope** list naming the look-alikes that are intentionally excluded, and why — otherwise the agent over-scopes. Casework: a "convert 2 catch blocks to the `err()` helper" bead ballooned to 6, Sentry-wrapping a rate-limit guard and a Zod-validation guard that are _expected user conditions, not server errors_ (PR #1247 → reverted in #1250). If the bead doesn't say "don't touch Y," the agent will.

---

## Phase 4: Monitor Loop

### Follow-Up via SendMessage

A spawned agent keeps its context — continue it with `SendMessage` using its ID or name rather than spawning fresh. CI failed? Pull the failure logs (`gh run view <run-id> --log-failed | tail -50`) and send the context. Review comments? Inspect via MCP (see `pinpoint-pr-workflow` Phase 3.2–3.3), then message the subagent.

**Infrastructure failures** — first log the flake, then rerun (see `docs/runbooks/gha-flake-log.md`):

```bash
bash scripts/workflow/log-gha-flake.sh <pr> <run-id> <class> "<symptom>"
gh run rerun <run-id> --failed
# (optionally re-run the helper with --rerun green|red once the rerun outcome is known)
```

### Label Ready PRs

See `pinpoint-pr-workflow` Phase 3.6. Apply `ready-for-review` only after current-head
CI, review, thread, conflict, and screenshot gates pass. This label is the final merge-ready
signal; it is separate from GitHub's draft/ready state.

### Ensure every PR is reviewed (lead backstop)

Every agent-created PR opens as a draft. The owning session monitors current-head CI,
promotes the PR, handles automatic Codex findings, and repeats the loop after corrective
pushes. For later uploads, it must apply the 51-line pre-push re-draft rule in
`pinpoint-pr-workflow` Phase 3.4. Keep that session alive or resume it; do not treat PR
creation or a green CI run as completion.

Before applying `ready-for-review` or handing the PR to Tim, confirm a trusted clean
Codex result covers the exact current head SHA and all threads are resolved. A stale
result means the automatic replacement review is still pending. Never comment
`@codex review` because automation is slow; do so only when Tim explicitly asks. A
SHA-pinned manual marker remains valid only when Tim explicitly ran the named local
review. Do not create new `claude-code:trivial` self-attestations.

---

## Phase 5: Completion

### Beads Issue Lifecycle

**Do NOT close beads issues when a PR is created.** Issues stay `in_progress` until PR **merges**.

| Event                   | Beads Action                            |
| ----------------------- | --------------------------------------- |
| Agent creates PR        | Issue stays `in_progress`               |
| PR merges               | `bd close <id> --reason="PR #N merged"` |
| PR closed without merge | `bd update <id> --status=open`          |

### Beads hygiene

- Cross-reference `bd list --status=in_progress` against merged PRs; close what landed.
- Check for closed issues still blocking others (`bd blocked` → `bd dep remove`).
- `bd dolt pull` only in **embedded** beads mode. In **server** mode
  (`dolt_mode: "server"` in `.beads/metadata.json` — the shared Bazzite Dolt
  server) reads/writes are already live against the one shared DB; there is
  nothing to pull, and the DoltHub bridge handles remote replication.

### Cleanup

The `WorktreeRemove` hook does not identify finished agent worktrees, so a background agent that pushes and ends can leave its directory on disk. `python3 scripts/worktree_reap.py` finds landed work across Git's full worktree inventory (Claude, Codex, Antigravity, or manual paths) and delegates removal to `worktree_cleanup.py` (PP-49x5; dry-run by default, `--apply` to reclaim). For direct cleanup, run `python3 scripts/worktree_cleanup.py <path>`; configure Codex's target-worktree cleanup as `python3 scripts/worktree_cleanup.py .`. Plain `git worktree remove` leaks slot entries and Docker volumes.

## Error Recovery

| Problem                                      | Fix                                                                                                                                                                                                            |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Subagent fails to create PR                  | Check output, verify worktree state, message it with context                                                                                                                                                   |
| Permission denied on worktree                | Add paths to `.claude/settings.json`, restart session                                                                                                                                                          |
| Worktree creation fails                      | `supabase stop` (current worktree only — **never** `--all`), then re-create with `git worktree add`                                                                                                            |
| `.git/config.lock` race on parallel dispatch | anthropics/claude-code#47266 — the `WorktreeCreate` hook mitigates this. Verify `worktree-create.sh` is registered in `.claude/settings.json`; only if missing/disabled, serialize to one dispatch per message |
| Parent branch flips after dispatch           | anthropics/claude-code#47548. You dispatched from a linked worktree. Always dispatch from the main worktree                                                                                                    |
| Husky post-checkout hook fails               | Check `.husky/post-checkout` for merge conflict markers                                                                                                                                                        |
