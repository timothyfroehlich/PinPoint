---
name: pinpoint-superpowers-bridge
description: Use when running the superpowers plugin lifecycle inside PinPoint — brainstorming, writing-plans, subagent-driven-development, requesting/receiving-code-review, or finishing-a-development-branch — and when a superpowers step wants to merge a branch locally, remove a worktree by hand, run generic npm/pytest tests, dispatch subagents without a scale gate, or write a spec/plan from the read-only root. Also when deciding which bead field a spec, plan, acceptance criterion, or landing note belongs in.
---

# PinPoint × Superpowers Bridge

The superpowers plugin (`brainstorming → writing-plans → subagent-driven-development → finishing-a-development-branch`) is a general-purpose lifecycle. Its skills live in an unwritable plugin cache, so PinPoint cannot edit them. This skill is the **project-side shim**: it says which superpowers steps to follow verbatim, which to override, and how the lifecycle's artifacts map onto beads.

**Precedence:** PinPoint rules (AGENTS.md / CLAUDE.md) and this skill override superpowers steps wherever they conflict. Everything not called out here, follow the superpowers skill as written.

**Load this whenever** you invoke any superpowers lifecycle skill inside PinPoint.

---

## 1. Field conventions — plans live in beads, not git

Superpowers specs and plans are **working documents** (decision 2026-08-16): draft them in the session scratchpad, not the repo tree — the superpowers default `docs/superpowers/` locations are retired for new files (the ones committed before the decision stay as records). The durable copy is the **bead**; durable _requirements_ go in `docs/feature-specs/` (`spec-driven-development` skill), never in a superpowers doc:

| Bead field     | Holds                                                           | Example                                                           |
| :------------- | :-------------------------------------------------------------- | :---------------------------------------------------------------- |
| `--spec-id`    | Feature spec path, when the work has one                        | `docs/feature-specs/pinballmap.md`                                |
| `--design`     | The **full plan text**, refreshed when it materially changes    | (the whole plan document, not a path)                             |
| `--acceptance` | Distilled success criteria (not the whole spec)                 | `Widget renders; server action persists; RTL + integration green` |
| `--notes`      | Landing breadcrumbs (PR #, branch, migration state, follow-ups) | `PR #1610 @ feat/widget-PP-xxxx; no migration; follow-up PP-yyyy` |

**Cross-session recovery:** read the bead — `bd show <id>` returns the plan verbatim. There is no file on any branch to go looking for.

**Plan-file checkboxes are within-PR execution state, not durable task tracking.** The `- [ ]` steps in a local plan doc track one implementation session's progress; they are NOT the cross-session source of truth. Durable, shared, resumable task state lives in **beads**. Never create a markdown TODO file as the project's task source of truth (beads rule) — the plan doc is a scratch execution ledger that is thrown away when the work lands.

---

## 2. brainstorm → bead wiring ("step 6.5")

`brainstorming` ends by writing a spec and handing off to `writing-plans`. Insert bead creation between them:

1. **After brainstorming concludes** (its step 6–8; skip the plugin's "commit the spec" step — superpowers docs are not committed): create the bead (or epic) with `--acceptance=<distilled criteria>`, plus `--spec-id=<docs/feature-specs/ path>` if the work has a feature spec. If the design is substantial and durable, suggest a feature spec — Tim decides; if he says yes, it is written in the feature-spec format (`spec-driven-development` skill, diff-approved), never by promoting the superpowers doc as-is. Otherwise the bead description carries what matters from the brainstorm.
2. **After each plan is written** (`writing-plans`): sync it into the child bead with `bd update <id> --design-file <plan path>`. Re-run the same command whenever the plan materially changes mid-work — the local file is the editing surface, the bead is the durable copy, and Dolt versions every update (`bd history <id>`).
3. **Epics vs single-PR work:** a multi-PR epic may decompose into child beads (and MAY use a beads formula for the workflow). **Single-PR work must NOT** spawn per-task child beads — that creates sliver-beads. One bead, plan-file checkboxes for the steps.

Code work still happens **in a worktree** — the root checkout is read-only (AGENTS.md §2.2.5). The plan/spec drafts live in the scratchpad, outside any worktree; the bead is what survives.

---

## 3. Per-skill overrides

### `using-git-worktrees`

- PinPoint has native worktree tooling — **prefer `EnterWorktree`** (or `Agent(isolation:"worktree")`) over raw `git worktree add`. Either way the `post-checkout` hook wires ports/env/config, so when you do need a manual worktree, `git worktree add /path -b branch origin/main` (AGENTS.md §4) is the supported fallback. 6.1.x already prefers native tools; this just names ours.

### `writing-plans`

- Write the plan to the session scratchpad, not the superpowers default `docs/superpowers/plans/` path — plan files don't enter the repo tree. Sync it into the bead with `bd update <id> --design-file <plan path>` as soon as it's written (§1): the scratchpad is session-scoped and disposable; the bead is the durable copy.
- On the execution-handoff prompt, if you pick **Subagent-Driven**, first clear the scale gate below.

### `subagent-driven-development`

- Superpowers says "never pause between tasks, dispatch a fresh subagent per task." PinPoint gates multi-agent orchestration: **before launching, state the subagent count + rough cost and get Tim's explicit yes** — including worst-case fan-out. The built-in `/code-review` workflow is the only exemption.
- Caps: ~2–4 subagents per task; **simple PRs (<5 files) ≤ 2 subagents** (CLAUDE.md). Don't fan out on straightforward work.
- After the gate clears, run SDD's fresh-subagent-per-task + between-task review as written.

### `requesting-code-review` / `receiving-code-review`

- Superpowers' reviewer-subagent is fine as an **optional local self-check**. The **authoritative** gate is current-head `CI Gate` plus the exact-head automatic Codex review in `pinpoint-pr-workflow`. A superpowers review alone does not satisfy it.
- **`requesting-code-review` does not satisfy the merge gate by itself.** Own the GitHub draft/CI/automatic-review loop through exact-head automatic coverage with every finding thread adjudicated and resolved. Manual triggers and local attestations are used only when Tim explicitly requests or runs them. Full rules: `pinpoint-pr-workflow` Phase 3.4.
- **Reply to review comments via MCP** (`add_reply_to_pull_request_comment` + resolve the thread with `pull_request_review_write method:"resolve_thread"`), **signed with your agent name** (`—Claude` / `—Gemini` / `—Codex` / `—Antigravity`, per AGENTS.md §5 "Review comments"). Declined comments still get a one-sentence reply — no silent ignores. Do not use the plugin's own reply flow.

### `finishing-a-development-branch` — the biggest override

Superpowers presents a 4-option menu led by "1. Merge back to `<base>` locally". **In PinPoint that menu does not apply.** There is exactly one finish path:

- **Never merge locally and never push/merge to `main`; the merge decision is Tim's.** Ship through a draft PR and follow `pinpoint-pr-workflow` through current-head CI, automatic review, final labeling, and screenshots before handing Tim `! scripts/workflow/merge-pr.sh <PR> --human` — or running that script in Claude Code, where the hook requires his approval (PP-wi85). The raw channels — `gh pr merge`, `gh api PUT .../merge`, MCP merge — stay hard-blocked for agents.
- **Tests:** use PinPoint's tiered commands, listed in **AGENTS.md §5 "Which tests to run"** (`pnpm run check` is the **static** floor and runs no tests; `pnpm run test` is the unit suite; `pnpm run check:python` covers `scripts/` and `.claude/hooks/`; `pnpm run preflight` for migrations/auth/server-actions/middleware/schema; `pnpm run smoke` for UI) — **not** `npm test` / `pytest`. The full E2E suite (`e2e:full` / `e2e:all`) is CI's job by default; it peaks at several GB, so run it locally only when the host has the headroom.
- **Worktree cleanup is destructive → wait for explicit confirmation** (`pinpoint-pr-workflow` Phase 5.2 "Cleanup"). When confirmed, cleanup goes through the `WorktreeRemove` hook / `scripts/worktree_cleanup.py` (dealloc slot + Docker volumes) — **never raw `git worktree remove`/`rm -rf`**, which leaks the slot manifest and volumes.
- **"Discard" is not a routine option.** Abandoning work is a deliberate, confirmed action, not a menu pick.
- **Close the bead only after merge** (landing-the-plane) — not at push, not at PR-open.

---

## 4. Quick reference

| Superpowers step         | PinPoint override                                                                                 |
| :----------------------- | :------------------------------------------------------------------------------------------------ |
| Spec written             | don't commit it; create bead with `--acceptance` (+ `--spec-id` if a feature spec exists) (§2)    |
| Plan written             | don't commit it; paste full plan text into `--design` (§1)                                        |
| Worktree create          | `EnterWorktree` / `Agent(isolation:"worktree")`, from main worktree                               |
| SDD dispatch             | clear the scale gate (count + cost, Tim's yes) first                                              |
| Code review              | CI Gate + `pinpoint-pr-workflow` head-commit review; replies via MCP, signed with your agent name |
| Finish: "merge locally"  | ❌ prohibited → PR + `merge-pr.sh --human` (Tim approves the hook prompt) + landing-the-plane     |
| Finish: tests            | AGENTS.md §5's tiered `check`/`test`/`preflight`/`smoke`, not `npm test`                          |
| Finish: worktree cleanup | `WorktreeRemove` hook / `worktree_cleanup.py`, on confirmation                                    |
| Close bead               | only after merge                                                                                  |

## Red flags — stop if you catch yourself

- About to answer "Merge back to main locally" or run `git checkout main && git merge`.
- Running `git worktree remove` / `rm -rf` on a worktree by hand.
- Dispatching subagents for SDD without stating the count and getting a yes.
- Treating a plan-file's checkboxes (or any markdown TODO) as the durable task record instead of a bead.
- Writing a new file under `docs/superpowers/` — drafts go in the scratchpad, the durable copy in the bead.
- Closing the bead at push/PR-open instead of after merge.
