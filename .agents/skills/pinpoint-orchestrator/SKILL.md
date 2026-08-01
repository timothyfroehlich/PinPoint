---
name: pinpoint-orchestrator
description: Orchestrate parallel subagent work in git worktrees — task selection, end-to-end dispatch, monitoring, follow-up, and cleanup.
---

# Pinpoint Orchestrator

Coordinate multiple subagents working in parallel across isolated git worktrees.

## When to Use This Skill

- Multiple independent beads issues ready to work (`bd ready` shows 2+ items)
- Assigning an issue end-to-end to a subagent (implement → PR → CI green)
- Review feedback on multiple PRs needs addressing
- Parallel feature development across branches
- User says "spin up agents", "orchestrate", "parallel work", "dispatch"

## Scripts Reference

```bash
# Orchestration startup (ONE call for full situational awareness)
./scripts/workflow/orchestration-status.sh               # PR dashboard + worktree health + beads + security alerts
./scripts/workflow/orchestration-status.sh --prs-only    # Just PR dashboard
./scripts/workflow/orchestration-status.sh --security-only  # Just Dependabot alerts
# (also: --worktrees-only, --beads-only)

# PR monitoring
./scripts/workflow/pr-dashboard.sh [PR numbers...]       # CI + merge status table (all open PRs if no args)
./scripts/workflow/pr-watch.py <PR>                      # Stream CI events (Monitor-tool compatible; canonical)
./scripts/workflow/pr-watch.py --check-ready <PR>        # One-shot readiness audit (pass/fail; exits 0 if ready)

# Review thread inspection + reply → use MCP via pinpoint-pr-workflow skill Phase 3
# (mcp__github__pull_request_read / add_reply_to_pull_request_comment / pull_request_review_write)

# Readiness label + merge handoff: pinpoint-pr-workflow skill Phases 3.4-3.6 + 4
# Apply label via mcp__github__issue_write or `gh pr edit --add-label`
# merge-pr.sh is human-only (PP-wi85) — blocked for agents via ANY invocation shape,
# including --dry-run. The lead does NOT run it, even to preview gates. Once the PR
# is ready (label applied, screenshots posted if UI-touching), hand Tim:
#   ! scripts/workflow/merge-pr.sh <PR> --human
gh pr edit <PR> --add-reviewer "@copilot"                     # Request the Copilot review — request-only since 2026-08-01; nothing fires it for you
bash scripts/workflow/mark-claude-review.sh <PR> "<summary>"  # Fallback ONLY after requesting: SHA-pinned Claude-review marker, and only if you actually read the diff
node scripts/workflow/pr-screenshots.mjs <PR>                 # UI-touching PRs: desktop+mobile screenshots, sticky PR comment

# Worktree health — covers manually created ../pinpoint-worktrees/* ONLY;
# agent-created .claude/worktrees/* are handled by the WorktreeRemove hook and not scanned here
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

**Quality is self-enforced** — hooks don't fire for subagents. Keep the prompt **small** — the bead is the source of truth and the subagent can read it. Every prompt MUST include:

1. The bead ID + "First run `bd show <id>` && `bd update <id> --claim`, then work from the bead." The bead carries scope, files, line numbers, and acceptance criteria — do NOT restate them in the prompt (two places to drift).
2. Only context that ISN'T already in the bead — cross-bead conflicts, a reference PR, sequencing constraints. Omit when there's nothing to add.
3. Quality gate: "Run `pnpm run check` before returning."
4. Full PR lifecycle: "Create PR, verify CI green."
5. Structured return format: branch, PR#, CI status, blockers

**Prompt template:**

```markdown
## Task

Work bead <ID>. First run `bd show <ID>` && `bd update <ID> --claim` — the bead is the spec. Implement exactly what it describes; don't expand scope.

## Context not in the bead

<only what the bead doesn't already say — cross-bead conflicts, reference PRs, sequencing. Omit this section entirely if there's nothing to add.>

## Quality Gates

Run `pnpm run check` before returning. Then self-review **by hand**: read your own diff (`git diff origin/main...HEAD`) against `REVIEW.md` — the canonical rubric — plus the bead's acceptance criteria and out-of-scope list, and fix what you find. Don't reach for `/code-review` or `ultra`: both are user-triggered harness surfaces (`ultra` is also billed) and an agent cannot launch either.

A review covering the head commit is still **required** to merge — only its timing changed. Copilot is request-only: nothing requests it for you, not a push, not the `ready-for-review` label, not green CI. So finish churning first — implementation, CI fixes, self-review fixes, merge-from-main — and only then request it, once:

`gh pr edit <PR> --add-reviewer "@copilot"`

If you push after requesting, that review no longer covers head and there is no auto re-request; batch your remaining fixes, then re-request once with the same command. Only if Copilot fails to deliver on a request you actually made (silent skip or quota limit) do you fall back to `bash scripts/workflow/mark-claude-review.sh <PR> "<summary>"` — and only after genuinely reading the diff. The marker is an attestation, not a way to skip asking.

## Return Format

Report back with:

- **Branch**: <branch name>
- **PR**: #<number>
- **CI**: passing/failing/pending
- **Self-review**: findings addressed
- **Copilot review**: requested (when?) / landed / fell back to marker
- **Blockers**: none or description
```

Full annotated version: `references/agent-prompt-template.md`.

> **The bead must be complete — especially for mechanical refactors.** Because the agent executes the bead literally and you're no longer restating scope in the prompt, the bead has to carry it. A "convert/rename only X" bead MUST include an explicit **out-of-scope** list naming the look-alikes that are intentionally excluded, and why — otherwise the agent over-scopes. Casework: a "convert 2 catch blocks to the `err()` helper" bead ballooned to 6, Sentry-wrapping a rate-limit guard and a Zod-validation guard that are _expected user conditions, not server errors_ (PR #1247 → reverted in #1250). If the bead doesn't say "don't touch Y," the agent will.

---

## Phase 4: Monitor Loop

### Dashboard

```bash
./scripts/workflow/pr-dashboard.sh 940 941 942       # Specific PRs
./scripts/workflow/pr-dashboard.sh                    # All open PRs
./scripts/workflow/pr-watch.py <PR>                   # Stream one PR's CI events
```

### Follow-Up via SendMessage

A spawned agent keeps its context — continue it with `SendMessage` using its ID or name rather than spawning fresh. Common scenarios:

- CI fails → get failure logs → send failure context
- User requests changes → send review feedback

### Handle Failures

**CI fails** → Get context, then message the subagent:

```bash
gh run view <run-id> --log-failed | tail -50
```

**Review comments** → Inspect via MCP (see pinpoint-pr-workflow skill Phase 3.2-3.3), then message the subagent:

```
mcp__github__pull_request_read(method: "get_review_comments", owner, repo, pullNumber, perPage: 100)
```

**Infrastructure failures** — first log the flake, then rerun (see `docs/runbooks/gha-flake-log.md`):

```bash
bash scripts/workflow/log-gha-flake.sh <pr> <run-id> <class> "<symptom>"
gh run rerun <run-id> --failed
# (optionally re-run the helper with --rerun green|red once the rerun outcome is known)
```

### Label Ready PRs

See pinpoint-pr-workflow skill Phase 3.6. Apply `ready-for-review` after CI green + a review covering head + zero unresolved review threads. The label does **not** request the Copilot review — Tim considered wiring it that way and rejected it; requesting stays an explicit act (see the backstop below). Apply via:

```
mcp__github__issue_write(method: "update", owner, repo, issue_number: <PR>, labels: [<existing>..., "ready-for-review"])
```

Or fallback: `gh pr edit <PR> --add-label ready-for-review`.

### Ensure every PR is reviewed (lead backstop)

The merge bar is unchanged: no PR merges without a review covering the **head commit** — a Copilot review or a SHA-pinned Claude marker (`<!-- pinpoint-claude-review: <head_sha> -->`) — with threads resolved. What changed on 2026-08-01 is that Copilot is **request-only**, so the most likely reason head is unreviewed is now the most boring one: nobody asked.

The subagent is instructed to request it (Phase 3 template), but an explicit request is forgettable — Tim accepted that tradeoff knowingly, which makes the lead's check at the handoff boundary load-bearing. Before applying `ready-for-review` or handing a PR to Tim for `merge-pr.sh --human`, confirm head is covered. If it isn't, distinguish the two cases rather than reaching straight for the marker:

**No review was ever requested** → that's an unfinished PR, not a fallback case. Have the subagent stop iterating and request it once:

```bash
gh pr edit <PR> --add-reviewer "@copilot"
```

Then wait for the review and handle its threads. Don't post a marker to paper over a request nobody made, and don't ask Tim to `--force`.

**A request was made and Copilot didn't deliver** (silent skip, or quota-limited) → run the fallback:

1. Review the PR diff yourself — a deliberate manual pass over `git diff origin/main...HEAD` against `REVIEW.md` (the canonical rubric) and the bead's acceptance criteria. `/code-review` is a harness built-in that only Tim can trigger, and `ultra` is the cloud multi-agent review — user-triggered and billed. An agent can launch neither, so the manual pass is the backstop.
2. Address serious findings (fix → have the subagent push → re-review; a fix re-arms the gate). Decline the rest.
3. `bash scripts/workflow/mark-claude-review.sh <PR> "<summary>"` to post the marker.

**A review landed but the subagent pushed after it** → the review no longer covers head and nothing re-requests automatically (deliberate: re-requesting per push is the quota burn this change eliminates). Have it finish iterating, then re-request once with the same command.

The `reviewed` gate in `merge-pr.sh` is the hard enforcement — it FAILs the merge if the head commit has no Copilot or Claude review once the 600s window has elapsed. Note that window is still measured from the **head push** until PP-lzaw re-keys it to the request, so an unrequested PR burns the full 600s waiting for nothing before failing. Satisfying the gate honestly before handoff is the lead's job; telling Tim to `--force`-bypass it defeats the guarantee.

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
- #124: Add owner link — CI failing

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
- `bd dolt pull` only in **embedded** beads mode. In **server** mode
  (`dolt_mode: "server"` in `.beads/metadata.json` — the shared Bazzite Dolt
  server) reads/writes are already live against the one shared DB; there is
  nothing to pull, and the DoltHub bridge handles remote replication.

---

## Anti-Patterns

- **DON'T assume hooks enforce quality for subagents** — include `pnpm run check` in the prompt
- **DON'T fix code yourself as the orchestrator** — message the subagent
- **DON'T dispatch from a linked worktree** — bug #47548 (see Phase 2)

## Error Recovery

| Problem                                      | Fix                                                                                                                                                                                                            |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Subagent fails to create PR                  | Check output, verify worktree state, message it with context                                                                                                                                                   |
| Permission denied on worktree                | Add paths to `.claude/settings.json`, restart session                                                                                                                                                          |
| Worktree creation fails                      | `supabase stop` (current worktree only — **never** `--all`), then re-create with `git worktree add`                                                                                                            |
| `.git/config.lock` race on parallel dispatch | anthropics/claude-code#47266 — the `WorktreeCreate` hook mitigates this. Verify `worktree-create.sh` is registered in `.claude/settings.json`; only if missing/disabled, serialize to one dispatch per message |
| Parent branch flips after dispatch           | anthropics/claude-code#47548. You dispatched from a linked worktree. Always dispatch from the main worktree                                                                                                    |
| Husky post-checkout hook fails               | Check `.husky/post-checkout` for merge conflict markers                                                                                                                                                        |
