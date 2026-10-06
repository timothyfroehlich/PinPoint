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
- **Default issue view = `OPEN_STATUSES`.** The Issue View Page Preset (Open
  issues) selects them, and the Status filter reads "Open" when exactly they
  are selected (issues-list §4.4). Because "Open" means both groups there, the
  Status filter's group headings say New / In Progress / Closed rather than
  `STATUS_GROUP_LABELS` (`src/components/issues/view/issue-filters.ts`).
- **Machine statuses are a separate system.** The machine list's filters
  (`src/components/machines/view/machine-filters.ts`) filter on computed
  machine status (`src/lib/machines/status.ts` — machines have no
  status column) plus presence (`src/lib/machines/presence.ts`), with labels
  from `getMachineStatusLabel` / `getMachinePresenceLabel`. Don't reach for
  `STATUS_CONFIG` on the machines side.

## Option groups

A List View filter option may carry a `group`: options of one group list
together under a heading checkbox that selects or clears the whole group,
mixed when only some are selected (`src/components/list-view/FilterPicker.tsx`).
The Issues Status filter is the one user. No filter shows chips: each control
shows its own value (list-views §3.3).

## Quick-selects

Two current-user quick-selects exist. Their exact label strings ("Me",
"My machines") and the reuse-these-strings rule are owned by `key-files.md`
§ Label Standards; this section covers the **wiring**.

- **"Me"** (and "Unassigned") — the `me` and `unassigned` sentinels
  (`src/lib/list-view/url-state.ts`), offered as filter `shortcuts` above the
  people. `me` is resolved per viewer on the server, so one URL or Saved View
  means each person's own; it is offered only to signed-in people.
- **"My machines"** — a shortcut that stands for several values (`values` on
  the option): checking it adds every machine the viewer owns. It filters
  **issues**, so it lives on the issues side (`issue-filters.ts`), built from
  `IssueViewResult.myMachines`, which `loadIssueView` resolves server-side
  (initials only, not user IDs — CORE-SEC-006). It is **not** in the machine
  list's filters, whose Owner filter offers "Me" — a plausible wrong turn.

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
- **Reset is always reachable.** Every filter's options offer Reset at every
  width (list-views §4.9); touch has no hover, so it is never hover-revealed.

## Current state (unification)

Machines and Issues are both on the shared List View
(`src/components/list-view/`, `src/lib/list-view/`; spec
`docs/feature-specs/list-views.md`): each host builds filter, sort, view, and
pager models (`machine-filters.ts`, `issue-filters.ts`) and List View renders
the toolbar, List Header, phone sheets, and pagers; `useListViewHost` owns the
URL, Applied View, and Saved View plumbing. New list filter work belongs in
List View's models, not a fork.
