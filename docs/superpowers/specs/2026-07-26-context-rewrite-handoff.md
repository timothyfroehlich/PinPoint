# Context-system rewrite — session handoff (Mac → Bazzite)

**Written**: 2026-07-26 by `Claude-ContextRewrite` (MacBook), for a fresh session on **Bazzite**.
**Bead**: PP-22e4 (P1, OPEN) — "Claude-native context system rebuild".
**Companion spec**: `docs/superpowers/specs/2026-07-24-claude-native-context-system-design.md` — **now on `main`** (merged with PR #1738). Read it after this file; **this file overrides it wherever they disagree.**

This document exists because the original design conversation happened on the MacBook on 2026-07-24 and its transcript is not reachable from Bazzite. Everything load-bearing from that conversation is reproduced here.

---

## 0. Read order

1. This file (drift + current directives).
2. `docs/superpowers/specs/2026-07-24-claude-native-context-system-design.md` (the approved design — §5, §7, §11 are stale, see §5 below).
3. `bd show PP-22e4`.

**Mac-only, NOT reachable from Bazzite** (listed only so nobody hunts for them):

- Root design transcript `~/.claude/projects/-Users-froeht-Code-PinPoint/fb5e27d6-…jsonl` (design arc ≈ lines 1694–2520).
- Brainstorm visual-companion HTML under `.claude/worktrees/context-system-rebuild/.superpowers/brainstorm/`.

Nothing in either is needed — the quotes and decisions below are the extraction.

---

## 1. The decision that drives everything

Tim, 2026-07-24 23:19, verbatim on the load-bearing parts:

> "I'm not using Codex any more. While I do have Gemini quota that I have access to, Gemini's models have fallen much too far behind you, and they ain't catching up any time soon. I'm open source so I've got that free copilot review quota. […] **let's fully build for Claude's sota and optimize for it. Best practices for Claude (Vendor lock-in, baby!).** We'll make sure that Copilot/theoretical Gemini reviewers know where to find the information to do good reviews, and we'll do this by **creating a CODE_REVIEW.md in the root**, which directs agents to read certain files. We won't worry about overloading their context. **These reviews will receive the same weight as a code-review low Claude review.** I'll be triggering Claude code-review mediums and highs when it really matters. Oh, and I haven't even been using that agy dispatch for a while.
>
> Let's back up to the drawing board and re-build our context system around this. And yes, let's thinking about moving things into hooks instead of markdown files, **but only if it makes sense for a hook**."

Harness roster:

| Harness            | Status                                                                       |
| ------------------ | ---------------------------------------------------------------------------- |
| Codex              | **out** — no longer used                                                     |
| Antigravity/Gemini | **dispatch out** — but **review IN**, see §10.2. This changed on 2026-07-26. |
| Copilot review     | **kept** — free on open source; weight of a Claude `code-review low`         |
| Claude Code        | everything else — build for its SOTA, accept the lock-in                     |

Evidence for retiring `agy` **dispatch** (7-day, 50-transcript scan across 52 project dirs, 2026-07-24): 9/9 registered huddle sessions were Claude; 0 non-Claude huddle sign-offs in 30 days; 0 open `agy-ready` beads; `pinpoint-agy-execute` lifetime invocations **0**; `agy-dispatch` / `agy-triage` 4 and 2 across 578 startups.

### ⚠️ A framing that got SUPERSEDED — do not revert to it

At 22:33 Tim asked for a specific split:

> "I would like to adjust the agents/claude split. **agents for PinPoint information, Claude for operational information.** […]"

**Superseded 45 minutes later by the 23:19 message.** With Codex and Antigravity-dispatch gone, `AGENTS.md` has _no reader_ — Claude only sees it because `CLAUDE.md` line 3 is `@AGENTS.md`. There is no meaningful two-file split left to tune. The answer is: **CLAUDE.md is the single always-loaded project file; AGENTS.md shrinks to a stub.** If you find the 22:33 quote in some transcript and start designing a two-file split, you are working from the retracted version.

### Other decisions from that arc

- **22:20** — "let's do some extraction as long as we're keeping the pointers to skills. I think **a straight skill list table is probably redundant**." And: "**I want you to consider combining some of the skills we have, I worry about segmenting too far and agents not deciding to load the right ones just because they don't want to load too many.**" → origin of the 21→15 consolidation.
- **22:56** — "considering moving some non-negotiables out to skills, while still maintaining a single NON_NEGOTIABLES.md file to aid in reviews. **But only if we're sure that an agent would load the skill containing the non-negotiable.**" → the hard rule: _never put a non-negotiable in a skill._
- **23:48** — "no-verify is fine. **landing the plane — feels like pr workflow stuff. Because merge-pr blocks badly done PRs, I think that can stay out of the CLAUDE.md.**" → AGENTS.md §9 does not carry over into CLAUDE.md.
- **2026-07-25 04:44** — "Something's changed with you with Opus 5 vs 4.8. I feel like you're drowning me in text. **I need you to work in smaller pieces.**" → already added to Tim's global `~/.claude/CLAUDE.md`.

---

## 2. Target architecture

```
TIER 1  .claude/hooks/           enforcement — fires every time, no model judgment
TIER 2  CLAUDE.md                always loaded — target <200 lines
TIER 3  .claude/rules/*.md       path-scoped — deterministic when a matching file is read
TIER 4  .agents/skills/          on-demand — probabilistic, model-routed

SIDE    CODE_REVIEW.md           review-agent entry map (Copilot, Antigravity)
CANON   docs/NON_NEGOTIABLES.md  the authoritative rule catalog
```

**The tier ordering IS the placement rule.** A rule goes in the highest tier it qualifies for:

1. Mechanically decidable and must always hold → **hook** (or better, a guard inside the code itself).
2. Cross-cutting, or a "never create X" rule that must be known before any file is opened → **CLAUDE.md**.
3. Scoped to a real directory or glob → **`.claude/rules/`** with `paths:` frontmatter.
4. Reference depth or a sometimes-needed procedure → **skill**.

**Never put a non-negotiable in tier 4** — probabilistic loading is not a guarantee.

**Corollary from the 07-25/26 hook review**: the question is not how badly you want a rule followed, it is _what a violation costs_ and _whether the rule is about an effect or about intent_. **Effect-rules move DOWN a layer and become airtight** (CORE-ARCH-009 moved out of a hook and into `drizzle.config.ts` — PR #1741). **Intent-rules** ("who initiated this") can only live at the hook layer, can never be airtight, so tune them for **low false positives**, not completeness. A preference needs no hook at all. Threat model is explicitly **non-adversarial**.

---

## 3. File-by-file target (condensed from the spec)

### 3.1 `CLAUDE.md` — standalone, budget ~125 lines

| Section          | ~lines | Content                                                                        |
| ---------------- | ------ | ------------------------------------------------------------------------------ |
| Mission          | 8      | What PinPoint is; the 100+ machines / 1940s-EM-through-modern scale constraint |
| Rule index       | 15     | The 20 non-negotiables grouped by _how each reaches you_ (§3.5)                |
| Prohibitions     | 30     | Only those neither mechanizable nor path-scopable                              |
| Environment      | 25     | Host prereqs, starting the stack, worktree ports, process safety               |
| Key commands     | 15     | `check` / `preflight` / `smoke` / `db:migrate` and when each applies           |
| Which tests      | 8      | The two "Never" rules + reproduce-CI-locally                                   |
| Claude specifics | 16     | Status vocabulary, worktree/subagent prohibitions, `gh` / `dev:status` notes   |
| Pointers         | 10     | rules, skills, `NON_NEGOTIABLES.md`, `CODE_REVIEW.md`                          |

**No `@AGENTS.md` import.** Disposition of today's "Claude Code-Specific" block:

| Today                      | lines | Disposition                                                                                                                                                                    |
| -------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Worktree dispatch safety   | 20    | → **hook** (`block-worktree-dispatch-from-linked.cjs`, **now on main**). One-line pointer stays; the technical record already lives in `pinpoint-orchestrator` Phase 2         |
| Worktrees (Claude Code)    | 8     | Mostly describes what `post-checkout` / `WorktreeRemove` already do. Keep only: manual `git worktree remove` / `rm -rf` skips the hook and leaks slot entries + Docker volumes |
| Parallel Subagent Workflow | 10    | Procedure → `pinpoint-orchestrator`. Keep one gotcha: **hooks don't fire for subagents**, so `pnpm run check` is self-enforced via the dispatch prompt                         |
| Working Style (3 bullets)  | 5     | Not PinPoint-specific → `~/.claude/CLAUDE.md`                                                                                                                                  |
| Status vocabulary          | 5     | **Keep.** Speech rule, always applies, unenforceable                                                                                                                           |
| Sandbox & Playwright       | 5     | Mach-port / `excludedCommands` half → `pinpoint-e2e`. **Note: that half is macOS-only and does not apply on Bazzite.** `gh` TLS + `dev:status` stay                            |
| Session Completion         | 1     | Dies with AGENTS.md §9                                                                                                                                                         |
| Antigravity                | 8     | **Rewrite, don't delete** — see §10.2                                                                                                                                          |
| Context7 MCP               | 4     | **Stale** — `context7` was removed as an MCP on 07-24; it is now a claude.ai connector. Open decision                                                                          |
| Specialized Subagents      | 5     | **Stale** — lists `enforcer` and `investigator`; `investigator.md` was deleted 07-24                                                                                           |

**AGENTS.md §9 "Landing the plane" is NOT carried into CLAUDE.md** (Tim's 23:48 call). Coverage was verified first: `pinpoint-pr-workflow` already has the pre-push check/preflight decision (Phase 1), UI screenshots (§3.5), merge handoff (§4.1). **One step had no coverage anywhere** — §9 step 6, "after Tim merges, watch the production deploy land." → becomes **`pinpoint-pr-workflow` Phase 5: post-merge deploy watch**.

### 3.2 `AGENTS.md` — stub, ≤10 lines

```
PinPoint targets Claude Code.
Authoring rules: CLAUDE.md
Rule catalog: docs/NON_NEGOTIABLES.md
Review guidance: CODE_REVIEW.md
```

Kept rather than deleted so a tool looking for the standard filename lands somewhere useful. Must never grow again — `check_rule_ids.py` rule 3 (AGENTS.md ≤10 lines) is **deferred to the rewrite PR** and should be turned on there.

### 3.3 `.claude/rules/` — new, 6 files

Globs lifted from the already-proven `.github/instructions/` set (frontmatter key differs: `paths:` array vs `applyTo:` string; globs identical).

| File              | `paths:`                                                                            | Rules carried                                                              |
| ----------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `pinballmap.md`   | `src/lib/pinballmap/**`, `src/server/**/pinballmap*`                                | CORE-PBM-001                                                               |
| `testing.md`      | `**/*.test.ts(x)`, `**/*.spec.ts`, `e2e/**/*.ts`, `src/test/**/*.ts`                | CORE-TEST-001/005/006                                                      |
| `supabase-ssr.md` | `**/*auth*.ts`, `**/middleware.ts`, `src/lib/supabase/**/*.ts`, `src/app/(auth)/**` | CORE-SSR-001/002                                                           |
| `server.md`       | `**/actions.ts`, `src/server/**/*.ts`, `src/lib/**/*.ts`                            | CORE-ARCH-008/011                                                          |
| `components.md`   | `src/components/**/*.tsx`, `src/app/**/*.tsx`                                       | CORE-ARCH-001/002, RESP-001..004, FORM-001..006, A11Y-001..006, UI-005/006 |
| `database.md`     | `src/server/db/**/*.ts`, `drizzle/**`, `supabase/**`                                | CORE-ARCH-009 (restated; the `drizzle.config.ts` guard is primary)         |

- **Voice matters.** `.claude/rules/` is **authoring** voice ("do X", "the pattern is Y"). `.github/instructions/` stays **review** voice ("flag X"). Same rule, different job — this is why they are not generated from one source.
- **Known limitation.** Path-scoped rules fire when Claude _reads_ a matching file. A "never create a second X" rule may not fire if Claude never opens an existing file in that path. **Creation-type prohibitions therefore stay in CLAUDE.md (tier 2).**

### 3.4 `CODE_REVIEW.md` — new, repo root

The review-agent entry map for Copilot and Antigravity. Their context budget is explicitly **not** a design constraint, so it points at full documents rather than summarizing.

Contents: what PinPoint is and what it deliberately is _not_ (single-tenant, no RLS, no tRPC); review priorities that have each shipped a real bug; the `CORE-*` citation convention; pointers to `docs/NON_NEGOTIABLES.md`, `.github/instructions/`, `pinpoint-design-bible`, `CLAUDE.md`.

**Loading mechanics — easy to get wrong.** Copilot does not discover root files on its own. It auto-loads only `.github/copilot-instructions.md` and `.github/instructions/*.instructions.md`. So **`.github/copilot-instructions.md` shrinks to a stub whose entire job is "read `/CODE_REVIEW.md` and follow it."** Without that stub, `CODE_REVIEW.md` is never loaded by anything. `.github/instructions/*.instructions.md` are kept unchanged — Copilot's working path-scoped layer. **Antigravity needs its own entry point into the same file — see §10.2.**

### 3.5 The rule index (CLAUDE.md, ~15 lines)

Twenty one-line summaries would eat ~100 of the 200-line budget. Instead group by **how each rule reaches the agent**:

- **Enforced mechanically — you will be told when you break these.** CORE-TS-007/008 (ESLint), ARCH-009 (`drizzle.config.ts` guard + deny rule), ARCH-011 (runtime tripwire), SEC-008, PBM-001 rate limit (`syncLocationSnapshot` seam).
- **Loaded automatically when you open the files they govern.** PBM-001, TEST-001/005/006, SSR-001/002, ARCH-001/002/008, RESP-001..004, FORM-001..006, A11Y-001..006, UI-005/006.
- **Yours to remember — neither mechanizable nor scopable.** SEC-007 (email privacy), ARCH-010 (Rule of Three, **with Tim's at-TWO caveat** for large/load-bearing shared things), SEC-009 (env registry), TEST-006 class-J (no production third-party hostname reachable from E2E).
- **Full catalog, authoritative:** `docs/NON_NEGOTIABLES.md`.

This supersedes an earlier decision to keep all 20 inline — that assumed a ~14k AGENTS.md which no longer exists.

### 3.6 Skill consolidation 21 → 15

| Change                        | Skills                                                                           | Rationale                                                                                        |
| ----------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Delete (Antigravity dispatch) | `agy-triage`, `agy-dispatch`, `agy-execute`                                      | −3; dispatch surface retired. **Review surface replaces it — §10.2**                             |
| Merge → `pinpoint-deployment` | `db-connections`, `migration-conflicts`, `preview-deployments`, `audit-override` | −3; **8,667 chars combined**, uses 0/2/0/0. Four near-identical routing choices for one question |

Plus: delete the duplicated "Which Tests to Run" tree from `pinpoint-e2e` (verbatim in `pinpoint-testing`); `pinpoint-pr-workflow` gains **Phase 5** (post-merge deploy watch); `pinpoint-e2e` gains the sandbox/Playwright troubleshooting from CLAUDE.md.

**Considered and rejected** (do not re-litigate without new information):

| Option                                      | Why not                                                                                           |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Delete `AGENTS.md` outright                 | A stub costs nothing and catches a future tool looking for the standard name                      |
| Generate rule files from the catalog        | Two registers (authoring vs review) from one source; failure mode is subtly-wrong generated prose |
| Merge `pinpoint-testing` + `pinpoint-e2e`   | Both actively used (9 and 7); 33k combined is a lot for a Playwright-only question                |
| Merge `orchestrator` + `superpowers-bridge` | Bridge has a much narrower trigger                                                                |
| Merge `briefing` + `chores`                 | Different cadences, both hook-driven; briefing runs 29× and would drag 10k of chores along        |
| Merge `design-bible` + `pinpoint-ui`        | Would create a ~100k skill. The opposite is needed (see §7)                                       |
| "Caveman" prose compression                 | ~0.2% of a 1M window, and the compressible parts are exactly the rationale that makes rules stick |
| Codex nested `AGENTS.md`                    | Codex retired                                                                                     |

### 3.7 Drift control — `check:rule-ids` (**shipped**)

`scripts/check_rule_ids.py`, wired into `pnpm run check`:

1. Every `CORE-*` ID cited in `CLAUDE.md`, `AGENTS.md`, `.claude/rules/**`, `.github/instructions/**`, `.github/copilot-instructions.md`, `.claude/hooks/*.cjs`, `CODE_REVIEW.md` must exist in `docs/NON_NEGOTIABLES.md` → **fail** if not.
2. Catalog rules cited nowhere → **opt-in audit** (`pnpm run check:rule-ids:orphans`), never a default warning. 42 of 66 are legitimately "orphaned" because the catalog is deliberately broader than what gets promoted.
3. `AGENTS.md` ≤10 lines → **deferred to the rewrite PR**; turn it on there.

Known gaps flagged in review (worth fixing during the rewrite, not blocking): range shorthand (`CORE-A11Y-001..006`) only matches the leading ID, so 13 live IDs are invisible to the gate in both directions.

---

## 4. Current state on disk — `origin/main` @ `bce3507d`, 2026-07-26

| Artifact                          | Size                         | Note                                                               |
| --------------------------------- | ---------------------------- | ------------------------------------------------------------------ |
| `AGENTS.md`                       | **32,510 chars / 245 lines** | Grew back after the 07-24 cut was never committed                  |
| `CLAUDE.md`                       | 6,394 chars / 80 lines       | Imports AGENTS.md wholesale via `@AGENTS.md`                       |
| combined                          | **325 lines**                | vs the **<200-line** target                                        |
| `docs/NON_NEGOTIABLES.md`         | 50,031 chars / 661 lines     | 66 distinct `CORE-*` IDs; carries `trigger: always_on` frontmatter |
| `.github/copilot-instructions.md` | 3,482 chars / 33 lines       | Review-voice rule summary                                          |
| `.agents/skills/`                 | **21 skills, 298,492 chars** | `.claude/skills` symlinks to it                                    |
| `.github/instructions/`           | 6 files                      | Path-scoped `applyTo:` globs — **already working**                 |
| `.agents/rules/AGY.md`            | 931 chars                    | Antigravity-only                                                   |
| `.claude/rules/`                  | —                            | **does not exist**                                                 |
| `.claude/hooks/`                  | 5 blocking PreToolUse        | Down from 8                                                        |

Skill sizes (chars), smallest → largest:

```
   934  pinpoint-migration-conflicts     9,542  pinpoint-superpowers-bridge
 1,636  pinpoint-preview-deployments     9,810  pinpoint-agy-execute
 1,715  pinpoint-audit-override         11,239  pinpoint-chores
 4,382  pinpoint-db-connections         12,346  pinpoint-patterns
 4,621  pinpoint-agy-dispatch           15,402  pinpoint-orchestrator
 4,799  pinpoint-prototype-mode         20,763  pinpoint-security
 6,180  pinpoint-agy-triage             21,127  pinpoint-pr-workflow
 7,176  pinpoint-briefing               22,024  pinpoint-huddle
 7,598  pinpoint-e2e                    25,752  pinpoint-testing
 9,501  pinpoint-typescript             39,882  pinpoint-ui
                                        62,063  pinpoint-design-bible  ← 21% of corpus
```

---

## 5. Drift since the spec was written — absorb this, the spec is wrong here

1. **PR #1738 MERGED** on 2026-07-26 (commit `57e2ba12`). The spec's "PR 1" is done. On `main` now: the design spec itself, `scripts/check_rule_ids.py` + `pnpm run check:rule-ids` wired into `check`, `scripts/tests/test_check_rule_ids.py`, and `.claude/hooks/block-worktree-dispatch-from-linked.cjs`. **The rewrite is fully unblocked and has its drift gate already in place.**

2. **#1736 closed unmerged.** The spec's §7 and §11 both say _"#1736 merges first; everything else is blocked on it."_ **Dead.** The PP-c0uy `--dependabot` merge carve-out was never implemented; bead **PP-c0uy is back to OPEN**. Consequence: CLAUDE.md carries the **plain human-only merge rule**, and spec §7 ("carrying PP-c0uy forward") is entirely moot.

3. **The hook layer shrank 8 → 5 and two of the spec's three new hooks were cut.**
   - `#1740` deleted `block-bad-shell-patterns.cjs` + `block-dangerous-commands.cjs`.
   - `#1741` moved CORE-ARCH-009 into `scripts/lib/drizzle-push-guard.ts` → `assertNotDrizzlePush()` as the first statement in `drizzle.config.ts`, ahead of `loadEnvConfig()` and any `POSTGRES_URL` read. Airtight regardless of invocation shape; cannot misfire on prose. **This is the canonical example of an effect-rule moving down a layer.**
   - `block-drizzle-push.cjs` dropped (superseded by the above).
   - `block-loopback-literal.cjs` dropped — Tim's call: CORE-SEC-008 is already a documented non-negotiable and the hook was structurally blind to generators and heredocs. Stays prose-enforced.
   - `#1747` fixed `block-heavy-under-pressure.cjs` to resolve the effective command instead of substring-matching.
   - **Surviving blockers**: `block-heavy-under-pressure`, `block-direct-merge`, `block-main-worktree-branch-switch`, `block-worktree-dispatch-from-linked`, plus the non-blocking `normalize-workspace-paths` / `inject-beads-actor`.

4. **`block-heavy-under-pressure.cjs` still has a live false-positive class** reported on the huddle 2026-07-26 (after #1747): it blocks commands whose _arguments or heredoc body_ merely mention a heavy command name — e.g. `rg -c 'pnpm run smoke' AGENTS.md`. Confirmed by controlled test. Bypass for one run with `FORCE_MEM_PRECHECK=skip`. **This will bite constantly during this work**, because the work is writing prose that names test commands. Tim is assigning an investigator separately; do not fold that fix into this rewrite.

5. **Stale CLAUDE.md content the spec never catalogued**: the Context7 MCP section (context7 was removed as an MCP on 07-24, now a claude.ai connector) and the "Specialized Subagents" list (`investigator.md` was deleted 07-24; `enforcer` needs verifying).

6. **`verify-guard-stack.cjs` is one-directional** — it asserts every EXPECTED hook is registered, never that every registered hook still exists on disk, so dead registrations ship silently. Filed as **PP-ncla** (open). Relevant because the rewrite touches hook registration surface.

---

## 6. Antigravity **dispatch** retirement — full inventory

Superset of the spec's §4.5. From `rg "agy-ready|agy-ui|pinpoint-agy|AGY\.md|Antigravity"`. **Read §10.2 first — the review surface is being kept and rebuilt, so this is a retirement of dispatch only.**

**Delete — dispatch-only surface:**

- `.agents/skills/pinpoint-agy-triage/`, `pinpoint-agy-dispatch/`, `pinpoint-agy-execute/`
- `.agents/hooks/agy-beads-bootstrap.cjs` — the Antigravity `PreInvocation` payload shim
- `agy-ready` / `agy-ui` bead-tagging workflow references
- `AGENTS.md` → the 3 `Antigravity` rows in the §3 skill table; the `.agents/rules/AGY.md` pointer in §2.2 rule 5

**Rewrite, not delete:**

- `.agents/rules/AGY.md` → becomes the Antigravity **review** entry point (§10.2), or is replaced by whatever file Antigravity actually auto-loads. Verify the mechanism before writing it.
- `CLAUDE.md` `### Antigravity` section → shrinks to "Antigravity does PR reviews; see CODE_REVIEW.md" or disappears entirely if no Claude-side behavior depends on it.
- `trigger: always_on` / `# For Antigravity` frontmatter (4 lines each) on `docs/NON_NEGOTIABLES.md`, `docs/PATTERNS.md`, `docs/TYPESCRIPT_STRICTEST_PATTERNS.md` — **do not blind-delete**; if that frontmatter is how Antigravity auto-loads a file, it is now load-bearing for reviews. Confirm the mechanism first.

**Update — stale pointers created by the deletions:**

- `scripts/hooks/huddle-poll.sh:8`, `huddle-session-start.sh:7,22` — comments pointing at `.agents/hooks/agy-beads-bootstrap.cjs`

**Keep — harness-neutral:**

- Huddle name examples (`Antigravity-TestAudit` etc.) in `huddle-*.sh`, `pinpoint-huddle/SKILL.md`, `scripts/tests/test_huddle_pr_announce.py` — the huddle is deliberately multi-harness
- `pinpoint-pr-workflow/SKILL.md:245` and `scripts/workflow/merge-pr.sh:33` — the `--human` defense-in-depth rationale for "harnesses without the Claude Code hook". Reword to _"non-Claude-Code harnesses"_
- `.gitignore:157` `.antigravitycli/`
- The `—Claude` / `—Gemini` / `—Codex` / `—Antigravity` review-reply signing list — trim `—Codex`, keep `—Antigravity`

---

## 7. Out of scope — follow-up beads

- **Split `pinpoint-design-bible` (62,063 chars ≈ 15,500 tokens).** 21% of the skill corpus. A compact core (archetypes, spacing, surfaces) + a reference half makes the common case ~10× cheaper.
- **`disable-model-invocation: true` audit.** Zero-context-cost flag for user-only skills.
- **PP-ncla** — make `verify-guard-stack.cjs` bidirectional.
- **PP-c0uy** — the `--dependabot` merge carve-out, back to OPEN.
- **`check_rule_ids.py` range shorthand** — `CORE-A11Y-001..006` only matches the leading ID.

---

## 8. Standing constraints

- **Merging is human-only via ANY path.** Agent terminal state = ready-for-review, CI green, reviews resolved, screenshots if UI-touching, then hand Tim `! scripts/workflow/merge-pr.sh <PR> --human`.
- **Copilot is out of review quota until ~2026-08-01.** A quota-limited **empty** Copilot review still **passes** the `reviewed` + `currency` gates — a false green. Treat as unreviewed; review manually and run `scripts/workflow/mark-claude-review.sh <PR>` (PP-jw0s). **This directly affects this work**: PRs opened before ~08-01 need a manual review pass.
- **Root checkout is read-only**; all work in a worktree. Don't dispatch `Agent(isolation:"worktree")` from a linked worktree (bug #47548) — dispatch from the root checkout only.
- **Sync with merge, never rebase.** Never `--no-verify`.
- **Tim skips implementation plan docs** — don't rely on plan-review gates; surface consequential forks inline.
- **Work in small chunks**; conclusion first, supporting detail on request.
- **Don't make Tim's calls for him** — operational calls are fine in autonomous mode; taste/scope decisions are not.

---

## 9. Where the work stands

Nothing has been implemented. The MacBook worktree `feat/context-system-PP-22e4` contains **only this document**. Every code/doc change described above is unwritten.

---

## 10. New directives — 2026-07-26, and they change the shape of the work

### 10.1 Claude-5-generation context engineering is now an explicit design input

All three models Tim uses (Sonnet, Opus, Fable) are gen 5. Required reading before designing:

- `/doctor` skill — its context-engineering guidance (unused-extension detection, CLAUDE.md trimming, migrating always-loaded guidance to lazy loading, the ~1% skill-listing budget, deferral-awareness for MCP tools).
- <https://claude.com/blog/the-new-rules-of-context-engineering-for-claude-5-generation-models>

The thesis Tim is applying: **gen-5 models need less context to get things right and do better when given room for judgment.** That reframes the rewrite from "reorganize the same instructions" to "delete instructions that exist only because an older model needed hand-holding, and replace prescription with the _why_ plus latitude." It also applies to **scripts**, not just markdown — hook messages, dispatch-prompt templates, and agent-facing script output should be re-read with the same lens.

Watch for the tension with §2: this pull toward less context and more latitude is **bounded by the non-negotiables**, which stay prescriptive and stay in tiers 1–3. Latitude applies to _how_ things get built, not to whether the rules hold.

### 10.2 Antigravity comes back — as a reviewer, not a dispatch target

**Dispatching to Antigravity was clunky and is being retired** (§6). But Tim wants to **prep for Antigravity doing PR reviews to supplement Copilot**.

- Both Copilot and Antigravity reviews carry the weight of **`code-review` at `low`**.
- Both are intended for **smaller changes**. Tim manually triggers bigger Claude `code-review` runs on the big ones.
- Tim's framing: _"Don't worry about that part too much, just keep that in mind"_ — this is **prep**, not the deliverable. Do not design the whole Antigravity review pipeline in this pass.
- **But**: Tim explicitly wants **the things that prep it to happen sooner rather than later**. So `CODE_REVIEW.md` and the review-agent entry points move **early** in the PR sequence, not last.
- **Open question to resolve before writing §6's rewrites**: what does Antigravity actually auto-load? Verify before deleting `trigger: always_on` frontmatter or `.agents/rules/AGY.md`, either of which may be the answer.

### 10.3 Goals, in Tim's words

1. **Claude Code-first.**
2. **Enable Claude to use its judgment better.**
3. **Prep for Antigravity reviews; ensure Copilot reviews stay good.**
4. **Rely on progressive disclosure.**
5. **Ensure Claude knows how to find the info it needs.**

### 10.4 How the work gets executed

- **Restart at `/brainstorming`.** The 07-24 spec is input, not a settled plan — §10.1 and §10.2 are new constraints it never saw.
- **Run from the root checkout** (`/Users/froeht/Code/PinPoint` on Mac; the Bazzite equivalent), _not_ from inside a linked worktree — that is the only safe place to dispatch `Agent(isolation:"worktree")` (bug #47548).
- **Use `/pinpoint-orchestrator`.** Dispatch **Sonnet subagents** for the first pass on each chunk; **Claude (lead) reviews every result** and confirms nothing important was lost. The lead does not do the bulk writing.
- **Subdivide into more, smaller PRs** than the spec's two-or-three. Each must land **complete** — no fast-follow. §3's file-by-file table is a natural seam set.
- **Be methodical.** Tim's explicit word.

### 10.5 Open decisions for the new session

1. **PR sequencing.** The spec argues for one big PR; Tim now wants several smaller complete ones, with review-prep early. Propose a sequence and get his sign-off before writing.
2. **The stale CLAUDE.md sections** (Context7 MCP, Specialized Subagents) — not in the spec's disposition table. Verify what's actually installed, then decide.
3. **The Antigravity auto-load mechanism** (§10.2) — a fact to establish, not a taste call.
