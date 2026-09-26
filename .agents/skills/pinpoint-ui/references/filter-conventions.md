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
- **Machine statuses are a separate system.** `MachineFilters` filters on
  computed machine status (`src/lib/machines/status.ts` — machines have no
  status column) plus presence (`src/lib/machines/presence.ts`), with labels
  from `getMachineStatusLabel` / `getMachinePresenceLabel`. Don't reach for
  `STATUS_CONFIG` on the machines side.

## Smart-badge grouping

The rule the bar follows: **when every status in a group is selected, show one
group chip** ("Open" / "In Progress" / "Closed") instead of the individual
status chips; any status not covered by a fully-selected group gets its own chip.

- **The live implementation is inline** in `IssueFilters.tsx`'s `getBadges()`.
  It emits multiple individually-removable chips, each with an always-visible ✕.
- **`getSmartBadgeLabel` in `filter-utils.ts` is a different shape and is
  currently unused.** It collapses a selection to a _single_ summary label; it
  was written for the abandoned mobile filter bar and no production surface
  imports it. Don't assume it drives anything today. When a shared filter bar
  finally needs one summary label (see § Current state), reconcile the two
  rather than adding a third grouping implementation.

## Quick-selects

Two current-user quick-selects exist, with **fixed label strings** — reuse them
exactly, never invent "Mine" / "My games":

- **"Me"** (and "Unassigned", a sentinel) — injected as the first options of the
  Assignee and Reporter dropdowns by `getAssigneeOrdering` in `filter-utils.ts`.
  Omitted when there is no current user. These are _not_ rendered via
  `quickSelectActions`.
- **"My machines"** — the only live use of the `MultiSelect` `quickSelectActions`
  prop. It filters **issues** by the machines the current user owns, so it lives
  on the **issues** side: `IssueFilters` builds it from an `ownedMachineInitials`
  prop that `src/app/(app)/issues/page.tsx` resolves server-side (initials only,
  not user IDs — CORE-SEC-006). It is **not** in `MachineFilters`, which has no
  owner-of-mine logic — a plausible wrong turn. `getMachineQuickSelectOrdering`
  in `filter-utils.ts` also produces a "My machines" item and has tests, but
  nothing in production calls it (PP-nri8) — don't mistake it for the live path.

## Mobile vs desktop

- **One responsive component per surface — no separate mobile component.**
  `MobileFilterBar` was deliberately abandoned; don't reintroduce a parallel
  mobile filter tree. (The orphaned `getSmartBadgeLabel` /
  `getMachineQuickSelectOrdering` helpers are leftovers from it.)
- **CSS-only responsiveness.** Both bars adapt with Tailwind viewport utilities;
  `md:` (768px) is the mobile/desktop pivot. No JavaScript viewport detection
  (`useMediaQuery` / `matchMedia`) — this is the design-bible §4 responsive rule,
  and it is exactly why a re-styling-only `MobileFilterBar` was rejected.
- **Chips wrap and keep an always-visible ✕.** Touch has no hover, and narrow
  viewports can't spill the chip row off-screen — so removal affordances are
  always shown, not hover-revealed.

## Current state (unification)

`IssueFilters` and `MachineFilters` are **separate components today** and diverge
on purpose-of-record: card panel + chip row below vs. pill search + inline
badges + a sort dropdown. They share only the lower-level primitives —
`MultiSelect` (`src/components/ui/multi-select.tsx`), the `useSearchFilters`
URL-param sync hook, and (issues only) the `filter-utils.ts` helpers.

**PP-zpje** tracks standardizing them into a shared filter-bar composite. Until
that lands, keep new filter work consistent with the surface it's on and build on
the shared primitives above rather than forking new ones.
