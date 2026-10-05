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
- **Machine statuses are a separate system.** The machine list's filters
  (`src/components/machines/view/machine-filters.ts`) filter on computed
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
  not user IDs — CORE-SEC-006). It is **not** in the machine list's filters,
  whose Owner filter offers "Me" (the `me` sentinel, resolved per viewer on the
  server) — a plausible wrong turn.

## Mobile vs desktop

- **One responsive component per surface — no separate mobile component.**
  `MobileFilterBar` was deliberately abandoned; don't reintroduce a parallel
  mobile filter tree.
- **CSS-only responsiveness.** Both bars adapt with Tailwind utilities —
  viewport breakpoints (`md:`, 768px, is the mobile/desktop pivot). The List
  View measures its own controls with `ResizeObserver` only to decide which
  filters move into More (the CORE-RESP-002 boundary). The filter bars use
  no JavaScript
  viewport detection (`useMediaQuery` / `matchMedia`) — the design-bible §4
  responsive rule (which sanctions only a couple of narrow exceptions elsewhere
  in the app), and exactly why a re-styling-only `MobileFilterBar` was rejected.
- **Removal ✕ is always visible on every chip.** Touch has no hover, so
  removal affordances are never hover-revealed.
- **Issues: chips wrap on their own row below the search input** at every
  viewport (chips overlaid on the input spilled off-screen on narrow
  viewports). The List View has no chip row: each filter control shows its
  own value (list-views §3.3).

## Current state (unification)

Machines is on the shared List View (`src/components/list-view/`,
`src/lib/list-view/`; spec `docs/feature-specs/list-views.md`): the host builds
filter, sort, view, and pager models and List View renders the toolbar, List
Header, phone sheets, and pagers. Issues still uses `IssueFilters` with
`MultiSelect`, the `useSearchFilters` hook, and the `filter-utils.ts` helpers
until **PP-jb9v** moves it onto List View too (absorbing PP-zpje's shared
filter bar). New list filter work belongs in List View's models, not a fork.
