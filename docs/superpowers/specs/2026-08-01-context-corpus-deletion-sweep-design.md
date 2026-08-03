# Context corpus deletion sweep — design

**Date:** 2026-08-01
**Bead:** PP-22e4
**Status:** Approved (Tim, 2026-08-01)
**Supersedes:** PRs 8–10 of the 10-PR sequence recorded in PP-22e4's notes

## Why this exists

The original PP-22e4 sequence assumed the problem was _organization_ — that the
context corpus needed relocating into better-scoped homes. Seven PRs in, the
honest scorecard was that total corpus size stayed roughly flat, because most
PRs moved text rather than removing it.

Tim's reframe:

> so much of what's in docs was from a time where I really did need to teach you
> how to code, basically, so I feel like most of that can be cleaned up now

and, earlier:

> we really just need to record decisions made, not teach you how to code

The corpus was written when teaching a model to write TypeScript was a real
need. It no longer is. What remains valuable is the record of choices this
project made that a competent agent could not derive from the code.

**Risk posture** (Tim, 2026-08-01, recorded because it governs how hard to cut
and would otherwise be invisible to a later reader):

> We'll do the best we can. We've been having fewer and fewer drastic issues
> lately, so I'm getting less worried about over-trimming work

Bias toward cutting when a line is borderline. Under-cutting is the failure mode
this sweep exists to correct — the first seven PRs left the corpus roughly flat
by moving text instead of removing it.

## The test

Applied line by line, in order:

1. **Does a CORE-\* rule already say this?** → delete, cite the ID.
2. **Does a script, hook, or gate already do this?** → delete, name the script.
3. **Is this a code example?** → delete. Real ones exist in `src/`.

Whatever survives all three is a decision.

Evidence that these three patterns account for most of the corpus:

| File                                                 | Lines | Fenced-code lines | CORE-\* mentions |
| :--------------------------------------------------- | ----: | ----------------: | ---------------: |
| `pinpoint-typescript/SKILL.md`                       |   334 |         212 (63%) |                3 |
| `pinpoint-testing/SKILL.md`                          |   420 |         189 (45%) |               14 |
| `pinpoint-security/SKILL.md`                         |   374 |         154 (41%) |               32 |
| `pinpoint-orchestrator/SKILL.md`                     |   324 |         109 (34%) |                0 |
| `pinpoint-ui/references/layout-and-anti-patterns.md` |   188 |         118 (63%) |                7 |
| `pinpoint-ui/references/form-patterns.md`            |   110 |          86 (78%) |                1 |

`pinpoint-pr-workflow/SKILL.md` is the script-narration case rather than the
code-example case: §4.2 "What `merge-pr.sh` does", §4.3 "Interpret output", §4.5
"If `merge-pr.sh` itself is broken" describe a script Tim runs and which prints
its own verdicts.

## Where survivors go

Two destinations, both already existing. **No third home is created.**

- **Enforced rule** → `docs/NON_NEGOTIABLES.md` as a `CORE-*` entry. It has 17
  inbound links and is the working catalog.
- **The _why_ behind a choice** → stays in the owning skill. "vaul not Radix
  Sheet, for swipe momentum" is not enforceable, but it stops the next agent
  re-litigating it.

If a survivor fits neither destination, that is evidence it was a cached fact
after all. Delete it.

## The diff constraint

This is the core design decision, and it comes from a measurement rather than a
preference.

PR #1793 (PR 7 of the original sequence) took six Copilot rounds and produced 8
real findings with 0 false positives. **Every one of the 8 landed on a passage
that PR rewrote. None landed on a passage it deleted and replaced with a
citation.** Rewriting a cached fact quietly produces a _new_ claim while feeling
like the removal of an old one. Two of the corrections in that PR overshot into
false negations — the same failure twice in one PR, which is a mode rather than
a slip.

Therefore, within a file the only permitted operations are:

- **DELETE** — remove lines.
- **MOVE-VERBATIM** — relocate lines byte-identically to another file.
- **POINTER** — add a line whose content is a reference: a `CORE-*` ID, a file
  path, or a `see X` clause.

**Rewriting a surviving passage is out of scope for these PRs.** If a survivor
is found to be wrong, it gets a bead and stays as-is. Fixing it is a separate
change reviewed as new prose, because that is what it is.

The single exception is skill `description` frontmatter — see below.

## Scope

**In scope**

- Always-loaded tier: `AGENTS.md` (222), `CLAUDE.md` (76)
- `.agents/skills/**` (~5,700 lines across 15 skills)
- `.github/instructions/**` (6 files), `.agents/rules/antigravity.md`
- Agent-facing `docs/*.md`: `ESLINT_RULES` (328), `TYPESCRIPT_STRICTEST_PATTERNS`
  (318), `SECURITY` (312), `LOGGING` (233), `DEVELOPMENT` (210),
  `CI_WORKFLOW_SETUP` (34)

**Keepers, not swept**

- `docs/NON_NEGOTIABLES.md` (666) — the decisions catalog, and a destination
- `docs/ENV_VARS.md` (213) — the registry and scope matrix cited by CORE-SEC-009

**Out of scope** (Tim's explicit call)

- `docs/TECH_SPEC.md`, `docs/PRODUCT_SPEC.md`, `docs/V2_ROADMAP.md` — product
  records, a different problem
- `docs/plans/`, `docs/superpowers/`, `docs/testing/*-audit-*.md` — dated frozen
  records
- `docs/runbooks/` — operational procedures for production incidents
- `docs/pbm-listing-redesign-refresher.md` — a live working handoff document for
  the in-flight PBM epic, updated 2026-08-01 by #1762. Revisit once that epic
  lands; another agent is on it now.

Total in scope ≈ 7,400 lines. Expected removal: 3,500–4,500.

## PR sequence

Eight PRs, hard-serialized in the existing PP-22e4 manner: no PR N+1 worktree
until PR N's merge commit is on `origin/main`. Ordered lowest-risk first.

1. **Orphans.** `ESLINT_RULES.md` (328) and `CI_WORKFLOW_SETUP.md` (34). Zero
   inbound links, and dormant — last substantive touches 2026-06-06 (#1505) and
   2026-01-07 (#704). 100%-deletion diff. ~362 lines.

   `pbm-listing-redesign-refresher.md` (227) was in this group and was
   **removed from it**. It has zero inbound links but was updated 2026-08-01 by
   #1762 and is the working handoff document for the in-flight PBM epic.
   **Zero inbound links does not mean unused** — a handoff or refresher doc is
   opened by path from a bead, never linked to. Every deletion candidate gets a
   `git log -3 -- <file>` recency check as well as a link check. Recency caused
   by this sweep's own PRs does not count as use: `TYPESCRIPT_STRICTEST_PATTERNS.md`
   looks recent only because PP-22e4 edited it twice.

2. **TypeScript.** `pinpoint-typescript` (334) + `TYPESCRIPT_STRICTEST_PATTERNS.md`
   (318). One decision moves verbatim to the catalog: _`InferSelectModel` yields
   camelCase types directly, so PinPoint has no db→app converter layer and none
   should be built._ ~650 lines.
3. **Security.** `pinpoint-security` (374) + `docs/SECURITY.md` (312). Survivors:
   the `~/lib/url` seam (`getSiteUrl` / `requireSiteUrl` / `resolveRequestUrl` /
   `isInternalUrl` / `getSafeRedirect`) and why hand-rolled `process.env` URL
   building is banned; the Discord multi-provider registry decisions.
   `middleware.ts` cites `SECURITY.md`, so a pointer must survive.
4. **Testing.** `pinpoint-testing` (420, 45% fenced).
5. **Process skills vs. their scripts.** `pr-workflow` (429), `orchestrator`
   (324), `huddle` (370), `briefing` (159). ~1,282 lines. Test 2 dominates here:
   `merge-pr.sh`, `pr-watch.py`, the `post-checkout` / `WorktreeCreate` hooks,
   and the huddle hooks already do most of what these narrate.
6. **UI leftovers.** `layout-and-anti-patterns.md` (188), `form-patterns.md`
   (110). PR #1793 did not reach these.
7. **Logging + Development.** `LOGGING.md` (233) describes the pino config;
   `DEVELOPMENT.md` (210) is a second front door whose own text says "always
   start with `AGENTS.md`".
8. **Always-loaded tier.** Delete `AGENTS.md` §2.1 — 20 one-line summaries whose
   own header instructs the reader to keep them in sync with the 666-line
   catalog. Spot-checked: rule 12's sanctioned exceptions and rule 19's PBM
   throttle are both present in `NON_NEGOTIABLES.md` in _more_ detail. Plus the
   `.claude/rules/` decision below and the `AGENTS.md` length gate.

Then:

9. **Description audit.** One closing pass over all 15 skill descriptions for
   cross-skill collisions, gaps, and routing terms orphaned by the sweep.

### The `.claude/rules/` finding (PR 8)

The original PR 8 was to build `.claude/rules/` as six new files replacing
`AGENTS.md` §2. That would have created a **fourth** copy of every rule:
`NON_NEGOTIABLES.md` → `AGENTS.md` §2.1 → `.github/instructions/` →
`.claude/rules/`.

`.github/instructions/` already exists — six files, `applyTo:` globs, keyed to
`CORE-*` IDs, written in review voice. It is already the path-scoped rule layer.

`.claude/rules/` is a real Claude Code feature (verified against
`code.claude.com/docs/en/memory`): glob-scoped via `paths:` frontmatter, loads
when Claude reads a matching file, and **supports symlinks**. The key name
differs from Copilot's (`paths:` vs `applyTo:`), and a rule file with no `paths:`
field loads **unconditionally at launch** — so a naive symlink is worse than
nothing.

Preferred approach: add a `paths:` key alongside `applyTo:` in the six existing
files, then symlink them into `.claude/rules/`. One file, two harnesses, zero
copies. **Unverified risk:** whether Copilot tolerates an unknown `paths:` key.
Fallback if it does not: six thin `.claude/rules/` files whose entire body is a
pointer to the corresponding `.github/instructions/` file.

## Parallel track: guards

Independent of every file above, so hard-serialization does not apply. Starts
immediately.

- **PP-ojv5 (P1).** `package.json` `lint` is `eslint src/ --quiet`. `e2e/` is a
  sibling directory, so ESLint has **never** run on it — while
  `eslint.config.mjs:251-253` asserts the opposite in a comment:
  _"which also matches `e2e/**/*.ts(x)` — so e2e files are covered at 'error'
  with no hole."_ True of match scope, false of execution scope.
- CI-only guard on `e2e:full` / `e2e:all`.
- No-spec-path guard on `pnpm exec playwright test`.

## Verification

### The gate is arithmetic, not a prose parser

_Decision (Tim, 2026-08-01): no lints or scripts that parse prose._ This is a
general rule for this work, not a one-off — it also governs the rejected
description lint below.

A semantic gate was designed and rejected: for every added line, assert it is
byte-identical to a deleted line, or a pointer, or frontmatter. It fails on
first contact with markdown. Deleting a clause rewraps the surrounding
paragraph, so byte-identical matching fires on every touched paragraph;
"pointer" detection is a regex over English; and the first false positive buys
an escape hatch, after which the work becomes writing justifications instead of
deleting text.

A deletion-ratio check (`git diff --numstat`, additions ≤10% of deletions), a
link-resolution check, a CORE-ID-last-mention check, and a removal ledger were
all offered and **declined** (Tim, 2026-08-01). The local gate is a review, not
tooling.

### The local gate: a cold-read reviewer

One subagent per sweep PR, run **before push**, given the diff and the brief
below and **nothing else**.

This shape is chosen from the PR #1793 measurement rather than by preference.
Three targeted auditors, each handed a list of claims derived from my own
analysis, found **0 of 8** real defects. Copilot, reading the diff cold with no
list, found **8 of 8**. The variable was not model or effort — it was the list.
An auditor given my hypotheses verifies my hypotheses and is structurally blind
to everything I did not think to ask.

**Therefore the brief is fixed.** The text below is used verbatim for every
sweep PR. The diff is the only variable input. I do not add a summary, a list of
things to check, or an explanation of what the PR was trying to do — authoring a
per-PR brief would reintroduce exactly the failure this gate exists to avoid.

> You are reviewing a diff from a documentation deletion sweep. Its stated
> intent is to remove text that (a) restates a `CORE-*` rule from
> `docs/NON_NEGOTIABLES.md`, (b) describes what a script, hook, or gate already
> does, or (c) is a code example — while keeping recorded decisions: choices
> this project made that could not be re-derived from the code.
>
> Read the diff cold. Do not assume the intent was achieved. Report:
>
> 1. Anything deleted that is a decision — a choice with a rationale that exists
>    nowhere else in the repo. Check before claiming it survives elsewhere.
> 2. Any added line that asserts something new, rather than pointing at an
>    existing source. Deletion cannot introduce a false claim; addition can.
> 3. Any pointer that does not answer the question the deleted text answered. A
>    pointer is only correct if the thing it points at addresses the same
>    question, not a broader or narrower one.
> 4. Anything the diff claims about a script, config, or source file that is not
>    true of that file. Read the file.
>
> Verify against the repo. Report findings with file and line. If you find
> nothing, say so — do not manufacture findings.

Items 3 and 4 encode the two limits on "cite the source instead of restating it"
that PR #1793 surfaced: an imprecise pointer (the `ignores` array answered "what
does this rule skip", not "what may write raw palette"), and a doc describing
mechanism it does not own (three separate passages asserted their own
enforcement falsely, and no lint could catch that because the false claim was
the comment, not the code). These are general failure modes, not claims about
any specific PR — equipping the reviewer, not priming it.

Findings are fixed before push. Copilot is then requested once, on finished
work.

**Plus my own source re-read.** Separately from the subagent, I re-read the
actual source files behind every claim that survives in the diff — not my own
diff, the files it describes. This is the reviewer's item 4 done a second time
by the person most likely to have gotten it wrong. It is what I skipped on
PR #1793 twice: the `§12` picker rule and `assertNoHorizontalOverflow` were both
"corrected" from memory of a comment rather than from the file, and both
overshot into false negations. Re-reading the diff is not a substitute — I know
what I meant by it. Re-reading the source is.

### What the cold-read gate does not cover

**Routing loss.** A skill's `description` frontmatter is the sole routing
signal; losing a distinctive term is silent capability loss. PR #1769 (PR 4)
shipped exactly this regression. Live evidence: during this design session the
harness surfaced 6 of 15 skills based on conversation relevance —
`design-bible`, `huddle`, `orchestrator`, `pr-workflow`, `superpowers-bridge`,
`ui` — and did not offer `pinpoint-security` or `pinpoint-typescript`. A
description is what decides whether a skill exists as far as an agent is
concerned.

Mitigation: **each sweep PR re-derives its own skill's description** from what
survives — the body changed, so the description must too. This is the one
sanctioned exception to the no-rewriting rule, and it is reviewed as new prose.
Each such PR enumerates the terms it drops and where they land. PR 9 is the
cross-skill closing pass.

_Decision: no description lint._ Considered and rejected under the same rule as
the semantic diff gate — a terms-appear-in-body heuristic fights legitimately
abstract phrasing and needs its own escape hatch. Descriptions are handled by
review.

**Broken citations.** Plain `rg` skips dot-directories (`.agents/`, `.claude/`),
so a sweep without `--hidden` exits clean while the reference is live. Every
file deletion gets a `--hidden` inbound-link check.

### Review

Copilot, requested once per PR after iteration has stopped. As of #1792 there is
no free PR-open review — it is fully request-only every time, so the request is
deliberate. `commit_id` must equal `headRefOid`.

The prior three-auditor gate is **dropped**. Measured on PR #1793: three
targeted auditors, each handed a list of claims derived from my own analysis,
found 0 of 8 real defects; Copilot, reading the diff cold with no list, found
8 of 8. Auditors given my hypotheses verify my hypotheses. The replacement is
the cold-read gate above: a reviewer with no list, run locally before push, plus
a source re-read by the lead. Copilot then reviews finished work once.

## Success criteria

- In-scope corpus reduced by 3,500–4,500 lines.
- Every sweep PR passes a cold-read subagent review (fixed brief, diff-only
  input) before push, with findings fixed rather than argued.
- Every claim surviving in a sweep PR's diff is re-read against its source file
  by the lead, not just against the diff.
- No `CORE-*` rule loses its only statement.
- No skill loses a routing term without that term landing somewhere named.
- No file is deleted while an inbound reference to it survives (checked with
  `--hidden`).
- `pnpm run check` green on each PR.
- PP-ojv5 closed.
