# Design System Implementation Design

## Problem

PinPoint has high-fidelity mobile mockups and a desktop app at ~70% design alignment. The gap:
mobile needs to be built from mockups, desktop needs Phase 2 improvements (from
`docs/design-consistency/`), and there's no systematic way for AI agents to discover and follow
UI patterns — leading to inconsistent output across parallel agent work.

Existing pattern docs (`docs/ui-patterns/`) are stale. Agents generate incorrect components when
they rely on outdated documentation instead of reading actual source code.

## Philosophy: Code-First Pattern Discovery

Inspired by how shadcn/ui registries and Vercel's v0 work: **components are the spec, not
separate docs**. Agents discover patterns by reading source files, guided by skills that act as
an index.

Three layers:

1. **Discovery Layer** — `pinpoint-ui` skill points agents to canonical source files
2. **Token Layer** — CSS variables, Tailwind theme, `STATUS_CONFIG` as visual truth
3. **Component Layer** — Well-structured source with JSDoc on key patterns

This replaces the traditional "write a design system doc" approach with one that can't go stale —
the code IS the documentation.

## Phase Structure (Phase-Gated Orchestration)

An orchestrator agent manages parallel work within each phase, gating on user approval between
phases. Existing Claude Code hooks enforce quality (`TaskCompleted` → `pnpm run check`,
`TeammateIdle` → blocks if uncommitted changes).

### Phase 1: Component Prep — "Make the Code Self-Describing"

**Goal:** Ensure existing components are clear enough that any agent can read them and follow
the patterns. This is the foundation all subsequent phases depend on.

| Task                     | What                                                                                              | Key Files                                                                                                                 |
| :----------------------- | :------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------ |
| Update pinpoint-ui skill | Add "Key Files" registry section listing canonical pattern files with brief descriptions of each  | `.agent/skills/pinpoint-ui/SKILL.md`                                                                                      |
| JSDoc key components     | Add JSDoc to ~6 domain components explaining their pattern, composition, and key abstractions     | `IssueFilters.tsx`, `StatusSelect.tsx`, `AssigneePicker.tsx`, `MachineFilters.tsx`, `multi-select.tsx`, `OwnerSelect.tsx` |
| Audit CSS tokens         | Ensure STATUS_CONFIG colors reference Tailwind tokens, document color system in pinpoint-ui skill | `globals.css`, `status.ts`                                                                                                |
| Delete stale docs        | Remove `docs/ui-patterns/` — replaced by code-first approach                                      | `docs/ui-patterns/`                                                                                                       |

**Parallelism:** All 4 tasks are independent. 2-3 agents in worktrees.

### Phase 2: Desktop Improvements

**Goal:** Bring desktop to 100% alignment with `docs/design-consistency/` spec.

| Task                  | What                                                                                       | Key Files                                                  |
| :-------------------- | :----------------------------------------------------------------------------------------- | :--------------------------------------------------------- |
| "Me" quick-select     | Add current-user shortcut to top of AssigneePicker (Me → Unassigned → divider → all users) | `AssigneePicker.tsx`, tests                                |
| "My machines" filter  | Add owner quick-toggle to MachineFilters with indeterminate state support                  | `MachineFilters.tsx`, tests                                |
| Group label update    | Rename "New" → "Open" in status group display labels                                       | `status.ts`, `StatusSelect.tsx`, `IssueFilters.tsx`, tests |
| Quick-select ordering | Standardize all pickers: personal shortcut → special values → divider → alphabetical list  | `AssigneePicker.tsx`, `MachineFilters.tsx`                 |

**Parallelism:** "Me", "My machines", and group labels are independent. Quick-select ordering
depends on the first two completing.

**Dependencies:** Phase 1 must complete first (agents need the updated skill to find patterns).

### Phase 3: Mobile Implementation

**Goal:** Build mobile views from the HTML mockups, using the now-well-documented desktop
components as pattern source.

| Task                | What                                                                     | Key Files                       |
| :------------------ | :----------------------------------------------------------------------- | :------------------------------ |
| Mobile filter bar   | Port filter pattern from desktop, adapted for mobile chip UI per mockup  | New mobile filter component     |
| Mobile issue list   | Responsive card layout matching `mockup-issues-list.html`                | New mobile issue list component |
| Mobile issue detail | Detail view with timeline, status updates per `mockup-issue-detail.html` | New mobile detail component     |
| Mobile navigation   | Bottom nav / drawer patterns per mockup                                  | Layout components               |

**Parallelism:** Filter bar, issue list, and navigation are independent. Detail view may depend
on list item patterns.

**Dependencies:** Phase 2 must complete first (desktop components are the pattern source, and
they need to be finalized before mobile ports them).

### Phase 4: E2E Tests

**Goal:** Verify new features across desktop and mobile viewports.

| Task                | What                                                                                                     | Key Files                             |
| :------------------ | :------------------------------------------------------------------------------------------------------- | :------------------------------------ |
| Desktop E2E         | Test "Me" filter, "My machines", group labels, quick-select ordering                                     | New spec files in `e2e/`              |
| Mobile E2E          | Test mobile filter bar, issue list, responsive behavior                                                  | New spec files in `e2e/`              |
| Mobile E2E strategy | Add mobile-specific testing guidance to `pinpoint-e2e` skill (what to test per viewport, touch patterns) | `.agent/skills/pinpoint-e2e/SKILL.md` |

**Parallelism:** All three are independent.

**Dependencies:** Phases 2 and 3 must complete (need features to test). Strategy doc could start
earlier but benefits from seeing the actual implementation.

**Existing infrastructure:** Playwright already has 4 browser projects (Desktop Chrome/Firefox,
Mobile Chrome/Safari), smart helpers with `testInfo.project.name` mobile detection, and
`openSidebarIfMobile()` / `selectOption()` patterns. The gap is consistent strategy, not
infrastructure.

## Side Task: Documentation Consolidation

Separate from the main phases — a standalone bead for independent exploration:

- Audit all `docs/` and `.agent/skills/` for stale content beyond UI
- Consolidate `UI_GUIDE.md` into `pinpoint-ui` skill (single source of truth)
- Apply code-first philosophy to non-UI patterns (server actions, data fetching)
- Consider whether `docs/design-consistency/` should be archived after implementation

## Orchestrator Design

Uses **Agent Teams** (per `pinpoint-orchestrator` skill):

1. Creates beads epic with phase sub-epics and individual task beads
2. Creates worktrees via `pinpoint-wt.py` for parallel agents
3. Dispatches teammates with absolute worktree paths and task contracts
4. Each task contract includes: "Load `pinpoint-ui` skill first" and "Run `pnpm run check`
   before completing"
5. Gates between phases — reports summary to user, waits for approval
6. Existing hooks provide automatic quality enforcement

## What Gets Deleted

- `docs/ui-patterns/` (4 files — stale, replaced by code-first approach)
- Eventually `docs/design-consistency/` (after implementation completes — becomes historical)

## What Gets Created

- Updated `pinpoint-ui` SKILL.md with Key Files registry
- JSDoc on ~6 key domain components
- Mobile components (Phase 3)
- E2E test specs (Phase 4)
- Mobile E2E strategy in `pinpoint-e2e` skill
- Beads epic with full task breakdown

## Success Criteria

1. Any agent loading `pinpoint-ui` skill can find and follow all UI patterns without
   additional guidance
2. Desktop matches `docs/design-consistency/` spec at 100%
3. Mobile views match HTML mockups
4. E2E coverage for all new features on both desktop and mobile viewports
5. `pnpm run preflight` passes after each phase
