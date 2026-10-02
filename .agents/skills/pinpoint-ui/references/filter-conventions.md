# Filter-Bar Conventions

The canonical conventions for the list-page filter bars (issues and machines).
Read this before adding or changing a filter, a status/quick-select chip, or the
responsive behavior of a filter bar. For the file-by-file registry and the
label-string rules, see `key-files.md` (§ Status & Filter System, § Label
Standards) — this file is the "how it works and why", not a second copy of the
registry.

## Status model (issues)

- **Single source of truth: `src/lib/issues/status.ts`.** The 11 issue statuses,
  their labels, colors, icons, and descriptions all live in `STATUS_CONFIG`.
  Never freestyle a status label or color at a call site — read it from the
  config (`getIssueStatusLabel`, `STATUS_CONFIG[status].styles`, …).
- **Three groups, via `STATUS_GROUPS`:** `new`, `in_progress`, `closed`.
  `STATUS_GROUP_LABELS` maps each to a display name — note the deliberate
  mismatch: the `new` group **displays as "Open"** (Phase-2 label-consistency
  decision; don't relitigate it). The convenience sets `OPEN_STATUSES`
  (new + in_progress = all 6 non-closed), `NEW_STATUSES`, `IN_PROGRESS_STATUSES`,
  `CLOSED_STATUSES` are derived from the same source.
- **Default issue view = `OPEN_STATUSES`.** When no status filter is set,
  `IssueFilters` renders two default chips, "Open" and "In Progress".
- **Machine statuses are a separate system.** The machine list toolbar
  (`src/components/machines/view/MachineViewToolbar.tsx`) filters on computed
  machine status (`src/lib/machines/status.ts` — machines have no
  status column) plus presence (`src/lib/machines/presence.ts`), with labels
  from `getMachineStatusLabel` / `getMachinePresenceLabel`. Don't reach for
  `STATUS_CONFIG` on the machines side.

## Smart-badge grouping

The rule the bar follows: **when every status in a group is selected, show one
group chip** ("Open" / "In Progress" / "Closed") instead of the individual
status chips; any status not covered by a fully-selected group gets its own chip.

- **The one implementation is inline** in `IssueFilters.tsx`'s `getBadges()`.
  It emits multiple individually-removable chips, each with an always-visible ✕.
  When a shared filter bar needs the rule (see § Current state), move this one
  rather than writing a second grouping implementation.

## Quick-selects

Two current-user quick-selects exist. Their exact label strings ("Me",
"My machines") and the reuse-these-strings rule are owned by `key-files.md`
§ Label Standards; this section covers the **wiring**.

- **"Me"** (and "Unassigned", a sentinel) — injected as the first options of the
  Assignee and Reporter dropdowns by `getAssigneeOrdering` in `filter-utils.ts`.
  Omitted when there is no current user. These are _not_ rendered via
  `quickSelectActions`.
- **"My machines"** — the only live use of the `MultiSelect` `quickSelectActions`
  prop. It filters **issues** by the machines the current user owns, so it lives
  on the **issues** side: `IssueFilters` builds it from an `ownedMachineInitials`
  prop that `src/app/(app)/issues/page.tsx` resolves server-side (initials only,
  not user IDs — CORE-SEC-006). It is **not** in the machine list toolbar,
  which has no owner-of-mine logic — a plausible wrong turn.

## Mobile vs desktop

- **One responsive component per surface — no separate mobile component.**
  `MobileFilterBar` was deliberately abandoned; don't reintroduce a parallel
  mobile filter tree.
- **CSS-only responsiveness.** Both bars adapt with Tailwind utilities —
  viewport breakpoints (`md:`, 768px, is the mobile/desktop pivot), plus
  container queries for the machine toolbar's filter grid. The filter bars use
  no JavaScript
  viewport detection (`useMediaQuery` / `matchMedia`) — the design-bible §4
  responsive rule (which sanctions only a couple of narrow exceptions elsewhere
  in the app), and exactly why a re-styling-only `MobileFilterBar` was rejected.
- **Removal ✕ is always visible on every chip.** Touch has no hover, so
  removal affordances are never hover-revealed.
- **Chips wrap on their own row below the search input** at every viewport,
  on both surfaces (chips overlaid on the input spilled off-screen on narrow
  viewports). The machine toolbar labels that row as an "Active filters"
  region and adds a search chip and a Clear all action.

## Current state (unification)

`IssueFilters` and `MachineViewToolbar` are **separate components today**. They
share only `MultiSelect` (`src/components/ui/multi-select.tsx`). Each side keeps
its own URL state: issues use the `useSearchFilters` hook and the
`filter-utils.ts` helpers; machines use `src/lib/machines/view/state.ts`.

**PP-jb9v** puts both lists on one shared List View (spec:
`docs/feature-specs/list-views.md`), absorbing PP-zpje's shared filter bar.
Until that lands, keep new filter work consistent with the surface it's on and
build on the primitives above rather than forking new ones.
