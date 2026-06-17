# User Profiles — Design Spec

**Date:** 2026-06-16
**Status:** Approved design, pre-implementation
**Worktree/branch:** `worktree-user-profiles`

## Summary

Add public **user profile** pages, cleanly separated from the existing private
**Account Settings**. The split is intentional and user-facing: _if you can edit
it on your profile, it's public; everything private lives in settings._ As part
of this, introduce a reusable **person hover card** that appears wherever a
person is referenced across the app.

## Goals

- A public-read profile page per registered user at `/u/[id]`, visible to any
  authenticated user.
- A genuine separation of concerns: public profile fields are edited on the
  profile (inline); private/account controls stay in settings.
- A reusable person hover card on every person reference, with a real profile
  link as its accessible base.

## Non-goals (v1)

- Contact links on the profile (explicitly deferred).
- A full activity feed (we ship light counts instead).
- Public/unauthenticated access to profiles.
- Hover cards inside interactive pickers (e.g. assignee dropdown).
- User search / member directory (may follow later).
- Vanity handles — URLs use the `userProfiles.id` UUID for v1.

## Decisions (locked during brainstorming)

1. **Proper split.** Public profile = editable public fields; Account Settings =
   private/account only. The name/avatar editor _leaves_ settings.
2. **Inline edit** on your own profile (not a separate edit page, not a settings
   sub-section). You edit the live public page.
3. **Visibility: authenticated-only.** Route lives under `(app)`; the existing
   auth gate is the enforcement.
4. **Public fields:** avatar, display name (first/last), pronouns, bio, role
   badge (read-only, admin-controlled), owned machines, member-since.
5. **Pronouns included** (pinball community skews notably non-binary).
6. **Light activity stats (option B):** issues reported, comments made, issues
   resolved. Counts, not a feed.
7. **Person hover card** everywhere a person is referenced; real users get a card
   plus profile link, invited/deleted users degrade to plain text.
8. **Hover-card data: lazy-fetch on open (option B)** — instant name/avatar from
   resolver data, richer bits (machine count) fetched on hover via a small route
   handler. List queries stay untouched (no N+1).
9. **Owned-machines section is hidden entirely at zero** (no empty header); same
   for the "Owns N machines" line in the card.
10. **Profile-edit auth is an ad-hoc ownership check**, not a matrix permission —
    it's identity equality (`you === this profile`), which no role grants.
11. **Owned machines link into the existing collection view, not a rebuilt table.**
    A v1 "collection" already _is_ an owner's machines, served at
    `/c/owner/[userId]` (Overview / Issues / Timeline tabs). The profile shows a
    compact list of machine names (each linking to its own `/m/[initials]` page),
    **capped at 6**, with a "View all N →" / "View full collection →" link to
    `/c/owner/[id]`. The hover card's "Owns N machines" line links there too.

## Data model

Add two nullable columns to `userProfiles` (Drizzle generate + migrate; never
`drizzle-kit push`):

- `bio` — `text`, nullable.
- `pronouns` — `text`, nullable.

Everything else already exists: `firstName`, `lastName`, generated `name`,
`avatarUrl`, `role`, `createdAt`.

## Routes & components

### Profile page — `src/app/(app)/u/[id]/page.tsx` (Server Component)

Responsibilities:

- Load the `userProfiles` row by `id`; if it doesn't exist (or the id is an
  invited/deleted user with no profile), call `notFound()`.
- Load owned machines via `eq(machines.ownerId, id)` (machine name + initials,
  capped — fetch 7 to know whether a 7th exists); render the section only when
  count > 0.
- Load three activity counts: issues reported, comments made, issues resolved.
- Determine "is this my own profile" by comparing route `id` to
  `auth.getUser()`'s id.

Layout (see mockup): avatar + name + pronouns + role badge + member-since header;
bio block; activity-counts row; owned-machines list. The owner's own view shows
an **Edit profile** affordance.

**Owned-machines section** — a compact list of up to **6 machine names**, each a
link to its own `/m/[initials]` page. When the owner has more than 6, show a
"View all N →" link; otherwise show "View full collection →". Both point at
`/c/owner/[id]` (the existing collection view — Overview / Issues / Timeline).
We do **not** rebuild the collection's status table on the profile.

Email is **never** rendered here (CORE-SEC-007).

### Inline edit — client leaf

A `"use client"` component that toggles the header/bio fields into a
`<form action={updateProfileAction}>` (progressive enhancement, CORE-ARCH-002).
Editable: avatar, first/last name, pronouns, bio. Role, activity, and machines
stay read-only.

The **existing settings avatar-upload** is _moved_ here (relocated, not rebuilt)
so upload behavior is identical to today.

### Server action — `updateProfileAction`

- Re-reads `auth.getUser()` and enforces `user.id === id` (ad-hoc ownership
  check; you can only edit your own profile).
- Validates input with Zod.
- Writes `firstName`, `lastName`, `pronouns`, `bio`, `avatarUrl` to
  `userProfiles`.

### Settings page changes (the "proper split" payoff)

- **Remove** the name/avatar profile-form (editing now lives on the profile).
- **Remove** the owned-machines count (moved to the profile).
- **Keep** email (view), connected accounts, notification prefs, security,
  danger zone.
- **Add** a "View your public profile →" link.

### Person hover card — `PersonHoverCard` (client leaf, Radix `HoverCard`)

- **Trigger is always a real `<Link>`** to `/u/[id]` — keyboard and touch get the
  profile directly; the card is the hover/focus enhancement on top. (We must not
  build the trigger as a non-focusable `<div>`.)
- **Card content:** avatar, name, pronouns, role badge, "Owns N machines"
  (hidden at zero; links to `/c/owner/[id]`), "View profile →".
- **Degraded states:** invited-but-not-signed-up and deleted ("Former user")
  render as plain text — no wrapper, no link, no card.
- **Data strategy (option B):** name/avatar render instantly from
  `resolve-person` data (extend the resolver select to include avatar + pronouns
  as needed); on open, fetch the richer bits (machine count) via a small route
  handler keyed by `userId`, showing a brief skeleton. List queries are not
  modified — no eager joins, no N+1.

## Hover-card rollout — explicit audit

Do **not** assume every reference flows through `resolve-person`. The
implementation includes an audit pass that enumerates every place a person is
displayed and marks each as either **upgraded** to the hover card or
**deliberately plain**.

Known reference sites to start the audit from (verify + extend during
implementation):

- Issue authors / reporters
- Comment authors (issue + machine timelines)
- Issue and machine timeline person rows
- Machine owner display
- Profile's own owned-machines list
- Collection view (`/c/owner/[id]`) — owner-name header, timeline attribution
- Admin users list
- Assignee picker — **deliberately plain in v1** (interactive selection menu;
  hover card would fight the dropdown)

The audit output (the full enumerated list with a decision per site) is a
deliverable of the implementation plan.

## Permissions

- **View profile:** any authenticated user — enforced by the existing `(app)`
  auth gate. No new matrix entry.
- **Edit profile:** ad-hoc ownership check in the server action
  (`auth.getUser().id === id`). Not a matrix permission (see Decision 10).
- **Email privacy:** profile and card never expose email (CORE-SEC-007).

## Testing (cheapest-layer per CORE-TEST-005)

- **Integration (PGlite + direct action):**
  - `updateProfileAction` — auth, own-only enforcement, Zod validation.
  - The three activity-count queries.
  - Owned-machines query — including the cap/overflow (fetch-7-show-6 boundary).
  - The hover-card route handler.
- **RTL unit:**
  - Inline-edit form state.
  - `PersonHoverCard` variants: real user (link + card), invited (plain),
    deleted ("Former user" plain).
- **E2E:**
  - View another member's profile.
  - Edit your own profile end-to-end.
  - Smoke: `/u/[id]` renders without 500.
  - Assert the **trigger link navigates** rather than testing hover reveal
    (hover is flaky in E2E).

## Open questions

None blocking. Vanity handles, user search, and a real activity feed are
explicit future candidates, not v1.
