---
name: spec-driven-development
description: How PinPoint feature specs work — the living, requirements-only documents in docs/feature-specs/ that are the intended truth for a feature, kept in sync with code through an explicit divergence table. Carries the format (numbered citable requirements, [shipped]/[designed] tags, a Concepts section, retired-number tombstones), the lifecycle rules (the spec changes alongside any design decision; code-vs-spec disagreement always resolves by amending one, never silently neither), and the hard editing rule — a feature spec is NEVER edited without Tim approving the exact diff first, even when he says "update the spec". Use when designing or changing a feature that has a spec, when starting substantial new feature design (offer to create one), when a review or bead needs to cite a requirement, when deciding whether something belongs in a spec versus a design record or the design bible, or when Tim says "spec", "feature spec", or "spec-driven".
---

# Spec-Driven Development

A feature spec is the requirements for one feature: what the system does and
what users can do. It lives in `docs/feature-specs/<feature>.md`, it is
**living** (edited in place as the design evolves), and it is the **intended
truth** — when code and spec disagree, either the code is wrong or the spec
gets amended, never silently neither.

The exemplar is [docs/feature-specs/pinballmap.md](../../../docs/feature-specs/pinballmap.md),
written during the PP-o355.21 redesign (2026-08-15/16). Read it before
writing a new spec.

## The hard rule: no unapproved edits

**Never edit a feature spec without Tim approving the exact diff first —
even when he says "update the spec."** Propose the change as a literal
before/after diff in chat, wait for approval, then write. Tim's words
(2026-08-16): "this is a document that I need to know the contents of at all
times… I need exact diffs for changes to the spec."

This is the one place the usual proactive-edit posture inverts. Mockups,
beads, and scratch documents you edit freely; the spec is Tim's document
that you maintain.

## What goes in a spec (and what doesn't)

| In                                                                  | Out                                                 |
| :------------------------------------------------------------------ | :-------------------------------------------------- |
| Behavioral requirements ("the control offers…", "PinPoint never…")  | File paths, function names, schema, component names |
| User-facing vocabulary decisions (which words appear in copy)       | Copy strings themselves (mockups own exact strings) |
| Verified external facts the design depends on, **dated**            | Speculation about external services                 |
| Permission tiers as capabilities ("the machine-linking capability") | Role/matrix implementation                          |
| What is blocked vs allowed vs flagged                               | How the blocking is implemented                     |

Boundaries with the other document kinds:

- **Superpowers specs and plans** are working documents: drafted outside
  the repo (session scratchpad), stored in the bead, never committed
  (decision 2026-08-16; files under `docs/superpowers/` committed earlier
  stay as records). A feature spec is the opposite: always current, checked
  in, never archival.
- **`pinpoint-design-bible`** owns cross-feature design-system rules (page
  archetypes, copy register, severity vocabulary). A feature spec cites it
  rather than restating it.
- **`docs/NON_NEGOTIABLES.md`** owns enforced implementation rules. A spec
  may point at one (CORE-PBM-001) but never duplicates its text.
- **Beads** carry pointers to the spec plus work state — never copies of
  requirements.

## Format

Every spec has, in order:

1. **Preamble** — "what this document is," the amend-or-fix contract, and
   the status-tag legend.
2. **Status tags** — `[shipped]` (implemented, in production behavior) and
   `[designed]` (agreed, not built). Tags sit on sections or individual
   requirements; untagged requirements inherit the section tag.
3. **Related records** — sibling documents and beads, one line.
4. **Concepts (§1)** — the feature's nouns, each with one owner and one
   subject, stated as independent facts. Getting these right is most of the
   work: a concept that bundles two facts (the original "Listing" bundled
   intent, observation, and attribution) will distort every requirement
   built on it. When a concept dies, say what replaced it and when.
5. **Numbered requirement sections** — one sentence per requirement where
   possible, each citable as `§4.6`.
6. **Known divergences table** — every place code and spec disagree, mapped
   to its resolution (a bead, a PR, a decision). This table is the
   conformance work-queue: it must shrink to empty, or the spec gets
   amended. A divergence that lives in the table is honest; one that
   doesn't is a lie in the spec. Rows are a todo list — one line each,
   what disagrees and where it resolves — not detailed writeups.
   Because the table lives in the spec, adding or changing a row goes
   through the diff-approval rule: Tim sees every divergence before it
   is recorded.

Rules that keep citations stable:

- **Numbers are never reused.** A retired requirement keeps its number with
  a tombstone ("_Retired 2026-08-16._ …existed only to serve X, which 5.1
  now forbids. Number kept so older citations don't dangle.").
- **External facts carry their verification date and a re-verify caveat**
  ("verified against Pinball Map's source, 2026-08-15… hardcoded on their
  side and may change"). An undated external fact is a future confident
  wrong answer.
- **Fact-check examples before they harden.** A wrong example propagates
  into beads and mockups (Bordertown was described as a homebrew; it is a
  1940 game — the error had already spread by the time it was caught).

## Lifecycle

- **A design decision lands in the spec when it is made**, in the same
  conversation — not after the code ships. The spec trails the discussion
  by minutes, not PRs. (Subject to the diff-approval rule above: propose
  immediately, write on approval.)
- **When starting work on a bead that points at a spec, validate them
  against each other first.** If the bead asks for something the spec
  doesn't say — and you don't see a clear reason for the difference in your
  session history — surface it to Tim before writing code; don't silently
  pick a side. The same check applies when resuming a superpowers spec or
  plan.
- **When code changes behavior covered by a spec**, the same PR updates the
  spec or adds a divergence row. `pnpm run check` will not catch this;
  review has to — see `REVIEW.md` "Spec conformance" for what the reviewer
  checks.
- **Creating a spec is Tim's call.** He says when he wants one, or approves
  your suggestion — suggest one when substantial new feature design starts,
  but never create the file unprompted (a new spec is itself a spec edit
  under the hard rule). Small fixes and mechanical changes don't need one.
- **Feature specs always use this skill's format.** Content graduating from
  a superpowers brainstorm gets rewritten into it — never import the
  superpowers spec format or promote a superpowers doc as-is.
- **When touching a feature that has a spec, read the spec first** — it is
  the fastest correct summary of intended behavior, and the divergence
  table tells you which parts the code doesn't yet implement.
- **Reviews and beads cite requirement numbers** (`spec 4.6`, `violates
5.1`) rather than paraphrasing, so disagreements are about the written
  requirement, not a recollection of it.
- **A biweekly cloud routine audits every spec against the code** (1st and
  15th, "Biweekly Spec Conformance Audit"). When they disagree it files one
  P0 `spec-conformance` bead per spec — a decide-bead, resolved by a human
  as either a code-change bead at a reasonable priority or a spec-update PR
  (which still goes through the diff-approval rule). The routine itself
  never edits code or specs.

## Writing requirements well

- State behavior, not mechanism: "the control offers a push action that
  makes the lineup match the intent" — not which action function runs.
- One requirement per number; split compound sentences.
- Name the actor: "PinPoint never…", "a person can…", "the control shows…".
- Negative requirements are requirements ("PinPoint never changes listing
  intent automatically, in either direction") — often the most load-bearing
  ones, and the easiest to lose in a rebuild.
- When a UI has states, give them canonical names in the spec and reuse
  those names in mockups and code discussion (WAITING, LINGERING, SHARED) —
  a state that can't be named can't be cited.
