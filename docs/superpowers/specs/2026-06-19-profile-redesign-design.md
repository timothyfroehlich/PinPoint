# Profile Page Redesign — Design Spec

**Date:** 2026-06-19
**Branch:** `worktree-user-profiles`
**Bead:** PinPoint-5r7 (profile feature)

## Goal

Give the user profile page (`/u/[id]`) real presence: a hero identity zone,
visual stat tiles, machine cards, and a recent-activity feed — built by reusing
the existing machine-timeline subsystem rather than inventing a parallel feed.
Restyle `PersonHoverCard` to match.

## Approved decisions (from brainstorming)

- **Layout: Direction A** — hero band + stat tiles + owned-machine cards +
  recent-activity feed.
- **Activity feed reuses the machine-timeline pipeline** — same query, render
  rows, and bucketing, scoped by author instead of machine.
- **4th stat tile: "Issues fixed."**
- **Feed is capped (~8 events), no full-feed page yet** — no "View all" link, no
  `/u/[id]/activity` route in this pass.
- **Restyle `PersonHoverCard`** to match the new profile styling.

## Global constraints (carry into every task)

- **CORE-SEC-007**: never render user email on the profile page, hover card, or
  card API payload. Names, pronouns, role only.
- **CORE-ARCH-001 / 002**: Server Components by default; profile page and feed
  stay server-rendered. Edit form stays progressive-enhancement
  (`<form action={serverAction}>`).
- **Design tokens only** (design-bible §1, §18): semantic tokens
  (`bg-card`, `text-primary`, `text-muted-foreground`, `bg-primary-container`,
  `text-secondary`, `border-outline-variant`). No raw palette classes, no hex,
  no `dark:`.
- **Icons**: `lucide-react` only, `size-*` not `h-/w-` (design-bible §16).
  Hero/stat icons: `Flag`, `MessageSquare`, `Gamepad2`, `CircleCheck`.
- **Glow**: `hover:glow-primary` only on navigable cards (stat tiles that link,
  machine cards). Never on the hero band or static elements (design-bible §1).
- **Responsive**: viewport breakpoints for page structure
  (`grid-cols-2 md:grid-cols-4`); container queries for component internals.
  No `useMediaQuery`/`window.innerWidth`. New page must pass
  `assertNoHorizontalOverflow` (already covered by the profile smoke spec; keep
  it green).
- **Transitions**: `duration-150` for hover/color, `duration-300` for layout;
  pair animations with `motion-reduce:` (design-bible §11, CORE-A11Y-002).

## Data layer

### A. Extend `getMachineTimeline` with an author scope

File: `src/lib/timeline/machine-events.ts`

- Change `GetMachineTimelineArgs`: make `machineId` **optional**, add optional
  `authorId?: string`. Require **at least one** scope (return `[]` if neither
  given, mirroring the existing empty-array guard).
- The `WHERE` clause composes the present scopes with `and(...)`:
  `machineId` (eq/inArray as today) **and/or** `eq(timelineEvents.authorId, authorId)`.
- Everything downstream (people resolution, machine-ref resolution, tag
  validation, tombstones, ordering) is unchanged and shared.
- All current callers pass `machineId` — behavior for them is identical.

### B. New `getUserTimeline`

File: `src/lib/profiles/queries.ts` (or `src/lib/timeline/`)

```
getUserTimeline(userId: string, opts?: { limit?: number }): Promise<MachineTimelineRow[]>
```

- Calls the extended `getMachineTimeline(db, { authorId: userId, limit })`.
- Default limit ~8 for the profile card.
- Returns rows that may belong to machines the user does **not** own (e.g. a
  note on someone else's machine) — that's intended.

### C. Machine-label map for feed rows

The feed needs each row's machine name/initials/href for the attribution line
(the collection timeline builds this from its known machine set; the profile
feed has an arbitrary machine set). Resolve labels for the **distinct
`machineId`s present in the returned rows** via one `machines` query →
`Map<machineId, { name, href: /m/${initials}, initials }>`. Pass to
`TimelineRow` exactly as the collection page does (`machineLabel` +
`machineInitials`).

### D. "Issues fixed" count

Add to `getProfileActivityCounts` (or a sibling) in
`src/lib/profiles/queries.ts`:

- Count **distinct issues** this user moved to a resolved status, derived from
  `issue_comments` system rows: `authorId = userId`, `is_system = true`,
  `event_data->>'type' = 'status_changed'`, and `event_data->>'to'` in the
  resolved-status set. Use the canonical resolved/closed status set from
  `src/lib/issues/status.ts` (`STATUS_GROUPS`/closed group) — do not hardcode
  status strings.
- Return shape extends to `{ reported, comments, fixed }`.
- **Fallback if rejected at review:** "Notes logged" =
  `count(timeline_events where source_type='comment' and author_id=userId)`.
  (Primary choice is "Issues fixed".)

### E. Per-machine open-issue counts for hero machine cards

For the capped owned-machine set, fetch open-issue counts in one grouped query
keyed by machine initials/id (open = not in the closed status group). Surface
as `{ machineId|initials -> openCount }` consumed by the machine card. If a
clean grouped count is awkward, the machine card may omit the count — it is
enrichment, not load-bearing.

## Components & page composition

File: `src/app/(app)/u/[id]/page.tsx` — stays an async Server Component.
New presentational components under `src/app/(app)/u/[id]/` (page-local) or
`src/components/profiles/` if shared:

1. **`ProfileHero`** — gradient band:
   `radial-gradient` of `primary`/`secondary` at low opacity over `bg-card`,
   `border-b border-outline-variant`. Avatar (size-16/20), name
   (`text-2xl/3xl font-bold`, `text-balance`) + pronouns inline
   (`text-muted-foreground`), **role pill** (`bg-primary-container text-primary`,
   rounded-full, `capitalize`), member-since (`formatDate`/existing format).
   Edit button (own profile only) — keep current `?edit=1` link, styled as an
   outline button. Mobile: avatar stacks above identity; no `sm:` structural
   classes.

2. **`ProfileStatGrid`** — 4 tiles, `grid grid-cols-2 gap-3 md:grid-cols-4`.
   Each tile: `bg-card border border-outline-variant rounded-xl p-4`, icon +
   big number + label. Tiles that navigate (e.g. machines → collection) get
   `hover:glow-primary` + border hover; the "Issues fixed" number uses
   `text-secondary`. Tiles: **Issues reported** (`Flag`), **Comments**
   (`MessageSquare`), **Machines owned** (`Gamepad2`, links to
   `/c/owner/[id]`), **Issues fixed** (`CircleCheck`).

3. **Owned-machine cards** — replace the bulleted list. Grid
   `grid gap-3 @lg:grid-cols-2` (container query). Each card: machine initials
   chip (mono, `text-secondary` on `secondary/15` bg) + name + meta
   (year and/or open-issue count) + `hover:glow-primary`, links to
   `/m/[initials]`. Keep the capped behavior (`PROFILE_MACHINE_CAP`) and the
   "View all / View full collection" link. Hidden entirely at zero owned.

4. **`ProfileActivityFeed`** — server component:
   `getUserTimeline(id, { limit: 8 })` → `bucketTimelineRows` →
   `TimelineRow` (read-only: `commentCanEdit={false} commentCanDelete={false}`),
   with the machine-label map from §C. Section heading "Recent activity".
   Empty state via `<EmptyState variant="bare">` ("No activity yet"). No
   composer (read-only). No "View all" link in this pass.

5. **Edit mode** unchanged in scope — the editor (now with working Save/Cancel)
   renders under the hero when `isOwn && edit`. Only adjust layout so it fits
   beneath the new hero.

### Read-view section order

Hero → stat grid → bio (if present, in a `bg-card` rounded block) → owned
machines (if any) → recent activity.

## Hover card restyle

File: `src/components/people/PersonHoverCard.tsx`

- Header: avatar (size-10) + name with pronouns inline; role rendered as the
  same **pill** treatment (`bg-primary-container text-primary`, rounded-full,
  `capitalize`) instead of plain capitalized text.
- Keep the "Owns N machines" line (links to `/c/owner/[id]`).
- Still lazy-fetches `/api/users/[id]/card`; payload unchanged
  (`name, avatarUrl, pronouns, role, machineCount` — **no email**).
- Trigger remains the real `<Link href="/u/[id]">` (keyboard/touch reach the
  profile without the card). No "View profile" footer (already removed).

## File structure

| File                                             | Change                                                                                         |
| :----------------------------------------------- | :--------------------------------------------------------------------------------------------- |
| `src/lib/timeline/machine-events.ts`             | Extend `GetMachineTimelineArgs` + WHERE with optional `authorId`; `machineId` optional         |
| `src/lib/profiles/queries.ts`                    | Add `getUserTimeline`, `fixed` count, per-machine open counts, machine-label resolution helper |
| `src/app/(app)/u/[id]/page.tsx`                  | Compose hero + stat grid + bio + machines + feed                                               |
| `src/app/(app)/u/[id]/profile-hero.tsx`          | New `ProfileHero`                                                                              |
| `src/app/(app)/u/[id]/profile-stat-grid.tsx`     | New `ProfileStatGrid`                                                                          |
| `src/app/(app)/u/[id]/profile-activity-feed.tsx` | New feed (reuses `TimelineRow`/`bucketTimelineRows`)                                           |
| `src/app/(app)/u/[id]/owned-machine-card.tsx`    | New machine card (or inline in page)                                                           |
| `src/components/people/PersonHoverCard.tsx`      | Restyle header + role pill                                                                     |

## Testing

- **Integration (PGlite)**: extended `getMachineTimeline` author scope (returns
  only the author's events, across multiple machines, excludes others');
  `getUserTimeline`; "Issues fixed" count (status_changed→resolved by user,
  distinct issues, ignores non-resolved transitions and other users); per-machine
  open counts.
- **RTL unit**: `ProfileStatGrid` renders counts + labels; `ProfileActivityFeed`
  empty state; `ProfileHero` role pill + pronouns + own-vs-other (Edit button
  visibility).
- **E2E**: existing profile smoke (`e2e/smoke/profile.spec.ts`) must stay green;
  it already asserts render + overflow. No new E2E required for this visual pass.

## Out of scope

- Full paginated activity page (`/u/[id]/activity`) — deferred.
- Editor visual overhaul beyond fitting under the hero and the already-fixed
  Save/Cancel flow.
- Avatar cropping/upload UX changes.
- Badges/achievements, contribution heatmap.
