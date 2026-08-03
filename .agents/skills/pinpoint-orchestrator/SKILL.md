---
name: pinpoint-orchestrator
description: Coordinating parallel subagent work in git worktrees — the lead's coordinator-not-implementer boundary, the two upstream Claude Code worktree bugs and what each one actually requires (dispatch only from the main worktree for #47548; the `WorktreeCreate` lock relaxes the old N=1 rule for #47266), why the bead rather than the prompt carries scope and what a mechanical-refactor bead must name out-of-scope, the lead's review backstop now that no bot reviews this repo and a finished subagent leaves a PR unreviewed forever, and the beads-close-on-merge lifecycle. Use when dispatching subagents, when a parent branch flips after dispatch, when deciding whether a PR is ready to hand Tim, or when the user says "spin up agents", "orchestrate", or "parallel work".
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

**`merge-pr.sh` is human-only (PP-wi85)** — blocked for agents via ANY invocation shape,
including `--dry-run`. The lead does NOT run it, even to preview gates. Once the PR is ready,
hand Tim `! scripts/workflow/merge-pr.sh <PR> --human`.

---

## Lead Orchestrator Role

You are a **coordinator, not an implementer**:

- **DO** launch subagents, review their output, send them follow-up corrections
- **DO** check CI dashboards, manage beads
- **DON'T** directly fix code in worktrees — message the subagent instead

If a subagent can't be reached (GC'd, session ended), spawn a new one on the same branch.

---

## Phase 1: Task Selection

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
3. Quality gate: "Run `pnpm run check` before returning."
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

See `pinpoint-pr-workflow` Phase 3.6. Apply `ready-for-review` after CI green + a marker pinning head + zero unresolved review threads. The label does **not** get the PR reviewed (see the backstop below).

### Ensure every PR is reviewed (lead backstop)

The merge bar is unchanged: no PR merges without a review covering the **head commit**, recorded as a SHA-pinned marker (`<!-- pinpoint-claude-review: <head_sha> -->`), with threads resolved. What changed on 2026-08-02 (PP-4ric) is who reviews: **no bot does.** The reviewer is Tim running `/code-review`, which no agent — lead or subagent — can launch.

That makes the lead's job here a scheduling one. A subagent that finishes and ends leaves a PR sitting unreviewed forever, because there is nothing to wait for. **Check the marker against head:**

```bash
gh pr view <PR> --json headRefOid --jq .headRefOid
gh api repos/timothyfroehlich/PinPoint/issues/<PR>/comments --jq '.[] | select(.body | startswith("<!-- pinpoint-claude-review:")) | .body' | head -1
```

Before applying `ready-for-review` or handing a PR to Tim for `merge-pr.sh --human`, confirm the marker pins head. If it doesn't, distinguish the cases:

**No marker at all** → nobody has reviewed it. Batch it with the other PRs waiting on Tim rather than pinging him per-PR: tell him which branches are ready for `/code-review`, and let him work through them.

**A marker pinning an older SHA** → someone reviewed it, then pushed past the review. What was pushed decides the fix: if it was the review's own findings, re-attest at the new head and say so in the summary; if it was new work, it needs a fresh `/code-review`.

**A marker pinning head** → nothing to do. That review is legitimately terminal.

Don't post a marker to paper over a review nobody ran, and don't ask Tim to `--force`. The `reviewed` gate in `merge-pr.sh` is the hard enforcement — it FAILs on both un-reviewed states and never WAITs, since with no bot in the loop there is no answer already on its way. Satisfying it honestly before handoff is the lead's job.

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

- `bd ready -n 50` — the default limit is 10, which hides work.
- Cross-reference `bd list --status=in_progress` against merged PRs; close what landed.
- Check for closed issues still blocking others (`bd blocked` → `bd dep remove`).
- `bd dolt pull` only in **embedded** beads mode. In **server** mode
  (`dolt_mode: "server"` in `.beads/metadata.json` — the shared Bazzite Dolt
  server) reads/writes are already live against the one shared DB; there is
  nothing to pull, and the DoltHub bridge handles remote replication.

### Cleanup

The `WorktreeRemove` hook does NOT remove finished agent worktrees — it only runs cleanup when something else initiates removal, so a background agent that pushes and ends leaves its directory on disk forever. `python3 scripts/worktree_reap.py` is what removes them (PP-49x5; dry-run by default, `--apply` to reclaim). For manually created worktrees, run `python3 scripts/worktree_cleanup.py <path>` yourself — plain `git worktree remove` leaks slot entries and Docker volumes. `./scripts/workflow/stale-worktrees.sh` covers manually created `../pinpoint-worktrees/*` ONLY.

## Error Recovery

| Problem                                      | Fix                                                                                                                                                                                                            |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Subagent fails to create PR                  | Check output, verify worktree state, message it with context                                                                                                                                                   |
| Permission denied on worktree                | Add paths to `.claude/settings.json`, restart session                                                                                                                                                          |
| Worktree creation fails                      | `supabase stop` (current worktree only — **never** `--all`), then re-create with `git worktree add`                                                                                                            |
| `.git/config.lock` race on parallel dispatch | anthropics/claude-code#47266 — the `WorktreeCreate` hook mitigates this. Verify `worktree-create.sh` is registered in `.claude/settings.json`; only if missing/disabled, serialize to one dispatch per message |
| Parent branch flips after dispatch           | anthropics/claude-code#47548. You dispatched from a linked worktree. Always dispatch from the main worktree                                                                                                    |
| Husky post-checkout hook fails               | Check `.husky/post-checkout` for merge conflict markers                                                                                                                                                        |
