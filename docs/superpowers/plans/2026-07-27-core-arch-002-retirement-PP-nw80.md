# CORE-ARCH-002 Retirement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retire CORE-ARCH-002 (progressive enhancement) from the non-negotiables catalog, replace it with CORE-ARCH-012 (a control that cannot act must not report that it did), and reconcile every doc and comment that cites the retired rule.

**Architecture:** Doc-only. No source behavior changes. The edits are ordered so `pnpm run check` stays green after every task: add the new rule first, repoint citations second, delete the old rule last. `scripts/check_rule_ids.py` (wired into `pnpm run check` as `check:rule-ids`) is the gate — it errors when a scanned file cites a `CORE-*` ID absent from the catalog.

**Tech Stack:** Markdown, TypeScript comments, Python 3 (`scripts/check_rule_ids.py`), pnpm scripts.

**Spec:** `docs/superpowers/specs/2026-07-27-core-arch-002-scope-design.md`
**Bead:** PP-nw80
**Branch:** `docs/core-arch-002-scope-PP-nw80`

## Global Constraints

- **Never write the literal string `CORE-ARCH-002` anywhere in `docs/NON_NEGOTIABLES.md` after Task 3.** `check_rule_ids.py` builds the set of valid IDs by regex-scanning the _entire_ catalog file (`collect_catalog_ids` → `extract_ids`). A single lingering mention — even inside prose explaining the retirement — re-registers the ID as valid and silently defeats the gate. Refer to it as "the progressive-enhancement rule (002)", matching the existing `(003 retired)` convention in the appendix.
- **The Rule IDs appendix uses U+2011 NON-BREAKING HYPHENS (`‑`, bytes `e2 80 91`), not ASCII `-`.** Verified by hexdump on line 662. That is why the appendix ranges are invisible to the gate's `RANGE_ID` regex. When editing that line, preserve U+2011. Typing ASCII hyphens would expand `CORE-ARCH-001..012` into the catalog ID set and re-register the retired 002.
- The ID regex is **case-sensitive** (`\bCORE-[A-Z][A-Z0-9]*-\d{3}\b`, no flags). The lowercase spec filename `2026-07-27-core-arch-002-scope-design.md` does not match and is safe to cite inside the catalog.
- **Retire, don't repurpose.** CORE-ARCH-002 is never reused for a new rule. Dated records under `docs/superpowers/` and `docs/plans/` cite it and stay untouched, so the ID must keep meaning what it meant when they were written.
- `check_rule_ids.py` scans only: `CLAUDE.md`, `AGENTS.md`, `CODE_REVIEW.md`, `.claude/rules/*.md`, `.claude/rules/**/*.md`, `.github/copilot-instructions.md`, `.github/instructions/*.md`, `.claude/hooks/*.cjs`. Verified on this branch: `.claude/rules/` and `CODE_REVIEW.md` do not exist (the script tolerates missing paths).
- Run from the worktree: `/home/froeht/Code/PinPoint/.claude/worktrees/pp-nw80-arch002`. Use the `/home/froeht/...` path form — the `/var/home/froeht/...` form gets mangled by `cd` and `pnpm -C` in this environment.
- Test floor is `pnpm run check` (~12s). This change touches no migrations, auth, server actions, middleware, or schema, so `preflight` is not required.
- Never `--no-verify`. Never merge — the terminal state is a ready-for-review PR with CI green, then hand Tim `! scripts/workflow/merge-pr.sh <PR> --human`.
- **No behavior changes to any submission surface.** Nothing that works today stops working. Per the spec's Out of Scope: no `aria-disabled` migration, no `no-js` class or inline head script, no network-resilience work. Task 4's edits are comment text only — do not touch the surrounding code.

## Files

| File                                                                                | Change                                                                                                                            |
| :---------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------- |
| `docs/NON_NEGOTIABLES.md`                                                           | Add CORE-ARCH-012 (Task 1); remove CORE-ARCH-002 rule body, Quick Start item 11, fix appendix range, bump version header (Task 3) |
| `AGENTS.md`                                                                         | §2.1 item 4 repointed to CORE-ARCH-012 (Task 2)                                                                                   |
| `.github/instructions/components.instructions.md`                                   | "Progressive enhancement" section replaced with honest-failure review guidance (Task 2)                                           |
| `src/app/(app)/admin/users/actions.ts`                                              | Stale rule citation in a doc comment (Task 4)                                                                                     |
| `src/app/(app)/m/pinballmap-actions.ts`                                             | Stale rule citation in a doc comment (Task 4)                                                                                     |
| `src/app/(app)/m/[initials]/i/[issueNumber]/update-issue-priority-form.tsx`         | Factually wrong "progressive enhancement" claim (Task 4)                                                                          |
| `docs/patterns/progressive-enhancement.md` → `docs/patterns/server-action-forms.md` | Rename + rewrite philosophy (Task 5 — **beyond the spec's five items, see note**)                                                 |
| `docs/PATTERNS.md`                                                                  | Update the one inbound link (Task 5)                                                                                              |

**Deliberately NOT touched** (do not "helpfully" sweep these):

- `docs/superpowers/specs/*`, `docs/superpowers/plans/*`, `docs/plans/2026-07-21-mcp-oauth-consent-page.md` — dated records (AGENTS.md §8). Not scanned by the gate.
- `src/app/(auth)/**`, `src/app/(app)/m/new/page.tsx`, `src/components/machines/*`, `src/app/(app)/u/[id]/profile-editor.tsx`, `src/app/(app)/settings/connected-accounts/connected-account-row.tsx` — comments saying "progressive enhancement" or "works without JavaScript" without citing the rule ID. The audit found the auth/account surfaces genuinely do work without JS, so those comments remain true. Task 4 is scoped to comments citing the **retired rule ID**, plus the one comment that is factually false.
- `update-issue-{status,severity,frequency}-form.tsx` — no header doc comments exist to correct.

---

### Task 1: Add CORE-ARCH-012 to the catalog

**Files:**

- Modify: `docs/NON_NEGOTIABLES.md` (insert after line 396, the end of CORE-ARCH-011)

**Interfaces:**

- Produces: the catalog ID `CORE-ARCH-012`, which Task 2 cites and the gate validates against.

- [ ] **Step 1: Verify the gate is green and CORE-ARCH-012 does not yet exist**

```bash
cd /home/froeht/Code/PinPoint/.claude/worktrees/pp-nw80-arch002
python3 scripts/check_rule_ids.py; echo "exit=$?"
rg -c 'CORE-ARCH-012' docs/NON_NEGOTIABLES.md || echo "not present (expected)"
```

Expected: `exit=0`, and `not present (expected)`.

- [ ] **Step 2: Insert the new rule after CORE-ARCH-011**

In `docs/NON_NEGOTIABLES.md`, find the end of the CORE-ARCH-011 block — the line beginning `- **Don't:** Call \`sendEmail\`, \`sendDm\`, ...`(line 396), immediately followed by a blank line and`---` (line 398).

Insert this block between that `Don't` line and the `---`, separated by blank lines:

```markdown
**CORE-ARCH-012:** A control that cannot act must not report that it did

- **Severity:** Required
- **Why:** PinPoint does not support JavaScript-disabled browsers, and a visibly broken control is an acceptable outcome when JavaScript fails to load — the user can see something is wrong and retry. What is not acceptable is a control that reports success for an action it could not perform: the user walks away believing the change was saved. Visible breakage is recoverable; false confirmation is not. Replaces the progressive-enhancement rule (002), retired 2026-07-27 after an audit found that only ~7 of ~28 submission surfaces worked without JavaScript and that the public `/report` entry point — the rule's flagship surface — was unconditionally broken. Audit and reasoning: `docs/superpowers/specs/2026-07-27-core-arch-002-scope-design.md` (PP-nw80).
- **Do:** When a control cannot perform its action — a dependency is unavailable, JavaScript is not running, a precondition is unmet — let it visibly do nothing, or surface a real error. Rely on server-side validation to reject submissions that could not have carried valid input.
- **Don't:** Render a success message, toast, or confirmation for a submission whose input could not have been collected. Don't wire a save control that submits unchanged state and confirms it as a change.
```

**Critical:** the `Why` field says "the progressive-enhancement rule (002)" — bare `002`, never the full ID. See Global Constraints.

- [ ] **Step 3: Verify the new ID registered and the gate is still green**

```bash
python3 scripts/check_rule_ids.py; echo "exit=$?"
python3 scripts/check_rule_ids.py --orphans 2>&1 | rg -o 'CORE-ARCH-012' && echo "listed as orphan (expected — nothing cites it yet)"
```

Expected: `exit=0`. The orphans audit lists `CORE-ARCH-012` because no scanned file cites it yet. The orphans audit never fails the build.

- [ ] **Step 4: Confirm no ASCII-hyphen regression was introduced**

```bash
rg -n 'CORE-ARCH-002' docs/NON_NEGOTIABLES.md
```

Expected: exactly two hits at this point — the rule heading (line ~328) and Quick Start item 11 (line 33). Both are removed in Task 3.

- [ ] **Step 5: Commit**

```bash
git add docs/NON_NEGOTIABLES.md
git commit -m "docs(rules): add CORE-ARCH-012 honest-failure rule (PP-nw80)"
```

---

### Task 2: Repoint the two gated citations

**Files:**

- Modify: `AGENTS.md:18` (§2.1 item 4)
- Modify: `.github/instructions/components.instructions.md:12-14`

**Interfaces:**

- Consumes: `CORE-ARCH-012` from Task 1.
- Produces: zero remaining `CORE-ARCH-002` citations in any file the gate scans — the precondition for Task 3's deletion.

- [ ] **Step 1: Replace AGENTS.md §2.1 item 4**

Replace this line:

```markdown
4. **Progressive enhancement** (CORE-ARCH-002): `<form action={serverAction}>`. No inline handlers. Sanctioned exceptions: quick-report grid (PP-sn34); the 4 inline issue metadata forms dispatch `useActionState` directly to dodge a Radix Select reset-listener bug (PP-0fvr) — interim pending PP-nw80's broader review of this rule.
```

with:

```markdown
4. **Honest failure** (CORE-ARCH-012): a control that cannot perform its action must not report that it did. Let it visibly do nothing or surface a real error — never a success toast for input that could not have been collected. There is no no-JS requirement; mutations still route through Server Actions (CORE-ARCH-005, CORE-ARCH-007).
```

Both former carve-outs (PP-sn34's quick-report grid, PP-0fvr's four metadata forms) disappear with the rule they excepted from — do not carry them forward.

- [ ] **Step 2: Replace the components.instructions.md section**

Replace this section:

```markdown
## Progressive enhancement (CORE-ARCH-002)

- Forms mutate via `<form action={serverAction}>`, not `onSubmit` + `fetch`. The core submit must work with JS disabled. Flag inline `onClick` handlers that perform a mutation a form action should own.
```

with:

```markdown
## Honest failure (CORE-ARCH-012)

- Flag a control that reports success for an action it could not have performed — a success toast or confirmation rendered for a submission whose input could not have been collected, or a save control that submits unchanged state and confirms it as a change.
- Mutations still route through Server Actions (CORE-ARCH-005, CORE-ARCH-007). But there is **no** no-JS requirement: a control that visibly does nothing when JavaScript is unavailable is acceptable. Do not flag an `onClick`-dispatched mutation on no-JS grounds alone.
```

- [ ] **Step 3: Verify no gated file still cites the retired ID**

```bash
rg -n 'CORE-ARCH-002' CLAUDE.md AGENTS.md .github/copilot-instructions.md .github/instructions/ 2>/dev/null; echo "exit=$?"
```

Expected: no output, `exit=1` (ripgrep's "no matches" code). Any hit here must be fixed before Task 3.

- [ ] **Step 4: Verify the gate is green and CORE-ARCH-012 is now cited**

```bash
python3 scripts/check_rule_ids.py; echo "exit=$?"
python3 scripts/check_rule_ids.py --orphans 2>&1 | rg -o 'CORE-ARCH-012' && echo "STILL ORPHAN — citation did not land" || echo "no longer an orphan (expected)"
```

Expected: `exit=0` and `no longer an orphan (expected)`. This is the positive confirmation that the new citations parse.

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md .github/instructions/components.instructions.md
git commit -m "docs(rules): repoint CORE-ARCH-002 citations to CORE-ARCH-012 (PP-nw80)"
```

---

### Task 3: Remove CORE-ARCH-002 from the catalog

**Files:**

- Modify: `docs/NON_NEGOTIABLES.md` — lines 8-9 (version header), line 33 (Quick Start item 11), lines 328-336 (rule body + both sanctioned exceptions), line 662 (appendix range)

**Interfaces:**

- Consumes: Task 2's guarantee that no scanned file cites `CORE-ARCH-002`.
- Produces: a catalog whose extracted ID set no longer contains `CORE-ARCH-002`.

This task has a real red→green cycle. The "test" is a negative control run against a scratch root: a synthetic `AGENTS.md` citing the retired ID must be _accepted_ before the edit and _rejected_ after. That single assertion catches both traps at once — a lingering Quick Start mention and an accidentally-ASCII appendix range.

- [ ] **Step 1: Write the failing test (negative control against the current catalog)**

```bash
cd /home/froeht/Code/PinPoint/.claude/worktrees/pp-nw80-arch002
SCRATCH=/tmp/claude-1000/-var-home-froeht-Code-PinPoint/6ecfccd5-fd67-4b01-972d-4016d76e8faf/scratchpad/ruleid-negative
rm -rf "$SCRATCH" && mkdir -p "$SCRATCH/docs"
cp docs/NON_NEGOTIABLES.md "$SCRATCH/docs/NON_NEGOTIABLES.md"
printf 'Follow CORE-ARCH-002.\n' > "$SCRATCH/AGENTS.md"
python3 scripts/check_rule_ids.py --root "$SCRATCH"; echo "exit=$?"
```

- [ ] **Step 2: Run it to confirm it currently passes (i.e. the ID still resolves)**

Expected: `exit=0`, no output. The retired ID still resolves against the catalog, so the gate cannot yet catch a dangling citation. This is the state Steps 3-6 change.

- [ ] **Step 3: Bump the version header**

Replace lines 8-9:

```markdown
**Last Updated**: 2026-07-17
**Version**: 2.4 (form-token/status corrections; SMTP, quick-report-grid, and confirm-delete sanctioned exceptions — audit PP-9vh3/PP-h9lb)
```

with:

```markdown
**Last Updated**: 2026-07-27
**Version**: 2.5 (progressive-enhancement rule 002 retired; CORE-ARCH-012 honest-failure added — PP-nw80)
```

- [ ] **Step 4: Replace Quick Start Checklist item 11**

Replace line 33:

```markdown
11. Forms work without JavaScript (CORE-ARCH-002)
```

with:

```markdown
11. A control that cannot act must not report that it did (CORE-ARCH-012)
```

Replace in place rather than deleting — this keeps items 12-23 correctly numbered and mirrors the same substitution made in `AGENTS.md` §2.1 item 4, honoring the sync contract stated at line 11 of this file.

- [ ] **Step 5: Delete the CORE-ARCH-002 rule body**

Delete the entire block from `**CORE-ARCH-002:** Progressive enhancement` (line 328) through the end of the second sanctioned-exception bullet (line 336, the one ending `...interim measure pending PP-nw80's broader revisit of this rule.`), plus the blank line that followed it.

The result: `**CORE-ARCH-001:** Server-first development`'s block is followed directly by a blank line and then `**CORE-ARCH-004:** Issues always per-machine`. The 002→004 gap now matches the existing 003 gap — both retired.

- [ ] **Step 6: Fix the appendix range**

Replace line 662:

```
- CORE‑ARCH‑001..010: Architecture (003 retired)
```

with:

```
- CORE‑ARCH‑001..012: Architecture (002, 003 retired)
```

**The hyphens in `CORE‑ARCH‑` are U+2011 non-breaking hyphens, not ASCII.** Copy them from the existing line rather than retyping. Verify immediately:

```bash
sed -n '662p' docs/NON_NEGOTIABLES.md | hexdump -C | head -2
```

Expected: bytes `43 4f 52 45 e2 80 91 41 52 43 48 e2 80 91` (`CORE‑ARCH‑`). If you see `2d` (ASCII hyphen) where `e2 80 91` should be, you have re-registered the retired ID — fix before continuing.

- [ ] **Step 7: Run the negative-control test again — it must now fail**

```bash
SCRATCH=/tmp/claude-1000/-var-home-froeht-Code-PinPoint/6ecfccd5-fd67-4b01-972d-4016d76e8faf/scratchpad/ruleid-negative
cp docs/NON_NEGOTIABLES.md "$SCRATCH/docs/NON_NEGOTIABLES.md"
python3 scripts/check_rule_ids.py --root "$SCRATCH"; echo "exit=$?"
```

Expected: `exit=1` and stderr containing `AGENTS.md: CORE-ARCH-002`. That proves the ID is genuinely gone from the catalog's extracted set.

- [ ] **Step 8: Confirm the real repo is still green, then clean up the scratch dir**

```bash
rg -n 'CORE-ARCH-002' docs/NON_NEGOTIABLES.md; echo "rg exit=$? (1 = no hits, expected)"
python3 scripts/check_rule_ids.py; echo "exit=$?"
rm -rf /tmp/claude-1000/-var-home-froeht-Code-PinPoint/6ecfccd5-fd67-4b01-972d-4016d76e8faf/scratchpad/ruleid-negative
```

Expected: no `rg` hits, `check_rule_ids.py` `exit=0`.

- [ ] **Step 9: Commit**

```bash
git add docs/NON_NEGOTIABLES.md
git commit -m "docs(rules): retire CORE-ARCH-002 progressive enhancement (PP-nw80)"
```

---

### Task 4: Clean stale rule citations in code comments

**Files:**

- Modify: `src/app/(app)/admin/users/actions.ts:261`
- Modify: `src/app/(app)/m/pinballmap-actions.ts:383-384`
- Modify: `src/app/(app)/m/[initials]/i/[issueNumber]/update-issue-priority-form.tsx:38-41`

Not gated by `check_rule_ids.py` (it scans no `.ts`/`.tsx`), but these must not cite a retired rule. The first two cite the ID directly. The third makes a claim that is factually false: it is one of the four PP-0fvr metadata forms that dispatches `useActionState` directly _instead of_ using a form action.

- [ ] **Step 1: Fix `admin/users/actions.ts`**

Replace:

```ts
 * `useActionState` — the progressive-enhancement pattern (CORE-ARCH-002/007).
```

with:

```ts
 * `useActionState` (CORE-ARCH-007).
```

- [ ] **Step 2: Fix `m/pinballmap-actions.ts`**

Replace these two lines:

```ts
 * (control room, PP-o355.7) can drop it in for progressive enhancement
 * (CORE-ARCH-002).
```

with this one line:

```ts
 * (control room, PP-o355.7) can drop it in directly (CORE-ARCH-005/007).
```

- [ ] **Step 3: Fix `update-issue-priority-form.tsx`**

Replace:

```ts
/**
 * Form component for updating issue priority with progressive enhancement.
 * Uses useActionState for form submission with client-side validation.
 */
```

with:

```ts
/**
 * Form component for updating issue priority.
 * Uses useActionState for form submission with client-side validation.
 * Dispatches the action directly rather than via `<form action={...}>` — see PP-0fvr.
 */
```

The added pointer preserves the reason, which until now lived only in the catalog carve-out being deleted. The sibling status/severity/frequency forms carry no header comment and are left alone.

- [ ] **Step 4: Verify no source file cites the retired ID**

```bash
rg -n 'CORE-ARCH-002' src/; echo "exit=$? (1 = no hits, expected)"
```

Expected: no output, `exit=1`.

- [ ] **Step 5: Run the full check**

```bash
pnpm run check
```

Expected: PASS. This exercises typecheck, lint, format, unit tests, and `check:rule-ids` together.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/admin/users/actions.ts" "src/app/(app)/m/pinballmap-actions.ts" "src/app/(app)/m/[initials]/i/[issueNumber]/update-issue-priority-form.tsx"
git commit -m "docs(comments): drop citations of the retired CORE-ARCH-002 (PP-nw80)"
```

---

### Task 5: Reconcile the progressive-enhancement patterns doc

> **Beyond the spec's five implementation items.** The spec's audit did not cover `docs/patterns/progressive-enhancement.md`. It is a live (undated, non-record) doc linked from `docs/PATTERNS.md`, and its philosophy section states "we prioritize a solid, functional baseline for all users" — which directly contradicts the decision that no surface is required to work without JavaScript. Leaving it would satisfy the gate while leaving the docs self-contradictory, which is the exact failure the bead's acceptance criterion 2 is about. **If Tim would rather scope this out, drop this task — Tasks 1-4 satisfy the spec as written.**

**Files:**

- Rename: `docs/patterns/progressive-enhancement.md` → `docs/patterns/server-action-forms.md`
- Modify: the renamed file's title and Philosophy section
- Modify: `docs/PATTERNS.md:36` (the only inbound link — verified)

The doc's _technical_ content survives intact: `<form action={serverAction}>`, `useActionState` for feedback, don't hand-roll `fetch`. All of that is still mandated by CORE-ARCH-005 and CORE-ARCH-007. Only the no-JS framing is retired.

- [ ] **Step 1: Rename the file**

```bash
cd /home/froeht/Code/PinPoint/.claude/worktrees/pp-nw80-arch002
git mv docs/patterns/progressive-enhancement.md docs/patterns/server-action-forms.md
```

- [ ] **Step 2: Replace the title and Philosophy section**

In `docs/patterns/server-action-forms.md`, replace lines 1-11 — everything from the `# Progressive Enhancement Patterns` heading through the `3. **Complexity Allowance**...` bullet:

```markdown
# Progressive Enhancement Patterns

## Philosophy: Pragmatic Progressive Enhancement

We believe in **Pragmatic Progressive Enhancement**. This means we prioritize a solid, functional baseline for all users, but we do not let strict "no-JS" requirements hold back the user experience or development velocity for complex, interactive features.

### Core Principles

1.  **Server Actions are the Baseline**: Use Next.js Server Actions for all data mutations. They work without JavaScript by default and are the most robust way to handle form submissions.
2.  **Enhance, Don't Duplicate**: Do not write two separate implementations (one for JS, one for no-JS). Build the Server Action first, then layer on client-side feedback (like toast notifications or optimistic UI) using `useActionState` (React 19).
3.  **Complexity Allowance**: For highly interactive features (e.g., drag-and-drop boards, rich text editors, real-time visualizations), it is acceptable to require JavaScript. In these cases, provide a simple fallback message or a basic read-only view if possible.
```

with:

```markdown
# Server Action Form Patterns

## Philosophy

**JavaScript is required.** PinPoint is an authenticated tool for the members of one physical club, on known devices, on the club's own wifi. No surface is required to work with JavaScript disabled, and no work is owed to preserve that mode. The progressive-enhancement non-negotiable (002) was retired on 2026-07-27 after an audit found it measured a proxy that had stopped correlating with whether a user could finish the task — see `docs/superpowers/specs/2026-07-27-core-arch-002-scope-design.md` (PP-nw80).

What survives is the architecture, which was never justified by no-JS support:

### Core Principles

1.  **Server Actions are the mutation path**: Use Next.js Server Actions for all data mutations — not `onSubmit` + `fetch` to an API route. Reference them directly, never through an inline wrapper (CORE-ARCH-005).
2.  **Enhance, Don't Duplicate**: Build one implementation. Layer client-side feedback (toasts, optimistic UI) on top with `useActionState` (CORE-ARCH-007).
3.  **Fail honestly**: When a control cannot perform its action, let it visibly do nothing or surface a real error. Never confirm success for a submission whose input could not have been collected (CORE-ARCH-012).
```

Leave the rest of the file — "Modern Patterns", the `useActionState` example, and "Key Takeaways" — unchanged. Its advice is still correct.

- [ ] **Step 3: Update the inbound link in `docs/PATTERNS.md`**

Replace:

```markdown
- [Progressive Enhancement](./patterns/progressive-enhancement.md)
```

with:

```markdown
- [Server Action Forms](./patterns/server-action-forms.md)
```

- [ ] **Step 4: Verify no dangling links to the old filename**

```bash
rg -n 'patterns/progressive-enhancement' --glob '!node_modules' . ; echo "exit=$? (1 = no hits, expected)"
```

Expected: no output, `exit=1`. (Dated records under `docs/superpowers/` reference the _concept_, not this path — verified there are no other inbound links.)

- [ ] **Step 5: Commit**

```bash
git add docs/PATTERNS.md docs/patterns/
git commit -m "docs(patterns): retitle progressive-enhancement doc to server-action forms (PP-nw80)"
```

---

### Task 6: Final verification and PR

- [ ] **Step 1: Full check**

```bash
cd /home/froeht/Code/PinPoint/.claude/worktrees/pp-nw80-arch002
pnpm run check
```

Expected: PASS (types, lint, format, unit, yamllint, actionlint, ruff, shellcheck, pytest, `check:rule-ids`).

- [ ] **Step 2: Confirm the retired ID survives only in dated records**

```bash
rg -n 'CORE-ARCH-002' --glob '!node_modules' . | rg -v '^\./docs/superpowers/|^\./docs/plans/'
echo "exit=$? (1 = only dated records remain, expected)"
```

Expected: no output. Every remaining hit is a dated record, which is correct — those must keep citing the ID as it meant at the time.

- [ ] **Step 3: Confirm the acceptance criteria**

```bash
rg -n 'CORE-ARCH-012' docs/NON_NEGOTIABLES.md AGENTS.md .github/instructions/components.instructions.md
```

Expected: a hit in each of the three files — the catalog definition, the AGENTS.md §2.1 index entry, and the Copilot review-voice entry. Maps to bead acceptance criteria 1-3.

- [ ] **Step 4: Sync with main by merge (never rebase)**

```bash
git fetch origin && git merge origin/main
```

If `docs/NON_NEGOTIABLES.md` conflicts (another PR edited the catalog), resolve by hand — this is ordinary markdown, not a `drizzle/meta` snapshot. Re-run Step 2 after resolving.

- [ ] **Step 5: Push and open the PR ready-for-review**

```bash
git push -u origin docs/core-arch-002-scope-PP-nw80
git branch -vv   # must show [origin/docs/core-arch-002-scope-PP-nw80], not [origin/main]
```

Open ready-for-review (not draft). PR body should link the spec and state: doc-only, no source behavior change, no migration. Not UI-touching, so no screenshots are required.

- [ ] **Step 6: Update the bead**

```bash
bd update PP-nw80 --design="docs/superpowers/plans/2026-07-27-core-arch-002-retirement-PP-nw80.md @ docs/core-arch-002-scope-PP-nw80"
```

The `--spec-id` should already point at the spec from the brainstorming step; set it if not.

- [ ] **Step 7: Watch CI to a conclusion**

```bash
./scripts/workflow/pr-watch.py <PR>
```

Do not hand off at "pushed, CI running". When `CI Gate` is green and any review threads are resolved, hand Tim the command — never run it yourself:

```
! scripts/workflow/merge-pr.sh <PR> --human
```

Close PP-nw80 only after Tim merges.

---

## Blocked on PR #1751 — mandatory re-sync before merge

**PR #1751 (PP-1ajq, `fix/radix-select-form-reset-audit`) must merge first.** It fixes live user-visible bugs; this PR is doc-only. It also edits the same two blocks this PR deletes, so letting it land first makes conflict resolution trivial in one direction and painful in the other.

Its author flagged the overlap in the huddle and asked for that order. Agreed and confirmed.

After #1751 lands, run `git fetch origin && git merge origin/main` (merge, never rebase) and work this checklist:

- [ ] **Resolve `AGENTS.md` §2.1 item 4** — #1751 rewrites the CORE-ARCH-002 line to list all 8 exception forms. This PR deletes that line entirely. **Take this branch's version** (the Honest-failure item 4); the expanded exception list describes a rule that no longer exists.
- [ ] **Resolve `docs/NON_NEGOTIABLES.md`** — #1751 adds a `Status:` line to the CORE-ARCH-002 body and rewrites both carve-outs. This PR deletes the whole block. **Take this branch's version** (deleted). Verify afterwards that the literal `CORE-ARCH-002` appears nowhere in the file, or the gate is silently defeated (see Global Constraints).
- [ ] **Extend Task 4 to the four new source comments.** #1751 adds sanctioned-exception comments citing CORE-ARCH-002 to:
  - `src/app/(app)/m/[initials]/update-machine-form.tsx`
  - `src/app/(app)/m/new/create-machine-form.tsx`
  - `src/app/(app)/report/unified-report-form.tsx`
  - `src/app/(app)/settings/delete-account-section.tsx`

  Each says roughly "sanctioned exception to CORE-ARCH-002 — this form already depends on JS end to end." Rewrite to drop the retired citation while **keeping the Radix-Select reset rationale**, which is the load-bearing part and stays true: the fix, not the rule, is why the code looks that way. Reference PP-1ajq / PP-0fvr instead of the rule ID.

- [ ] **Re-run the full verification**: `rg -n 'CORE-ARCH-002' --glob '!node_modules' . | rg -v '^\./docs/superpowers/|^\./docs/plans/'` must return nothing, then `pnpm run check`.

#1751's four new regression tests (`*-failed-save-revert.test.tsx`) do not cite the rule ID and need no changes.

## Follow-ups (not this PR)

- **Network resilience.** The audit found flaky-network handling is the venue's genuine risk and is entirely unaddressed (no service worker, no offline support, no client retry, no optimistic UI). Separate body of work, not a rename of this rule.
