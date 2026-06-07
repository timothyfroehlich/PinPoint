# Multi-Machine Collection View — Design

**Date:** 2026-06-06
**Epic:** PP-slrd (v1: PP-slrd.1)
**Status:** Approved design, pre-implementation

## Summary

A new tabbed page type that renders aggregate views over a **set of machines**. v1 ships one collection source — machines owned by a given user — at `/c/owner/[userId]`, with three tabs: Overview (glanceable status table), Issues (combined list), Timeline (combined feed). The view layer is collection-source-agnostic so future sources (machine tags / tournament lists, ad-hoc sets) plug in as new resolvers without touching the tabs.

## Goals

- Owners see the status of all their machines in one place.
- Admins/TDs (and any signed-in user) can view any owner's collection.
- Architecture that makes future tag-based collections (TD tournament lists, PR #1388 settings use case) purely additive.

## Non-goals (v1)

- No machine-tag data model (future, additive: new table + resolver).
- No write actions from the collection page (composer, bulk actions — beaded).
- No changes to per-machine pages.

## Architecture

### The seam: machine-set resolution

A collection descriptor resolves to a list of machines; **every aggregate query takes machine identifiers (ids/initials list), never an owner**. v1 has exactly one resolver: owner → their machines. Adding a collection type later = new resolver + new route; tabs, queries, and components are untouched.

### Routing

`/c/` namespace, mirroring `/m/`:

- `/c/owner/[userId]` — Overview (landing tab)
- `/c/owner/[userId]/issues` — Issues
- `/c/owner/[userId]/timeline` — Timeline

Structure follows `/m/[initials]/(tabs)`: a layout with persistent header + tab strip, server components throughout, cached layout query for header data.

Future: `/c/tag/[slug]` etc. URLs may diverge per source type; they share the collection view components.

### Data layer

- **Overview query:** machines in set + open-issue count + worst open severity + latest timeline event (kind + timestamp) + presence. Derived status via existing `deriveMachineStatus()`.
- **Issues:** existing issues-list query scoped by machine set.
- **Timeline:** `getMachineTimeline` (`src/lib/timeline/machine-events.ts`) gains a machine-set form (`inArray` instead of `eq`); returned rows expose `machineId`/machine identity for attribution. Pagination (offset + N+1 trick) unchanged.

## Tabs

### Overview (landing)

Dense status table, one row per machine, **worst-first default sort**.

Columns: status (dot/badge) · machine (name + initials, links to `/m/[initials]`) · open issues · worst severity · oldest open issue (age of the longest-outstanding open issue; ascending first-click so neglected machines surface) · last activity (relative time + latest timeline event type, e.g. "2h ago — issue reported") · presence.

- **Sortable headers** on every column; `<th scope="col">` + `aria-sort` + accessible names (CORE-A11Y).
- **Column picker** ("Columns" dropdown), persisted in **localStorage** (per-device is acceptable for a display preference; promoting to user prefs later is additive). Status + Machine are un-hideable.
- **Responsive:** column-drop at narrow widths via the `use-table-responsive-columns` pattern (PP-rs9 exception). Drop order: presence, worst severity first; status, machine, open count, last activity survive longest.
- Page header (above tabs) carries the aggregate summary: "8 machines · 5 operational · 2 need service · 1 unplayable · 11 open issues".

### Issues

Reuse of the existing issues list scoped to the collection's machine set. Machine name already renders per row; existing filters (status, severity) included. Tab strip shows an open-count badge (like the machine page Service tab).

### Timeline

Combined chronological feed across the set, reusing the existing row components (`src/components/machines/timeline/MachineTimeline{Comment,Issue,System,Tombstone}Row.tsx`) — they are already machine-agnostic (props-driven, no fetching).

- **Attribution (style "B1"):** a muted machine-name line above each entry, linking to the machine. Implemented as an **opt-in prop** on the row components; **per-machine timeline pages do not set it and are visually unchanged**.
- Issue rows additionally carry machine identity via their mono issue ID (e.g. `GZ-12`); they still get the name line for uniformity.
- **Machine filter:** multi-select beside the existing tag filter; the filter component gains a `baseUrl` prop to detach it from the per-machine route.
- Day/month bucketing, sticky bucket headers, and pagination reuse the existing logic. Bucketing and any future grouping remain **presentational passes over the fetched page** so PP-ynff (day × machine grouped view) is a drop-in alternate strategy.
- **Read-only in v1.** The composer binds to a single machine; "New Note" with a machine picker is PP-slrd.2.

## Header, nav, empty states

- Header: "{Owner name}'s Machines" + aggregate summary line.
- Entry points:
  - **"My Machines"** item in the user menu (always shown; the empty state covers non-owners).
  - **Owner names link to `/c/owner/[id]`** wherever owner names appear (machine Info tab, etc.). When public user pages exist someday, these links retarget there — one-line change per call site; a hovercard becomes worthwhile only at that point (multiple destinations).
- Empty state: friendly "no machines owned" message.

## Permissions

Same visibility as `/m` — no new permission, no matrix change. Rationale: the page aggregates data already browsable per-machine and filterable by owner on `/m`; gating the aggregate would add 403s without hiding anything. Owner-only content (`ownerNotes`, `ownerRequirements`) stays on machine Info pages and does not appear here.

## Email privacy

Owner display uses names only (CORE-SEC-007); no emails anywhere on collection pages.

## Testing

Per the cheapest-layer rule (CORE-TEST-005):

- **PGlite integration:** machine-set scoping of overview/issues/timeline queries (including: machines with zero events, last-activity correctness, worst-severity derivation), resolver correctness, pagination across machines.
- **RTL unit:** table sort state, column-picker show/hide + localStorage persistence, un-hideable columns.
- **Smoke E2E:** all three tabs render without 500 for an owner with machines and for an empty collection.
- **E2E journey** only if smoke doesn't exercise the wiring: user menu → My Machines → sort table → open Issues tab → drill into an issue.

Existing per-machine timeline tests must pass unchanged (regression guard for the opt-in attribution prop).

## Deferred work (tracked under epic PP-slrd)

| Bead      | Scope                                                                              |
| --------- | ---------------------------------------------------------------------------------- |
| PP-slrd.2 | New Note composer with machine picker on the collection timeline                   |
| PP-slrd.3 | Settings comparison tab (blocked on PP-43q3 machine settings)                      |
| PP-829c   | Bulk presence/status actions on Overview                                           |
| PP-ynff   | Optional day × machine grouped timeline view (B4), non-default                     |
| (future)  | Machine tags / TD tournament lists as a second collection source (`/c/tag/[slug]`) |

## Key decisions log

1. **No tag model in v1; source-agnostic view layer instead.** Queries take machine lists, never an owner — future sources are additive.
2. **Overview = dense sortable table** (over card grid and status-grouped list); worst-first default; configurable columns justified by future growth (settings columns for TD lists).
3. **Timeline attribution = B1 name lines** (over initials chips — too dense; right-side placement — reads last, collides on mobile; B4 grouping — breaks chronology, beaded as optional mode).
4. **No permission gate** — matches `/m` visibility; aggregation exposes nothing new.
5. **Per-machine pages untouched** — all collection behavior is opt-in via props/new routes.
