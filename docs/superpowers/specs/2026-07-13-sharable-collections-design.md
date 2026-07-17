# Sharable Collections & Machine Tags — Design

**Date:** 2026-07-13
**Epic:** (new) "Sharable collections & machine tags" — extends PP-slrd (Multi-Machine Collection View)
**Status:** Approved design, pre-implementation
**MVP driver:** APC tournament this weekend needs a shareable, tournament-scoped machine view.

## Summary

Two related surfaces for grouping machines, both rendered through the **existing
`/c/` collection view** (Overview / Issues / Timeline tabs, PP-slrd.1) via new
resolvers:

- **Collection** — a user-created, curated _set_ of machines. Anyone (member+)
  can create one and add any machines. Private by default; the owner can enable
  a **view link** and/or an **edit link** to share (Google-Docs style, no
  per-user allow-lists). This is the MVP (Wave 0).
- **Tag** — a tech+-curated, always-public _attribute on machines_ (e.g. `Stern`,
  `1990s`, `Main Floor`). Surfaces on machine pages; clicking a tag opens the
  collection view of all machines with it. Tags can belong to **exclusive
  groups** (a machine is one manufacturer, one era). Post-MVP (Wave 1+).

The two are structurally similar (a named machine set + a membership join + a
visibility/curation policy) but are **kept as separate models until Wave 1**, per
the Rule-of-Three caveat below: at MVP there is only one instance of the
"machine set" shape (collections), so there is nothing to unify yet.

## Goals

- A user can assemble a set of machines (a tournament bank), view aggregate
  Issues/Timeline/Overview scoped to just that set, and share it by link.
- Sharing supports both view-only (players, anonymous OK) and collaborative
  editing (co-TDs) **without** building per-user allow-lists.
- Tags, exclusive tag groups, PinballMap-sourced metadata tags, ACL
  collaboration, a public directory, and locations are all **additive** on top
  of the MVP — new resolvers/routes/tables, no churn to the view.

## Non-goals (MVP / Wave 0)

- No tag data model (Wave 1 — new table + resolver).
- No per-user allow-lists / "specific people" sharing (Wave 3).
- No public/discoverable collection directory (Wave 3; PP-07oc).
- No "add to collection" button on the machine page (later bead — the machine
  page is already dense). MVP adds machines via a searchable multi-select on the
  collection's own manage surface.
- No bulk presence/status actions from the collection (PP-829c, Wave 3).
- No changes to per-machine pages.

## Architecture

### Reuse of the existing collection view (the seam)

PP-slrd.1 built a **collection-source-agnostic** view: a collection resolves to a
list of machines, and every aggregate query (`summarizeCollection`, the Overview
table, the Issues scope, `getMachineTimeline`) takes the machine list — never an
owner. v1 shipped one resolver, `getOwnerCollection` (`src/lib/collections/owner.ts`),
returning `OwnerCollection { owner: {id,name}; machines: CollectionMachine[] }`.

A user collection is a **second resolver returning the same shape**. Everything
downstream is untouched. The only generalization needed: the header/attribution
currently assumes an `owner`; a user collection has a `name` + `owner` (creator),
so the header type widens from `owner` to a small descriptor
`{ title: string; owner?: {id,name} }` (or the resolver returns an
`OwnerCollection`-compatible object whose `owner` is the creator and whose title
is derived by the layout). Chosen approach: introduce a shared
`ResolvedCollection` type — `{ title: string; machines: CollectionMachine[]; ... }`
— that `getOwnerCollection` and `getCollection` both satisfy; the owner route
derives `title` from the owner name, the collection route uses `collection.name`.
This is a small, additive refactor of the header/layout, not the queries.

### Data model

Two new tables (Drizzle migration via `db:generate` + `db:migrate`, CORE-ARCH-009):

**`collections`**

- `id` uuid PK default random — the canonical, owner-facing identifier.
- `name` text not null.
- `description` text (nullable).
- `owner_id` uuid not null → `user_profiles.id` (the creator).
- `view_token` text unique (nullable) — presence enables anonymous view access.
- `edit_token` text unique (nullable) — presence enables signed-in edit access.
- `created_at` / `updated_at` timestamps.
- Index on `owner_id` (list "my collections"); unique indexes on the tokens.

**`collection_machines`** (membership join)

- `collection_id` uuid → `collections.id` (cascade delete).
- `machine_id` uuid → `machines.id` (cascade delete).
- `added_at` timestamp.
- `added_by` uuid → `user_profiles.id` (nullable) — who added it (owner or an
  edit-link editor); useful later, cheap now.
- Composite PK `(collection_id, machine_id)`.

Tokens are opaque random strings (e.g. 24+ bytes base64url), generated on first
enable. **Rotating a token revokes all prior links of that tier**; toggling a
tier off nulls the token. The token _is_ the capability — no separate ACL row.

### Routing

`/c/collection/[id]` mirroring `/c/owner/[userId]`:

- `/c/collection/[id]` — Overview (landing)
- `/c/collection/[id]/issues` — Issues
- `/c/collection/[id]/timeline` — Timeline

Structure copies `/c/owner/[userId]/(tabs)/`: a `(tabs)/layout.tsx` fetching the
collection once (React `cache`-deduped `_data.ts`), `CollectionHeader` +
`CollectionTabStrip`, `notFound()` when access is denied.

Shared links resolve through the **same route** with a token query param
(`/c/collection/[id]?token=…`), validated server-side against `view_token` /
`edit_token`. (A cleaner token-only path can come later; query param is the
smallest MVP surface and keeps a single route + layout.)

### Access model

Resolution order in the layout/`_data`:

1. **Authenticated owner** (`owner_id === session user`) → full read + edit +
   manage (share, rename, delete).
2. **Valid `edit_token`** presented AND user is signed in → read + edit
   (add/remove machines). No manage (can't reshare/delete/rename).
3. **Valid `view_token`** presented (anonymous OK) → read only.
4. Otherwise → **`notFound()` (404, never 403)** — do not reveal that a private
   collection exists.

Admins: an authenticated `admin` may view any collection (admins already see
everything in the app). Edit/manage stays owner-only + edit-token; admins get no
special _management_ rights over another user's collection in MVP (revisit if a
moderation need appears).

Rationale for anonymous view: consistent with PP-slrd's no-gate decision — the
collection aggregates only per-machine data that is already browsable, so a view
link exposes nothing new. Edit requires sign-in to avoid anonymous writes; the
only mutation is collection membership (not machine state), so attribution stakes
are low, but a real user id is still recorded in `added_by`.

## Permissions (matrix + row-level)

Per CORE-ARCH-008, role capability goes through the matrix; ownership is
row-level in the action (the `checkPermission` `'owner'`/`'own'` context pattern
already used for machines/issues does not fit link-token access, so token checks
live in the action/loader beside the matrix check).

New matrix category **Collections** (`src/lib/permissions/matrix.ts`):

- `collections.create` — member+ (`unauthenticated:false, guest:false,
member:true, technician:true, admin:true`). Guests cannot create.
- `collections.view` — `true` for all levels (governs the _feature_; per-row
  private-ness is enforced by the token/owner check, not the matrix).

Row-level, enforced in server actions (not the matrix):

- **Manage** (rename, delete, change sharing) → `owner_id === userId`.
- **Edit membership** (add/remove machines) → `owner_id === userId` OR valid
  `edit_token` + signed in.

The help page auto-generates from the matrix, so the Collections category must
carry accurate labels/descriptions (CORE-ARCH-008).

## UX

### My Collections (entry point)

A "My Collections" list page (owned collections + "New collection" button),
reachable from the user menu (beside "My Machines"). Each row links to
`/c/collection/[id]`. The full top-level nav directory (PP-07oc) stays Wave 3;
MVP only needs the owner's own list.

### Manage surface (create / edit / add machines)

- **Create**: a form (`<form action={serverAction}>`, progressive enhancement,
  CORE-ARCH-002) — name + optional description → new collection → redirect to it.
- **Add/remove machines**: a searchable **multi-select** listing all machines
  (name + initials), writing membership via a server action. This is the MVP
  collection-building mechanism. The machine-page "add to collection" button is
  a later bead.
- **Rename / delete**: owner-only actions on the manage surface.

Presentation of the manage controls: shown inline on the collection Overview tab,
so the collection view _is_ the manage surface — no separate route. Affordances
are role-scoped: an **edit-link editor** sees only add/remove machines; the
**owner** additionally sees rename, delete, and Share. View-only visitors see
none of it.

### Sharing

A `<dialog>`-based Share panel (Baseline `<dialog>`, CORE-UI-005; `inert` on
background per CORE-A11Y), Google-Docs shaped:

- Toggle **"Anyone with the view link"** → generates/enables `view_token`, shows
  a copy-link field.
- Toggle **"Anyone with the edit link (sign-in required)"** → generates/enables
  `edit_token`, shows a copy-link field with a note that editors must be signed
  in.
- Each toggle off nulls its token (revokes); a "reset link" affordance rotates
  the token. Owner-only.

## Tabs (unchanged reuse)

- **Overview** — `CollectionOverviewTable` + `summarizeCollection` over the
  resolved machine list. Header shows collection name + aggregate summary line.
- **Issues** — existing issues list force-scoped to the collection's machine
  initials (same pattern as `/c/owner`).
- **Timeline** — combined feed via `getMachineTimeline` over the set, B1
  attribution, machine multi-select filter. Read-only in MVP (composer with
  machine picker is PP-slrd.2, already beaded).

## Testing (CORE-TEST-005)

- **PGlite integration** (cheapest correct layer for wiring/permissions/queries):
  - `getCollection` resolver correctness (membership, empty collection, ordering).
  - Tab scoping: Overview/Issues/Timeline restricted to the collection's machines
    (including a collection spanning multiple owners, machines with zero events).
  - Access matrix: owner → full; valid `view_token` (anon) → read; valid
    `edit_token` + signed in → read+edit; `edit_token` while signed out → denied;
    no/invalid token → `notFound`. Admin → view.
  - Actions: create (member+ only; guest denied), add/remove membership
    (owner or edit-token; unauthorized denied), rename/delete (owner only).
- **RTL unit**: Share dialog toggle state (enable/disable/rotate reflects token
  presence), create/rename form state, multi-select add/remove UI.
- **Smoke E2E**: collection tabs render without 500 for a populated and an empty
  collection; a share link opens the view.
- **E2E journey** (only if smoke doesn't cover the wiring): create collection →
  add machines → open Share → enable view link → visit link as anon → see
  Overview.

Existing `/c/owner` and per-machine timeline tests must pass unchanged
(regression guard for the header/`ResolvedCollection` refactor).

## Non-negotiables checklist (MVP)

- **CORE-ARCH-009** — schema change ships as a Drizzle migration (`db:generate` +
  `db:migrate`); never `drizzle-kit push`. Run `pnpm run preflight` (DB schema
  change).
- **CORE-ARCH-001 / 002** — Server Components by default; `"use client"` only on
  interaction leaves (Share dialog, multi-select); forms via
  `<form action={serverAction}>`.
- **CORE-SSR-001/002** — any new loader uses `createClient()` → `auth.getUser()`
  immediately.
- **CORE-TS-007 / 008** — ts-strictest, no `any`/`!`/unsafe `as`; `~/` aliases.
- **CORE-SEC-007** — owner/creator shown by name only; no emails on collection
  surfaces.
- **CORE-ARCH-008** — Collections matrix category added; help page stays in sync.
- **CORE-UI-005/006** — `<dialog>` for Share; container queries for internal
  responsive.
- **CORE-FORM-001..006 / CORE-A11Y-001..006** — correct input types/autocomplete,
  `:user-invalid`, real `<button>`s, `inert` background under the open dialog,
  accessible names on the multi-select and table.
- **CORE-ARCH-011** — token generation and any notification are outside DB
  transactions; membership writes carry no external side effects.

## Wave roadmap (epic children — pointers, not full specs)

| Wave   | Scope                                                                                                                                                                                                                                                                                                                                                                                    | Notes / beads                                                                   |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **0a** | **Private collections**: model + `getCollection` resolver + `/c/collection/[id]` (3 tabs) + "My Collections" list + create/rename/delete + add/remove via multi-select. Owner-only, no sharing.                                                                                                                                                                                          | Ships complete even if 0b slips.                                                |
| **0b** | **Sharing**: `view_token` + `edit_token`, Share dialog, access resolution (anon view / signed-in edit / 404).                                                                                                                                                                                                                                                                            | The piece the tournament needs.                                                 |
| **1**  | **Tags (tech+)**: tag model, apply-to-machine, machine-page tag display, `/c/tag/[slug]`, tag browse. Then **exclusive tag groups**. **TD-role decision** here (cosmetic alias vs distinct tag-curator capability vs just-use-technician). Apply the Rule-of-Three caveat: tags are the _second_ machine-set instance — evaluate unifying with collections rather than a parallel table. |                                                                                 |
| **2**  | **PinballMap metadata auto-tags**: spike `pinballmap_catalog` fields first (does it carry manufacturer/era?), CORE-PBM conduct; then auto-populated exclusive groups (manufacturer, era).                                                                                                                                                                                                |                                                                                 |
| **3**  | Long tail: **collaboration ACLs** ("specific people"), **public/discoverable directory** (folds in PP-07oc), **bulk presence actions** (PP-829c) on tournament banks, **locations as promoted tags**.                                                                                                                                                                                    | Existing PP-slrd children (PP-slrd.2/.3, PP-ynff) slot in as view enhancements. |

## Key decisions log

1. **Reuse the `/c/` view via a new resolver** — user collections return the same
   machine-set shape; tabs/queries untouched. Only the header widens to a shared
   `ResolvedCollection` (title + optional owner).
2. **Two models, not one, at MVP** — collections and tags share a shape but tags
   don't exist yet; there is one instance to build. Unification is evaluated in
   Wave 1 (the second instance), per the Rule-of-Three load-bearing caveat.
3. **Sharing = view link + edit link, no allow-lists** — link tokens are the
   capability. View is anonymous-OK; edit requires sign-in. Co-curation without
   per-user ACLs (deferred to Wave 3).
4. **404, never 403, on denied access** — a private collection's existence is not
   revealed.
5. **Role gate via matrix (`collections.create`, member+); ownership/edit-token
   row-level in the action** — token access doesn't fit the matrix's
   owner/own context, so it lives beside the matrix check.
6. **No machine-page "add to collection" in MVP** — the machine page is already
   dense; MVP adds via the collection's own multi-select. Machine-page entry is a
   later bead.
7. **Tournament-Director role deferred to Wave 1** — MVP needs no new role
   (collections are democratic; edit-link covers co-curation). When tags land,
   decide alias vs distinct capability; "alias identical to technician" is the
   weak option (clutters the auto-generated help matrix without clarifying
   authority).

## Open questions (resolved at their wave, not now)

- Wave 1: does `/c/tag/[slug]` need its own membership table or does it share
  `collection_machines` (Rule-of-Three call)?
- Wave 1: TD role — cosmetic alias, distinct tag-curator capability, or none?
- Wave 2: does `pinballmap_catalog` actually expose manufacturer/era per game?
- Wave 3: token-only share route vs `?token=` query param (MVP uses query param).
