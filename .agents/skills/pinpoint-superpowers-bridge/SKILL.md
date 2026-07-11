---
name: pinpoint-superpowers-bridge
description: Use when running the superpowers plugin lifecycle inside PinPoint — brainstorming, writing-plans, subagent-driven-development, requesting/receiving-code-review, or finishing-a-development-branch — and when a superpowers step wants to merge a branch locally, remove a worktree by hand, run generic npm/pytest tests, dispatch subagents without a scale gate, or write a spec/plan from the read-only root. Also when deciding which bead field a spec, plan, acceptance criterion, or landing note belongs in.
---

# PinPoint × Superpowers Bridge

The superpowers plugin (`brainstorming → writing-plans → subagent-driven-development → finishing-a-development-branch`) is a general-purpose lifecycle. Its skills live in an unwritable plugin cache, so PinPoint cannot edit them. This skill is the **project-side shim**: it says which superpowers steps to follow verbatim, which to override, and how the lifecycle's artifacts map onto beads.

**Precedence:** PinPoint rules (AGENTS.md / CLAUDE.md) and this skill override superpowers steps wherever they conflict. Everything not called out here, follow the superpowers skill as written.

**Load this whenever** you invoke any superpowers lifecycle skill inside PinPoint.

---

## 1. Field conventions — plans live in git, beads carry pointers

Specs and plans stay as **files in git** (the superpowers default locations, kept as dated records — AGENTS.md §8). Beads do **not** duplicate their content; they carry **pointers** so any session can recover context:

| Bead field     | Holds                                                   | Example                                                             |
| :------------- | :------------------------------------------------------ | :------------------------------------------------------------------ |
| `--spec-id`    | Spec file path                                          | `docs/superpowers/specs/2026-07-05-widget-design.md`                |
| `--design`     | Plan file path(s) **+ branch name while unmerged**      | `docs/superpowers/plans/2026-07-05-widget.md @ feat/widget-PP-xxxx` |
| `--acceptance` | Distilled success criteria (not the whole spec)         | `Widget renders; server action persists; RTL + integration green`   |
| `--notes`      | Landing breadcrumbs (PR #, migration state, follow-ups) | `PR #1610; no migration; follow-up PP-yyyy for mobile layout`       |

**Cross-session recovery:** while a branch is unmerged, its plan/spec files aren't on `main`. Read them with `git show origin/<branch>:<path>` (that's why `--design` records the branch). After merge, the files are on `main` at their path.

**Plan-file checkboxes are within-PR execution state, not durable task tracking.** The `- [ ]` steps in a plan doc track one implementation session's progress; they are NOT the cross-session source of truth. Durable, shared, resumable task state lives in **beads**. Never create a markdown TODO file as the project's task source of truth (beads rule) — the plan doc is a scratch execution ledger that ships inside the PR and then becomes a record.

---

## 2. brainstorm → bead wiring ("step 6.5")

`brainstorming` ends by writing a spec and handing off to `writing-plans`. Insert bead creation between them:

1. **After the spec is approved and committed** (brainstorming step 6–8): create the bead (or epic) with `--spec-id=<spec path>` and `--acceptance=<distilled criteria>`. This is the durable anchor for the work.
2. **After each plan is written** (`writing-plans`): update the child bead's `--design` with the plan path + branch name.
3. **Epics vs single-PR work:** a multi-PR epic may decompose into child beads (and MAY use a beads formula for the workflow). **Single-PR work must NOT** spawn per-task child beads — that creates sliver-beads. One bead, plan-file checkboxes for the steps.

Everything above happens **in a worktree** — the root checkout is read-only (AGENTS.md §2.5). `brainstorming`/`writing-plans` commit spec/plan files to git, so enter a worktree first (`EnterWorktree`, or dispatch an `Agent(isolation:"worktree")`).

---

## 3. Per-skill overrides

### `using-git-worktrees`

- PinPoint has native worktree tooling — **prefer `EnterWorktree`** (or `Agent(isolation:"worktree")`) over raw `git worktree add`. Either way the `post-checkout` hook wires ports/env/config, so when you do need a manual worktree, `git worktree add /path -b branch origin/main` (AGENTS.md §4) is the supported fallback. 6.1.x already prefers native tools; this just names ours.
- **Dispatch `Agent(isolation:"worktree")` only from the main worktree** (upstream bug #47548). See CLAUDE.md "Worktree Dispatch Safety".

### `writing-plans`

- Keep the default plan location `docs/superpowers/plans/YYYY-MM-DD-<feature>.md`. Record its path in the bead's `--design` (§1).
- On the execution-handoff prompt, if you pick **Subagent-Driven**, first clear the scale gate below.

### `subagent-driven-development`

- Superpowers says "never pause between tasks, dispatch a fresh subagent per task." PinPoint gates multi-agent orchestration: **before launching, state the subagent count + rough cost and get Tim's explicit yes** — including worst-case fan-out. The built-in `/code-review` workflow is the only exemption.
- Caps: ~2–4 subagents per task; **simple PRs (<5 files) ≤ 2 subagents** (CLAUDE.md). Don't fan out on straightforward work.
- After the gate clears, run SDD's fresh-subagent-per-task + between-task review as written.

### `requesting-code-review` / `receiving-code-review`

- Superpowers' reviewer-subagent is fine as an **optional local self-check**. The **authoritative** review gate is **CI Gate + `/code-review`** (see `pinpoint-pr-workflow`), not a plugin subagent.
- **Reply to review comments via MCP** (`add_reply_to_pull_request_comment` + resolve the thread with `pull_request_review_write method:"resolve_thread"`), **signed with your agent name** (`—Claude` / `—Gemini` / `—Codex` / `—Antigravity`, per AGENTS.md §5 "Review comments"). Declined comments still get a one-sentence reply — no silent ignores. Do not use the plugin's own reply flow.

### `finishing-a-development-branch` — the biggest override

Superpowers presents a 4-option menu led by "1. Merge back to `<base>` locally". **In PinPoint that menu does not apply.** There is exactly one finish path:

- **Never merge locally, never push/merge to `main`.** Ship through a PR: push the branch, open it **ready-for-review**, let **CI** run the full suite, then merge **only** via `scripts/workflow/merge-pr.sh <PR>` (never `gh pr merge` / MCP merge). Full pipeline: `pinpoint-pr-workflow` + landing-the-plane (AGENTS.md §9).
- **Tests:** use PinPoint's tiered commands (`pnpm run check` floor; `pnpm run preflight` for migrations/auth/server-actions/middleware/schema; `pnpm run smoke` for UI) — **not** `npm test` / `pytest`. Don't run the full E2E suite locally; CI owns it.
- **Worktree cleanup is destructive → wait for explicit confirmation** (AGENTS.md §9 "Landing the plane", step 6). When confirmed, cleanup goes through the `WorktreeRemove` hook / `scripts/worktree_cleanup.py` (dealloc slot + Docker volumes) — **never raw `git worktree remove`/`rm -rf`**, which leaks the slot manifest and volumes.
- **"Discard" is not a routine option.** Abandoning work is a deliberate, confirmed action, not a menu pick.
- **Close the bead only after merge** (landing-the-plane) — not at push, not at PR-open.

---

## 4. Quick reference

| Superpowers step         | PinPoint override                                                      |
| :----------------------- | :--------------------------------------------------------------------- |
| Spec written             | + create bead with `--spec-id` + `--acceptance` (§2)                   |
| Plan written             | record path + branch in `--design` (§1)                                |
| Worktree create          | `EnterWorktree` / `Agent(isolation:"worktree")`, from main worktree    |
| SDD dispatch             | clear the scale gate (count + cost, Tim's yes) first                   |
| Code review              | CI Gate + `/code-review`; replies via MCP, signed with your agent name |
| Finish: "merge locally"  | ❌ prohibited → PR + `merge-pr.sh` + landing-the-plane                 |
| Finish: tests            | tiered `pnpm run check`/`preflight`/`smoke`, not `npm test`            |
| Finish: worktree cleanup | `WorktreeRemove` hook / `worktree_cleanup.py`, on confirmation         |
| Close bead               | only after merge                                                       |

## Red flags — stop if you catch yourself

- About to answer "Merge back to main locally" or run `git checkout main && git merge`.
- Running `git worktree remove` / `rm -rf` on a worktree by hand.
- Dispatching subagents for SDD without stating the count and getting a yes.
- Treating a plan-file's checkboxes (or any markdown TODO) as the durable task record instead of a bead.
- Committing a spec/plan from the **root** checkout (it's read-only — be in a worktree).
- Closing the bead at push/PR-open instead of after merge.
