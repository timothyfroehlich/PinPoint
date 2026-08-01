# Shareable Settings Sets — v1 (Owner / Community / Tournament)

**Date:** 2026-07-22
**Driver:** Tournament settings for the Austin Pinball Collective. Grew from "add a Tournament tag" into a visibility/ownership model that fixes the root causes the tag alone would have papered over.
**Supersedes:** PP-03fd (a dedicated "Tournament Director" role) — collapsed. Tournament authoring rides on the existing **technician** role; Tim promotes TDs to technician.
**Status:** Design approved (brainstorm 2026-07-22). Ready for implementation plan.

---

## 1. Problem & motivation

Today `machine_settings_sets` is a **flat, fully-public, per-machine namespace**: every set is visible to everyone, and edit is gated by one machine-scoped permission (`machines.settings.manage` → owner / technician / admin). Three problems fall out of that shape:

- **Clutter.** A technician creating a set for one machine dumps it into everyone's view of that machine. There is no "personal / not-yet-shared" state.
- **Slot contention.** Any per-machine cap (the prototype's 10) is a shared pool — a technician's sets eat the owner's "slots."
- **No tournament distinction.** No way to mark a set as a competition config, or to filter to it.

The fix is to give sets **ownership** (Owner vs Community) and **visibility** (private draft vs public), and to make **Tournament** an orthogonal tag. That turns editing into a role question and viewing into a visibility question, and it dissolves clutter + contention as a side effect.

---

## 2. The model

### 2.1 Two independent axes + one tag

- **Kind** — drives who may **edit**:
  - **Owner set** — created by the machine owner. **Protected**: only the owner + admin may edit. Techs cannot.
  - **Community set** — created by a technician (or admin). **Co-edited by all technicians+** (plus the machine owner).
- **Visibility** — drives who may **see**:
  - **Private draft** (default on create) — only the creator (and admin) sees it.
  - **Public** — everyone sees it (the machine page is public).
- **Owner's default** — exactly one set per machine is the owner's canonical config (the artifact previously called "preferred"). Always an **owner set**, always public. Backed by the existing partial unique index.
- **🏆 Tournament** — an **orthogonal tag** on any set. Tagging requires edit rights on that set. Multiple tournament sets per machine are allowed; the name differentiates. A set MAY be both Owner's default and Tournament (independent flags).

### 2.2 Permission matrix (all role-based — no per-person grants in v1)

| Set                    | Who sees it       | Who can edit it                                   |
| :--------------------- | :---------------- | :------------------------------------------------ |
| ★ Owner's default      | Everyone          | Machine owner + Admin (**techs excluded**)        |
| Owner set              | Everyone (public) | Machine owner + Admin (**techs excluded**)        |
| Community set (public) | Everyone          | Any technician+ **and** the machine owner + Admin |
| Private draft          | Its creator only  | Its creator + Admin                               |

**Editing always requires _both_ view and edit rights.** A _community_ private draft has `is_owner_set = false`, so the edit column would nominally admit any technician — but the _view_ gate limits it to the creator, so effective editors = creator + admin. (A private draft created by the machine owner is an owner set: owner + admin either way.) Drafts can be either kind; visibility is the axis that hides them, kind is the axis that decides editing once visible.

### 2.3 Lifecycle

1. **Create** → technician+, or the machine owner on their own machine (`machines.settings.manage`, unchanged). Plain members **cannot** create in v1.
2. New set is born a **private draft**. `is_owner_set` is captured at creation: true iff the creator is the machine owner.
3. **Publish** → flips visibility to public. Gated by edit rights on the set (technician+/owner).
4. **Set as Owner's default** / **tag Tournament** → gated by edit rights on that set (default additionally requires the set be an owner set; see §4).

---

## 3. Data model changes

Add three columns to `machine_settings_sets` (schema.ts:581). Keep `is_preferred` as the **Owner's default** marker and keep its partial unique index unchanged.

| Column          | Type               | Default | Meaning                                                                                                                                                                                                                                         |
| :-------------- | :----------------- | :------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `is_owner_set`  | `boolean not null` | `false` | Captured at creation: creator was the machine owner. **Stored, not derived** — survives machine-ownership transfer (the new owner inherits the machine's owner sets), and is a stable authorization input rather than a per-render computation. |
| `is_public`     | `boolean not null` | `false` | `false` = private draft, `true` = published/public. Two-state on purpose (YAGNI); an enum is the v2 escape hatch if "unlisted" ever appears.                                                                                                    |
| `is_tournament` | `boolean not null` | `false` | The 🏆 tag.                                                                                                                                                                                                                                     |

**Rejected alternative:** deriving owner-set from `created_by == machine.owner_id` at query time (the prototype stub). Rejected because it flips semantics on ownership transfer and re-computes an authorization fact on every render.

**No set cap.** The prototype's 10-limit is dropped entirely; pagination later if a list ever grows long.

---

## 4. Authorization (helpers)

New per-set helpers, alongside the existing matrix. `access` is the viewer's `AccessLevel`; `machineOwnerId` from the machine.

- **`canCreateSet(access, machineOwnerId, userId)`** = existing `checkPermission("machines.settings.manage", …)`. Unchanged (owner / technician / admin).
- **`canViewSet(set, userId, access)`** = `set.is_public || set.is_preferred || set.created_by === userId || access === admin`.
- **`canEditSet(set, machineOwnerId, userId, access)`** = `canViewSet(...) && (`
  - if `set.is_owner_set`: `userId === machineOwnerId || access === admin`
  - else (community): `access >= technician || userId === machineOwnerId || access === admin` `)`
- **`canPublish(set, …)`** = `canEditSet(set, …)`. Publishing sets `is_public = true`.
- **`canSetOwnerDefault(set, machineOwnerId, userId, access)`** = `(userId === machineOwnerId || access === admin) && set.is_owner_set`. Only owner sets are eligible to be the default; only owner/admin toggle it.
- **`canTagTournament(set, …)`** = `canEditSet(set, …)`.

The server computes a per-set `canEdit` (and the eligible actions) and passes it to the client — replacing the single machine-wide `canEdit` the page currently passes.

---

## 5. Query changes

`getMachineSettingsSets` (settings-queries.ts) gains viewer context and returns only visible sets with the derived per-set flags:

- **Signature:** `(db, machineId, { viewerUserId, viewerAccess, machineOwnerId })`.
- **Filter:** return sets where `canViewSet` is true (public + own drafts + the owner's default).
- **Per-row output** (`SettingsSetData`): `isOwnerSet`, `isPublic`, `isTournament`, `isPreferred` (owner's default), `createdByOwner` (= `isOwnerSet`, kept as the bucket key), and a computed **`canEdit`** for this viewer. Remove the prototype's name-regex tournament stub and the recomputed `createdByOwner`.

---

## 6. Server action changes

File: `src/app/(app)/m/[initials]/(tabs)/settings/actions.ts`.

- **`saveSettingsSetAction`**
  - **Create:** enforce `canCreateSet`. Set `is_owner_set = (creatorId === machineOwnerId)`, `is_public = false` (draft), `is_tournament = false`.
    - **Auto-default (narrow):** if the _owner_ creates a set and the machine has **no** owner's default yet, mark the new set the default — which also **publishes** it (an owner's default is always public), so this one set skips the draft state. Tech-created first sets do **not** auto-default (they are community).
  - **Update:** enforce `canEditSet(set)`.
- **`deleteSettingsSetAction`** — enforce `canEditSet(set)`.
- **`duplicateSettingsSetAction`** — the copy is a fresh **private draft owned by the duplicator**: `is_public = false`, `is_preferred = false`, and **`is_tournament` is copied from the source** (duplicating a tournament set yields a tournament variant — Tim's call). Ownership is **re-derived**, not copied: `is_owner_set = (duplicatorId === machineOwnerId)`, so a technician's copy of an owner set is a community set the technician can immediately edit (rather than a protected owner set they couldn't touch).
- **`setPreferredSettingsSetAction` → `setOwnerDefaultAction`** — enforce `canSetOwnerDefault` (owner/admin, target is an owner set). Keep the clear-then-set + partial unique index backstop.
- **New `publishSettingsSetAction(setId, isPublic)`** — toggle `is_public`, gated by `canEditSet`. **Refuses to unpublish the current Owner's default** (a default must stay public); unset the default first.
- **New `setTournamentTagAction(setId, value)`** — toggle `is_tournament`, gated by `canEditSet`. **No timeline event.**
- **Timeline:** **remove the `settings_set_preferred` timeline event** (Tim: it doesn't earn its keep, and there is no event for tagging Tournament). May be sliced as its own small cleanup PR (drops the event type + backfills existing rows).

---

## 7. UI

Component: `src/components/machines/settings/` (`SettingsTab.tsx`, `SettingsSetCard.tsx`) + `inline-editable-field.tsx`.

- **Filter chips** (top of tab): `All · Mine · Owner's · Community · 🏆 Tournament`. Toggles **intersect** (both off = All; each on narrows). Definitions:
  - **Mine** = `created_by === viewer`. Hidden when the viewer can't create (nothing to show).
  - **Owner's** = `is_owner_set`. Hidden when the viewer **is** the machine owner (redundant with Mine).
  - **Community** = `!is_owner_set && is_public`.
  - **🏆 Tournament** = `is_tournament`.
- **Cards:** collapsed by default. Badges: **★ Owner's default**, **🏆 Tournament**, and a kind/visibility indicator (Owner / Community / **Private draft**). Per-set dropdown actions gated by the row's `canEdit`: Edit, Publish/Unpublish, Set as Owner's default (owner/admin), Tag/Remove Tournament, Duplicate, Delete.
- **"Owned by _Name_"** text near the top — names the machine owner so the buckets have a referent. **Name only** (CORE-SEC-007 email privacy).
- **Guidance callouts** compressed vertically; "How to change settings" is collapsible (`<details>`), collapsed by default. (Already prototyped in `inline-editable-field.tsx`.)

---

## 8. Migration (Drizzle — `db:generate` + `db:migrate`, CORE-ARCH-009)

1. Add `is_owner_set`, `is_public`, `is_tournament` (all `boolean not null default false`).
2. Backfill (Tim-approved mapping):
   - `UPDATE machine_settings_sets SET is_public = true;` — all existing sets become **Community/public** (preserves today's "everyone sees everything").
   - `UPDATE machine_settings_sets SET is_owner_set = true WHERE is_preferred = true;` — the existing preferred set becomes the **Owner's default** (owner-scoped, still public).
3. Separately (may be its own PR): drop `settings_set_preferred` timeline events + retire the event type.
4. Update `seed-machine-settings.mjs` to produce a representative spread (owner default, owner set, community public, community draft, a couple tournament sets) and drop the prototype's local `created_by`/demo-set SQL tweaks.

---

## 9. Testing (test at the cheapest layer — CORE-TEST-005)

- **Integration (PGlite + direct action):**
  - Create-by-tech → `is_owner_set = false`; create-by-owner → `true`.
  - `canEditSet`: owner set excludes techs; community set admits technician **and** machine owner; private draft admits only its creator.
  - `canViewSet` hides private drafts from non-creators; public + owner's default visible to all.
  - `publishSettingsSetAction` flips visibility; `setOwnerDefaultAction` is owner/admin-only, exclusive, and rejects non-owner sets; `setTournamentTagAction` gated by edit.
  - `duplicateSettingsSetAction` resets tournament/default and re-derives ownership.
  - Update existing callers of `getMachineSettingsSets` for the new signature.
- **RTL unit:** filter-chip intersection logic; badge rendering; collapsed-by-default; per-set action gating from `canEdit`; the collapsible `inline-editable-field`.
- **Migration/seed:** verify backfill mapping.
- Gates: `pnpm run check` floor; **`pnpm run preflight`** (this touches schema + server actions + permissions).

---

## 10. Scope

**v1 (this spec):** the model, three columns + migration, per-set authorization helpers, query + action changes, the tab UI (buckets, badges, "owned by", collapsible callouts), removal of the preferred timeline event, tests.

**v2 (deferred until a real need):** granular **per-person** sharing (a `settings_set_collaborators` table mirroring `collection_collaborators`), granting edit **outside** the technician role or to a **subset** of techs, and anonymous **view-link tokens** (à la collections' `view_token`). None are exercised by the tournament driver; co-editing among a role is the cheapest thing in the matrix and covers the use case.

---

## 11. Resolved decisions (log)

- **No new role.** Tournament authoring rides on **technician**; PP-03fd collapsed.
- **Co-editing as a role, not granular.** All technicians+ co-edit community sets; per-person grants are v2.
- **Owner sets are protected** from techs; **owners may edit community sets**.
- **Creation is technician+** (plus owner on own machine); plain members cannot create in v1.
- **No set cap** — 10-limit dropped.
- **Migration:** existing → Community/public; existing preferred → Owner's default.
- **No timeline event** for the Tournament tag; **remove** the `settings_set_preferred` event.
- **Duplicate carries** the Tournament tag; resets the default; the copy is a private draft with ownership re-derived from the duplicator.
- **Labels:** badge "**Owner's default**"; tag "**Tournament**"; kinds "**Community**" / "**Private draft**".

---

## 12. Prototype reference (not the implementation)

This branch (`worktree-tournament-tag`) carries **uncommitted** prototype edits — `SettingsTab.tsx`, `SettingsSetCard.tsx`, `inline-editable-field.tsx`, `settings-types.ts`, `settings-queries.ts`, plus scratchpad demo SQL. They explore the tab UX and use **stubs** (name-regex tournament, recomputed `createdByOwner`, client-only optimistic toggles, no persistence). Treat them as a **visual reference**; the real implementation replaces every stub with the columns, helpers, and actions above. The compressed/collapsible callout work in `inline-editable-field.tsx` is production-ready and can be kept.
