---
name: pinpoint-prototype-mode
description: Opt-in rapid-iteration mode for PinPoint UI/UX prototyping inside the real app under /prototype. Reuse existing routes, components, tokens, types, loaders, and seed data before creating disposable adapters or typed fixtures. Defers selected presentational lint/test/type cleanup while tracking debt, but never relaxes auth, permissions, privacy, accessibility, semantic colors, TypeScript safety, or correctness. Prototype routes stay local and uncommitted and are deleted before normal development resumes. Use when Tim explicitly asks for prototype mode, rapid iteration, a disposable UI exploration, or to exit/make real an active prototype.
---

# PinPoint Prototype Mode

Prototype mode is a deliberately entered and exited workflow for answering one
UI/UX design question quickly **inside the real PinPoint application**. Build
disposable screens at `/prototype/<slug>`, using the real shell and as much
production code as possible so the result stays visually and behaviorally
accurate.

The permanent `src/app/(dev)/prototype/layout.tsx` is tooling. Everything under
its child directories is disposable, ignored by Git, and blocked from checks
and commits until removed. Do not introduce a separate Vite app or Figma board;
Figma is off by default unless Tim explicitly requests it again.

## Boundary

- **In scope:** page composition, layout, components, styling, responsive
  behavior, copy, visible states, and core interaction flow.
- **Out of scope:** new data access, queries, writes, Server Actions, API routes,
  migrations, auth or permission shortcuts, secrets, and production behavior.
- **Local only:** no commit, push, draft PR, preview deployment, or production
  access while `.prototype-mode` exists or a disposable prototype route remains.

If the design needs new backend behavior, stub that boundary with typed fixture
data and record the need in the ledger. Build the backend only after exiting
prototype mode under normal rigor.

## Enter only on request

Never self-elect into this mode. Enter only when Tim explicitly asks for
"prototype mode", "rapid iteration", "just explore", or equivalent UI/UX
exploration. Before editing, ensure the work has a Bead and is in an isolated
worktree.

Concurrent prototypes require separate isolated worktrees. The marker and
cleanup guard intentionally apply to the whole worktree, so one prototype must
not share a worktree with another task that needs to check or commit.

1. Announce that prototype mode is active, local-only, and debt-tracked.
2. Create `.prototype-mode` at the worktree root from the template below.
3. Fill every header and complete the reuse inventory before coding.

```markdown
# Prototype mode — entered <ISO date/time>

Bead: <PP-id>
Design question: <the single question this prototype should answer>
Source route: <existing PinPoint route, external URL, or "new screen">
Visual target: <captured source, selected option, and state>
Prototype slug: <kebab-case slug>
Prototype URL: /prototype/<slug>
Data mode: <seed record | existing local fixture | existing read-only loader | typed fixture>

## Reuse inventory

- Nearest production route:
- Shell/layout:
- Shared components:
- Semantic tokens:
- Icons/assets:
- Domain types:
- Domain logic/copy contracts:
- Existing loaders:
- Seeded records:

## States to compare

- <representative state needed to answer the design question>

## Evidence

- Before — desktop: <state, data/fixture, viewport, chrome mode>
- Before — 390×844: <state, data/fixture, viewport, chrome mode>
- Comparisons: <source and rendered evidence at matching state/viewport>

## Prototype-only controls

- (none)

## Debt ledger

- [ ] (nothing skipped yet)
```

## Ground the visual target first

Use Product Design for visual grounding and QA, while PinPoint remains the
runtime:

- For an existing screen, capture its relevant state with the browser-control
  capability available in the active agent environment at desktop and
  `390×844` **before changing it**. Record both captures.
- For a live URL, use `product-design:url-to-code`'s source-capture and visual
  comparison discipline only. Do not initialize its standalone app, copy an
  asset tree, or pursue exhaustive clone fidelity unless Tim separately asks.
- For a new screen with no visual target, load `product-design:index`, route to
  ideation, generate **exactly three** visual options, and wait for Tim to pick
  one before coding.
- In Codex Desktop, use the in-app browser. In another agent environment, use
  that environment's supported interactive browser capability. If more than one
  browser is available, keep using the one Tim already chose or ask him to
  choose. Do not fall back to the Playwright CLI or another browser behind his
  back; if the environment has no browser-control capability, stop and ask.
- `/dev/preview` fixes the mobile width at 390px, not its height. Use a direct
  browser viewport for the exact `390×844` capture and record whether preview
  chrome is visible or hidden.

## Reuse before writing

Inspect the nearest production route and complete the marker's reuse inventory.
Use this order:

1. Existing production components unchanged.
2. Existing components composed differently.
3. Small production-component generalizations that will remain useful after
   the prototype and can be hardened on exit.
4. Thin prototype-only adapters and colocated typed fixtures.

For an external destination surface such as a Discord card, reuse PinPoint's
domain payloads, copy, types, formatters, and assets first. Do not force PinPoint
app components or tokens to imitate platform chrome inaccurately. A thin
prototype-only renderer for that external surface is appropriate when the
ledger names the production components considered and explains the mismatch.

Before duplicating a production component or rebuilding an existing interaction,
add a ledger item that names the original and explains why reuse cannot answer
the design question. Prototype speed is not a reason to drift from the product.

Inventory the domain formatting and copy contracts plus the representative
states needed to answer the question before choosing data. Prefer established
local seed records or existing local fixtures, then existing read-only loaders.
If none fits, colocate typed fixture data with the disposable route. Never copy
production data. Never weaken auth or privacy rules to make a loader convenient.

## Build and iterate

Create only `src/app/(dev)/prototype/<slug>/...`. The parent layouts provide the
real PinPoint shell. Keep fixture data inside that disposable directory.

Iterate in both places:

- the actual `/prototype/<slug>` route for the full shell and interactions;
- `/dev/preview?path=/prototype/<slug>` for desktop/mobile comparison.

The primary navigation, controls, inputs, selections, and state changes needed
to answer the design question must work. A peripheral control may be visual-only
only when it is named under `Prototype-only controls` in the ledger.

At each decision point, capture the rendered prototype at the same viewport and
state as its selected source. Put the source and rendered capture together in
one comparison input, inspect visible differences, fix relevant mismatches, and
compare again. A screenshot alone is not a comparison.

## What is relaxed

During the visual loop:

- Defer `check`, preflight, tests, coverage, and unrelated cleanup until exit.
- Log skipped tests, type work, lint work, duplication, and visual-only controls
  as concrete debt checkboxes.
- Disposable prototype files have narrowly scoped Oxlint relief for unused
  variables, explicit return types, type-only import formatting, unnecessary
  conditions, and non-blocking promise-style warnings.

TypeScript still compiles prototype pages when Next renders them; the config does
not exclude the route from type checking.

## What is never relaxed

- No commit, push, PR, or deployment while the mode or disposable route exists.
- No production data, secrets, database, or external writes.
- No new backend behavior, Server Actions, migrations, auth shortcuts, or
  permission shortcuts.
- No deleting, weakening, or bypassing an existing test.
- Keep React Hooks and accessibility rules, semantic color tokens, `~/` path
  aliases, safe types, non-null safety, privacy, and correctness rules.
- Keep `localhost` rather than `127.0.0.1` for browser-facing local URLs
  (CORE-SEC-008).

## Exit or make it real

Exit when Tim says "exit prototype mode", "make this real", "land it", or asks
for a commit/PR.

1. Read the marker and turn every ledger item into an explicit cleanup task.
2. Retain only useful production-component changes, harden them under normal
   PinPoint rigor, and implement the chosen direction at the real destination
   route if requested.
3. Delete the entire `src/app/(dev)/prototype/<slug>` directory, including its
   fixtures. Never delete the permanent parent `layout.tsx`.
4. Record the chosen direction, reusable changes, and remaining implementation
   scope in the Bead.
5. Repay the ledger, then remove `.prototype-mode`.
6. Run `pnpm run check:prototype-clean`, the tests appropriate to the retained
   production changes, and the normal PinPoint checks.
7. Verify the real destination route in the browser at desktop and `390×844`.

Do not silently discard the ledger. If Tim abandons the design, confirm that
choice, delete the disposable route, record the decision in the Bead, and then
remove the marker.
