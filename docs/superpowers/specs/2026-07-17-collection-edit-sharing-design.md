# Collection edit sharing via account collaborators — Design (PP-wqit.7)

**Status:** Approved (brainstorm + UI prototype, 2026-07-17)
**Bead:** PP-wqit.7 (child of epic PP-wqit)
**Parent spec:** `docs/superpowers/specs/2026-07-13-sharable-collections-design.md`
**Follow-ups:** PP-wqit.10 (save view-only bookmark), PP-wqit.11 (editable descriptions)

## Summary

Wave 0b shipped **view-only** link sharing for collections (anonymous read via a
`view_token` in the URL path). This slice adds **edit** sharing, granted **per
account** — not via a shareable edit link. A collection owner grants specific
signed-in users an **editor** role; editors can change the collection's content
(machines and name) but cannot delete it, toggle the view link, or manage the
collaborator list.

Account-based grants (over an `edit_token`) buy us: real attribution
(`collection_machines.added_by` becomes a named person), per-person revocation,
no world-editable-link footgun, and no anonymous writes.

## Decisions locked during brainstorming

- **Editor scope = owner's content form.** Today that form is **name + machine
  set**. Description is not editable by anyone yet (the `description` jsonb column
  exists but no action/UI writes it), so it is **out of scope here** and rides
  along for free when PP-wqit.11 wires description editing through the same
  `updateCollectionAction` path.
- **Owner-only actions stay owner-only:** delete, view-link toggle, and managing
  the collaborator list.
- **Admins keep view-any, not edit-any.** An admin can view any collection
  (existing `canViewCollection` invariant) but must be explicitly granted to
  edit one. No silent admin write access to members' collections.
- **Grantable set = all members**, shown **name + avatar only** (no emails,
  CORE-SEC-007). Same-name collisions are accepted at APC's ~20-member scale.
- **Grantee discovery = grouped list.** `/c/collections` shows two groups:
  "Your collections" then "Shared with you". Each row carries the owner's name
  (or "Owned by you") and an access badge (`Owner` / `Editor`).
- **Role column exists but only `editor` is used now.** Owner-granted `viewer`
  can be added later without a migration.

## Data model

New table `collection_collaborators` in `src/server/db/schema.ts`:

| Column          | Type          | Notes                                                          |
| --------------- | ------------- | -------------------------------------------------------------- |
| `collection_id` | uuid          | FK → `collections.id`, `onDelete: cascade`                     |
| `user_id`       | uuid          | FK → `user_profiles.id`, `onDelete: cascade`                   |
| `role`          | text NOT NULL | default `'editor'`; only `editor` used in MVP                  |
| `added_at`      | timestamptz   | `defaultNow()`                                                 |
| `added_by`      | uuid          | FK → `user_profiles.id`, `onDelete: set null` (granting owner) |

- **Primary key** `(collection_id, user_id)` — one row per person; makes grants idempotent.
- **Index** on `user_id` — powers the "shared with you" lookup.
- `.enableRLS()` to match every other table.

Additive, nullable-safe migration via `pnpm db:generate` + `pnpm db:migrate`
(CORE-ARCH-009 — never `drizzle-kit push`). Add a `collectionCollaborators`
relation alongside the existing `collectionsRelations`.

## Capability layer (`src/lib/collections/access.ts`)

Two distinct, pure functions (no DB imports — callers pass in the facts):

- **`canManageCollection(collection, viewer)`** — unchanged, owner-only. Gates
  delete, view-link toggle, **and** managing collaborators.
- **New `canEditCollection(collection, viewer, isEditorCollaborator: boolean)`**
  — returns `owner || isEditorCollaborator`. Gates the content edit form.

Callers resolve "is this viewer an editor collaborator of this collection?" to a
boolean and pass it in. Unit-test the truth table: owner → edit+manage; editor →
edit only; admin (non-owner, non-collaborator) → neither; stranger/anon →
neither.

## Server actions (`src/app/(app)/c/collections/actions.ts`)

- **`updateCollectionAction`** — widen the gate from `canManageCollection`
  (owner-only) to `canEditCollection` (owner OR editor). `loadOwner` is extended
  (or paired with a collaborator lookup) so the actor's editor membership is
  known. New `collection_machines` rows get `added_by = actor.userId` → real
  attribution. Transaction shape and diff-replace logic are otherwise unchanged;
  no side effects inside the transaction (CORE-ARCH-011).
- **New `addCollectionCollaboratorAction({ collectionId, userId })`** —
  owner-only (`canManageCollection`). Validates the target is a real
  `user_profiles` row and not the owner. Inserts an `editor` row with
  `onConflictDoNothing` (idempotent). `revalidatePath` the collection + list.
- **New `removeCollectionCollaboratorAction({ collectionId, userId })`** —
  owner-only. Deletes the row; the removed editor loses access on next request.
  Their past `added_by` attributions persist (historical record).
- `deleteCollectionAction` and `setCollectionSharingAction` stay owner-only.

All actions keep the existing `resolveActor()` → permission-check → Zod-validate
shape.

## UI surfaces

### Share dialog — "People with access" (owner-only)

`CollectionShareDialog` gains a section below the Wave 0b view-link toggle:

- Owner row first, non-removable, badged `Owner`.
- One row per editor: avatar + name + `Editor` badge + a remove (×) control.
- An **"Add people"** button opens a picker reusing the `AssigneePicker` cmdk
  pattern (Popover + Command, `shouldFilter={false}`, manual filtering): a search
  field over all members **except** the owner and already-added editors, each
  option showing avatar + name only.
- **Both the collaborator list and the picker list scroll** (max-height +
  overflow) so a heavily-shared collection can't blow out the dialog.

The whole dialog remains owner-only — non-owners never see it.

### Collections list — `/c/collections` (grouped)

Two groups: **"Your collections"** (owned) then **"Shared with you"**
(collections where the viewer is a collaborator). Each row shows the owner's
name (or "Owned by you") and an access badge (`Owner` / `Editor`). The list query
unions owned rows with collaborator rows (via the `user_id` index) and annotates
each with the viewer's access level.

### Collection header — `/c/[id]` (`_data.ts` resolver)

The layout resolver computes **two** booleans for the current viewer:

- `viewerCanEdit` = `canEditCollection(...)` → shows the **Edit** control.
- `viewerCanManage` = `canManageCollection(...)` → shows **Share** + **Delete**.

Role-by-role: owner → Edit + Share + Delete; editor → Edit only; view-only/anon →
no controls, badge reads "View-only".

## Testing (CORE-TEST-005)

- **Unit:** `canEditCollection` truth table (owner / editor / admin-non-owner /
  stranger / anon).
- **Integration (PGlite + direct action):**
  - `updateCollectionAction` allows owner + editor, rejects a stranger and an
    admin-non-collaborator.
  - `addCollectionCollaboratorAction` / `removeCollectionCollaboratorAction` are
    owner-only; add is idempotent; a removed editor immediately loses edit.
  - The grouped-list query returns owned + shared rows with correct access
    annotations.
- **RTL:** the "People with access" section — add flow (owner + already-added
  excluded from the picker) and remove flow.
- **E2E (one journey):** owner grants → editor edits machines → owner revokes →
  editor blocked.

## Scope boundaries

**In:** editor collaborators; grant/revoke UI; grouped list surfacing
owner-granted collaborators; attribution via `added_by`.

**Out (separate beads):**

- **PP-wqit.10** — "Save a view-only collection": a self-created bookmark
  (`saved_collections` table, kept separate from `collection_collaborators` so
  owners never see self-savers) that drops a viewed public collection into the
  grouped list under a "Saved" / "Shared with you" group with a "View-only"
  badge. Access stays capability-contingent — if the owner disables sharing, the
  saved entry goes dead, so saving never grants durable access.
- **PP-wqit.11** — editable collection descriptions (ProseMirror), which editors
  inherit for free via `canEditCollection`.
- Owner-granted `viewer` role; notify-on-grant. Not built now; the `role` column
  and action shape leave room for them.
