# Context corpus deletion sweep — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` or `superpowers:executing-plans` to implement this plan task-by-task. Also load `pinpoint-superpowers-bridge` — several superpowers defaults (local merge, raw `git worktree remove`, generic test commands, the plugin's own review-reply flow) conflict with PinPoint rules.

**Goal:** Remove the parts of PinPoint's agent context that teach an agent how to code or restate what the code already says, keeping only recorded decisions.

**Architecture:** Nine serial PRs over the agent-facing corpus, plus an independent guards track. Within a file the only permitted operations are DELETE, MOVE-VERBATIM, and POINTER — no rewriting of surviving prose. Each PR gets a cold-read subagent review before push.

**Spec:** `docs/superpowers/specs/2026-08-01-context-corpus-deletion-sweep-design.md`

**Bead:** PP-22e4

---

## Global Constraints

Copied from the spec and from AGENTS.md. Every task's requirements include these.

- **The three-question test.** Delete a line if (1) a `CORE-*` rule in `docs/NON_NEGOTIABLES.md` already says it, (2) a script, hook, or gate already does it, or (3) it is a code example. Survivors are decisions.
- **Two destinations only.** Enforced rule → `docs/NON_NEGOTIABLES.md` as a `CORE-*` entry. The _why_ behind a choice → the owning skill. No third home is created. A survivor that fits neither was a cached fact; delete it.
- **DELETE / MOVE-VERBATIM / POINTER only.** Rewriting a surviving passage is out of scope. A survivor found to be wrong gets a bead and stays as-is. The single exception is skill `description` frontmatter.
- **Cold-read review before push.** Fixed brief, verbatim from the spec, diff as the only variable input. Never author a per-PR brief.
- **Lead source re-read.** Re-read the actual source files behind every surviving claim — the files, not the diff.
- **Hard serialization.** No task N+1 worktree until task N's merge commit is on `origin/main`. The guards track is exempt (disjoint files).
- **Deletion candidates get a recency check.** `git log -3 -- <file>` before deleting. Recency caused by this sweep's own PRs does not count as use.
- **Zero inbound links ≠ unused.** Handoff and refresher docs are opened by path from a bead, never linked. Confirmed the hard way: `docs/pbm-listing-redesign-refresher.md` has no inbound links and was updated 2026-08-01 by #1762 for an in-flight epic.
- **Sync with merge, never rebase.** `git fetch origin && git merge origin/main`.
- **Never `--no-verify`.** Merging is human-only — hand Tim `! scripts/workflow/merge-pr.sh <PR> --human`.
- **`pnpm run check`** before every commit (~12s; docs-only changes need nothing heavier).
- **Copilot requested once** per PR, after iteration stops: `gh pr edit <PR> --add-reviewer "@copilot"`. Verify `commit_id == headRefOid`.
- **Risk posture (Tim, 2026-08-01):** _"We'll do the best we can. We've been having fewer and fewer drastic issues lately, so I'm getting less worried about over-trimming."_ Bias toward cutting when a line is borderline. Under-cutting is the failure mode this sweep exists to fix.

---

## Method: the per-task cycle

Every deletion task follows the same five phases. This replaces the TDD cycle — there is no test to fail first, but there is a claim to verify before removing anything.

1. **Prove before deleting.** For each block proposed for deletion, locate where the fact survives — the `CORE-*` ID, the script path, or the source file. A block whose fact survives nowhere is either a decision (keep it, move it verbatim) or genuinely obsolete (delete it, and say so in the PR description).
2. **Delete.** Remove the block. Add a pointer only where a reader would otherwise be stranded.
3. **Re-derive the description** if the task touched a skill body. The body changed, so the routing signal must change with it. Enumerate the terms dropped and where they land.
4. **Inbound-link check.** `rg --hidden -l "<stem>" --glob '!.git/**' .` for every deleted file. Plain `rg` skips `.agents/` and `.claude/` and will exit clean while the reference is live.
5. **Cold-read review, then lead source re-read, then `pnpm run check`, then push.**

---

## Task 0: Guards track (parallel, starts immediately)

Disjoint from every other task — touches `package.json`, `eslint.config.mjs`, and `scripts/`. Not subject to hard serialization.

**Files:**

- Modify: `package.json:19` (`lint` script), `package.json:64` (`check` composition)
- Modify: `eslint.config.mjs:251-253` (the false comment)

**Steps:**

- [ ] **Step 1: Reproduce PP-ojv5.** Run `pnpm exec eslint e2e/ --quiet` and record the violation count. `lint` is `eslint src/ --quiet`; `e2e/` is a sibling directory and has never been linted.
- [ ] **Step 2: Read `eslint.config.mjs:251-253`.** It asserts _"which also matches `e2e/**/*.ts(x)` — so e2e files are covered at 'error' with no hole."_ True of match scope, false of execution scope. This is the doc-describes-mechanism-it-does-not-own class.
- [ ] **Step 3: Extend `lint` to cover `e2e/`.** Fix whatever violations surface, or record them in a bead if the count is large enough to warrant its own PR.
- [ ] **Step 4: Correct or delete the false comment.** Prefer deleting — the config is the mechanism; a comment asserting what the config achieves is the same cached-fact class this sweep removes.
- [ ] **Step 5: Add the CI-only guard on `e2e:full` / `e2e:all`**, and the no-spec-path guard on `pnpm exec playwright test`.
- [ ] **Step 6: `pnpm run check`, commit, PR, close PP-ojv5 on merge.**

---

## Task 1: Orphan deletions

**Files:**

- Delete: `docs/ESLINT_RULES.md` (328 lines)
- Delete: `docs/CI_WORKFLOW_SETUP.md` (34 lines)

**Verified:** both have zero inbound references (`rg --hidden`, bare stem, excluding `.git/`). `ESLINT_RULES.md` last substantively touched 2026-06-06 (#1505); `CI_WORKFLOW_SETUP.md` 2026-01-07 (#704, a mechanical pnpm rename). Neither is a handoff doc.

**Explicitly NOT in this task:** `docs/pbm-listing-redesign-refresher.md`. Zero inbound links, but updated 2026-08-01 by #1762 and actively used by the in-flight PBM epic.

- [ ] **Step 1: Re-verify orphan status at head.** For each file: `rg --hidden -l "<stem>" --glob '!.git/**' .` — expect only the spec and this plan.
- [ ] **Step 2: Confirm `ESLINT_RULES.md` carries no decision.** It documents rule choices; `eslint.config.mjs` is the mechanism. Read both. If the doc records _why_ a rule was chosen and the config does not, that sentence moves verbatim into a config comment — that is a decision, not a cached fact.
- [ ] **Step 3: Delete both files.** `git rm docs/ESLINT_RULES.md docs/CI_WORKFLOW_SETUP.md`
- [ ] **Step 4: Cold-read review.** Fixed brief from the spec, diff only.
- [ ] **Step 5: `pnpm run check`; commit; PR; Copilot once; hand Tim the merge command.**

---

## Task 2: TypeScript

**Files:**

- Delete: `.agents/skills/pinpoint-typescript/` (334 lines, 212 fenced-code)
- Delete: `docs/TYPESCRIPT_STRICTEST_PATTERNS.md` (318 lines)
- Modify: `docs/NON_NEGOTIABLES.md` (add the surviving decision)

**Note on recency:** `TYPESCRIPT_STRICTEST_PATTERNS.md` was touched 2026-07-27 and 2026-07-31 — both by PP-22e4 itself (#1761, #1763). Self-inflicted; not evidence of use.

- [ ] **Step 1: Extract the one decision.** From the skill's `description` frontmatter, verbatim: _`InferSelectModel` yields camelCase types directly, so PinPoint has no db→app converter layer and none should be built (narrow with `Pick<>` at boundaries instead)._
- [ ] **Step 2: Verify it against the code** before moving it. Read `src/server/db/schema/` and confirm no converter layer exists and `InferSelectModel` is used as described.
- [ ] **Step 3: Add it to `docs/NON_NEGOTIABLES.md`** as a new `CORE-TS-*` entry, wording moved verbatim. Run `python3 scripts/check_rule_ids.py` — it validates ID ranges and ordering.
- [ ] **Step 4: Scan the rest of both files for any second decision.** Everything failing the three-question test goes. Expect this to be nearly everything: 63% of the skill is fenced code, and the prose covers `?.`, `??`, and `items.at(-1)`.
- [ ] **Step 5: Delete both.** Check inbound links first — `pinpoint-typescript/SKILL.md` links `TYPESCRIPT_STRICTEST_PATTERNS.md`, and `docs/testing/e2e-audit-2026-05.md` does too. The audit file is a frozen dated record; leave its text alone, but note the now-dead link in the PR description.
- [ ] **Step 6: Routing check.** With the skill gone, nothing routes on "TypeScript", "type error", "type guard", "InferSelectModel". Confirm `CORE-TS-007` / `CORE-TS-008` plus `.github/instructions/typescript.instructions.md` cover it. State this explicitly in the PR description — it is the highest routing-loss risk in the sweep.
- [ ] **Step 7: Cold-read review; `pnpm run check`; PR; Copilot; hand off.**

---

## Task 3: Security

**Files:**

- Modify: `.agents/skills/pinpoint-security/SKILL.md` (374 lines; 154 fenced, 32 `CORE-*` mentions)
- Modify: `docs/SECURITY.md` (312 lines)

**Care flag:** `docs/SECURITY.md` was last touched 2026-07-12 by real security work (#1664, Turnstile fail-open). It is maintained, not dormant. `middleware.ts` cites it, as does `docs/NON_NEGOTIABLES.md` and `docs/runbooks/turnstile-fail-open-monitoring.md` — a pointer must survive at that path.

- [ ] **Step 1: Delete §1–§4's `CORE-*` restatements.** Each of the 32 mentions is a section re-walking a rule the catalog owns. Replace each section with its ID.
- [ ] **Step 2: Delete §5 Code Examples** (lines ~187–374). Real server actions with auth and permission gates exist in `src/`.
- [ ] **Step 3: Keep, verbatim:** the `~/lib/url` seam (`getSiteUrl` / `requireSiteUrl` / `resolveRequestUrl` / `isInternalUrl` / `getSafeRedirect`) and why hand-rolled `process.env` URL building is banned; the Discord multi-provider registry decisions. Verify each against `src/lib/url/` and `src/lib/auth/providers.ts` before keeping.
- [ ] **Step 4: `docs/SECURITY.md` — apply test 2.** The static headers live in `next.config.ts`. Delete what describes them; keep any recorded _why_ (a header value chosen against a specific threat). The file must not be deleted — `middleware.ts` cites the path.
- [ ] **Step 5: Re-derive the skill description** from what survives. The current description advertises "CSP nonces, input validation, auth checks, Supabase SSR patterns" — check each term still has a body to route to.
- [ ] **Step 6: Cold-read review; lead source re-read; `pnpm run check`; PR; Copilot; hand off.**

---

## Task 4: Testing

**Files:**

- Modify: `.agents/skills/pinpoint-testing/SKILL.md` (420 lines; 189 fenced, 14 `CORE-*`)

- [ ] **Step 1: Delete the `CORE-*` restatements** (CORE-TEST-001, -005, -006 are catalog-owned).
- [ ] **Step 2: Delete the code examples** (45% of the file).
- [ ] **Step 3: Keep the bug-class table.** AGENTS.md §2.1 rule 9 explicitly routes to it (_"Bug-class table: `pinpoint-testing` skill"_) — it is a decision about which layer catches which bug class, and exists nowhere else.
- [ ] **Step 4: Check the which-tests tree.** It is triplicated across `AGENTS.md`, `pinpoint-testing`, and `pinpoint-e2e`, and both skill copies are missing AGENTS.md items 1 and 7. Delete both skill copies; `AGENTS.md` §5 owns it.
- [ ] **Step 5: Re-derive the description; cold-read review; `pnpm run check`; PR; Copilot; hand off.**

---

## Task 5: Process skills vs. their scripts

**Files:**

- Modify: `.agents/skills/pinpoint-pr-workflow/SKILL.md` (429)
- Modify: `.agents/skills/pinpoint-orchestrator/SKILL.md` (324)
- Modify: `.agents/skills/pinpoint-huddle/SKILL.md` (370)
- Modify: `.agents/skills/pinpoint-briefing/SKILL.md` (159)

The largest task. Test 2 dominates: if a script, hook, or gate already does it, point at the script.

- [ ] **Step 1: `pr-workflow` §4.2–4.5.** "What `merge-pr.sh` does", "Interpret output", "If `merge-pr.sh` itself is broken". The script prints its own verdicts — Tim's merge run in this session emitted five named PASS lines unprompted. Delete the narration; keep the human-only rule and the handoff command, which are decisions.
- [ ] **Step 2: `orchestrator` "Scripts Reference" and Phase 2 worktree setup.** The `post-checkout` hook allocates the slot, ports, `.env.local`, and `.claude/launch.json` by itself. Keep the two upstream-bug rules (#47548 dispatch-from-main-worktree, #47266 / the `WorktreeCreate` lock) — those are decisions with rationale that no script states.
- [ ] **Step 3: `huddle`.** The SessionStart / UserPromptSubmit / PostToolUse hooks do the injection and rotation. Keep the identity and self-filter conventions; delete the mechanics.
- [ ] **Step 4: `briefing`.** 58 of 159 lines are fenced. Apply test 3.
- [ ] **Step 5: Re-derive four descriptions.** Four skills in one PR is the largest routing surface in the sweep — consider splitting if the diff exceeds what one cold-read can hold.
- [ ] **Step 6: Cold-read review; lead source re-read; `pnpm run check`; PR; Copilot; hand off.**

---

## Task 6: UI leftovers

**Files:**

- Modify: `.agents/skills/pinpoint-ui/references/layout-and-anti-patterns.md` (188; 118 fenced)
- Modify: `.agents/skills/pinpoint-ui/references/form-patterns.md` (110; 86 fenced)

PR #1793 simplified `pinpoint-ui/SKILL.md` and `styling-and-shadcn.md` but did not reach these two.

- [ ] **Step 1: Apply test 3.** 63% and 78% fenced respectively.
- [ ] **Step 2: Keep the anti-patterns that record a decision** — an anti-pattern with a rationale is a decision; an anti-pattern that just shows wrong-vs-right code is a code example.
- [ ] **Step 3: Cross-check against `pinpoint-design-bible` §20** (forms) so the surviving text does not duplicate the bible.
- [ ] **Step 4: Cold-read review; `pnpm run check`; PR; Copilot; hand off.**

---

## Task 7: Logging + Development

**Files:**

- Modify or delete: `docs/LOGGING.md` (233 lines; last touched 2026-01-07, dormant)
- Modify: `docs/DEVELOPMENT.md` (210 lines)

**Care flag:** `DEVELOPMENT.md` was touched 2026-07-26 by #1758 (prod-safety DB scripts) — maintained by non-sweep work. `README.md` links it.

- [ ] **Step 1: `LOGGING.md` — apply test 2.** It describes the pino configuration. Read `src/lib/logger*` first; delete what the config states. Keep any recorded _why_ (the read-only-platform stdout fallback is a decision if the code does not explain itself).
- [ ] **Step 2: `DEVELOPMENT.md` — resolve the second front door.** Its own text says _"For full project rules and constraints, always start with `AGENTS.md`."_ Two entry points is a decision that was never made deliberately. Reduce to what `README.md` genuinely needs for a human contributor, or fold into `README.md` and delete.
- [ ] **Step 3: Cold-read review; `pnpm run check`; PR; Copilot; hand off.**

---

## Task 8: Always-loaded tier

**Files:**

- Modify: `AGENTS.md` (222 lines — delete §2.1)
- Modify: `.github/instructions/*.md` (6 files — add `paths:` frontmatter)
- Create: `.claude/rules/` (symlinks, or pointer files on fallback)

- [ ] **Step 1: Verify §2.1 is fully cached before deleting.** For each of the 20 summaries, confirm the corresponding `CORE-*` entry in `docs/NON_NEGOTIABLES.md` says at least as much. Spot-checked already: rule 12's sanctioned exceptions (`NON_NEGOTIABLES.md:451`) and rule 19's PBM throttle (`:399`) are both present in more detail. **Rule 4's Radix Select carve-out (PP-0fvr / PP-1ajq) is the known exception** — `CORE-ARCH-007` covers `useActionState` generally but not the carve-out, which lives in `pinpoint-ui`. Confirm the pointer survives.
- [ ] **Step 2: Replace §2.1 with a pointer** to the catalog and to `.github/instructions/`.
- [ ] **Step 3: Test the `paths:` key on Copilot — before committing to the symlink.** Add `paths:` alongside `applyTo:` in one instruction file, open a PR touching a file that matches its glob, and confirm Copilot still applies the instruction. This is the one unverified assumption in the design.
- [ ] **Step 4a (if Copilot tolerates it): symlink.** `ln -s ../../.github/instructions/<name>.instructions.md .claude/rules/<name>.md` for all six. One file, two harnesses, zero copies.
- [ ] **Step 4b (fallback): six pointer files** in `.claude/rules/`, each with `paths:` frontmatter and a body that is a single line pointing at the corresponding `.github/instructions/` file.
- [ ] **Step 5: Verify the `paths:` globs load.** A `.claude/rules/` file with no `paths:` field loads **unconditionally at launch** — worse than not having it. Confirm each file has the key.
- [ ] **Step 6: Add the `AGENTS.md` length gate** to `scripts/check_rule_ids.py`. Net-new code plus a test — there is no dormant "rule 3" to switch on.
- [ ] **Step 7: Cold-read review; `pnpm run check` (includes `check:rule-ids` and `check:pytest`); PR; Copilot; hand off.**

---

## Task 9: Description audit

**Files:**

- Modify: `.agents/skills/*/SKILL.md` frontmatter (15 skills)

The one task whose deliverable is new prose. Reviewed as such.

- [ ] **Step 1: Read all 15 descriptions against their post-sweep bodies.** Every distinctive term must have a body that answers it.
- [ ] **Step 2: Find collisions.** Two skills claiming the same term means neither routes reliably.
- [ ] **Step 3: Find gaps.** List the topics the sweep deleted a skill for — TypeScript above all — and confirm something still routes them, or record explicitly that nothing does and that this is intended.
- [ ] **Step 4: Cold-read review; `pnpm run check`; PR; Copilot; hand off.**
- [ ] **Step 5: Close PP-22e4** with landing notes: PR numbers, final corpus size, and any decision deleted in error that had to be restored.

---

## Self-review notes

**Spec coverage.** Every spec section maps to a task: the three-question test and destinations are Global Constraints; the diff constraint is Global Constraints plus the per-task method; the PR sequence is Tasks 1–8; the description work is Step 3 of the method plus Task 9; the guards track is Task 0; the `.claude/rules/` finding is Task 8 Steps 3–5.

**What this plan deliberately does not pre-specify.** The exact lines to delete in each file. That is not a placeholder — it is the method. The three-question test is applied against the repo at execution time, and pre-enumerating the deletions would mean doing the work twice and freezing it against a moving `main`.

**Known open risk.** Task 8 Step 3 is the only unverified assumption in the design: whether Copilot tolerates an unknown `paths:` key in its instruction frontmatter. Step 4b is the fallback and costs little.
