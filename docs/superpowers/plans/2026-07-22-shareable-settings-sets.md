# Shareable Settings Sets v1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline, single-threaded — this feature shares types across schema→query→actions→UI and should not fan out to parallel subagents). Steps use `- [ ]` checkboxes.

**Goal:** Give machine settings sets ownership (Owner vs Community) + visibility (private draft vs public) + an orthogonal Tournament tag, with role-based per-set editing.

**Architecture:** Three new boolean columns on `machine_settings_sets` drive a small set of pure per-set authorization helpers. The query filters by view-permission and stamps each row with a per-viewer `canEdit`; the server actions enforce edit/publish/default/tag per-set; the tab UI renders buckets + badges and wires the new actions.

**Tech Stack:** Drizzle (Postgres), Next.js App Router server actions, React island (`SettingsTab`), Vitest (PGlite integration + RTL), Zod.

**Spec:** `docs/superpowers/specs/2026-07-22-shareable-settings-sets-design.md` · **Bead:** PP-tn6t

## Global Constraints

- Drizzle migrations only — `db:generate` + `db:migrate`; never `drizzle-kit push` (CORE-ARCH-009).
- ts-strictest: no `any`, no `!`, no unsafe `as` (CORE-TS-007). Path aliases `~/` (CORE-TS-008).
- Permissions via helpers only (CORE-ARCH-008); email privacy — owner **name** only, never email (CORE-SEC-007).
- No side effects inside `db.transaction` (CORE-ARCH-011).
- Labels verbatim: badge **"Owner's default"**, tag **"Tournament"**, kinds **"Community"** / **"Private draft"**.
- `AccessLevel = "unauthenticated" | "guest" | "member" | "technician" | "admin"`.
- Gate before commit: `pnpm run check`; before PR: `pnpm run preflight` (schema + actions + permissions).

---

### Task 1: Schema columns + backfill migration

**Files:**

- Modify: `src/server/db/schema.ts:581` (machineSettingsSets)
- Generate: `drizzle/NNNN_*.sql`

**Interfaces — Produces:** columns `is_owner_set`, `is_public`, `is_tournament` (all `boolean not null default false`).

- [ ] **Step 1:** In `machineSettingsSets`, after `isPreferred`, add:
  ```ts
  isOwnerSet: boolean("is_owner_set").notNull().default(false),
  isPublic: boolean("is_public").notNull().default(false),
  isTournament: boolean("is_tournament").notNull().default(false),
  ```
  Update the table doc comment: note kind (owner vs community), visibility, tournament tag.
- [ ] **Step 2:** `pnpm run db:generate` → new migration with the three `ALTER TABLE ... ADD COLUMN`.
- [ ] **Step 3:** Append the backfill to the **generated** migration SQL (Tim-approved mapping):
  ```sql
  --> statement-breakpoint
  UPDATE "machine_settings_sets" SET "is_public" = true;
  --> statement-breakpoint
  UPDATE "machine_settings_sets" SET "is_owner_set" = true WHERE "is_preferred" = true;
  ```
- [ ] **Step 4:** `pnpm run db:migrate`. Expected: applies cleanly.
- [ ] **Step 5:** Commit (`feat(settings): add owner/public/tournament columns + backfill`).

---

### Task 2: View-model type

**Files:**

- Modify: `src/lib/machines/settings-types.ts:82-96` (SettingsSetData)

**Interfaces — Produces:** `SettingsSetData` with `isOwnerSet`, `isPublic`, `isTournament`, `isPreferred`, `createdById: string | null`, `canEdit: boolean` (per-viewer). **Removes** the prototype `createdByOwner`.

- [ ] **Step 1:** Replace the prototype fields. Final shape:
  ```ts
  export interface SettingsSetData {
    id: string;
    name: string;
    isPreferred: boolean; // the "Owner's default" badge
    isOwnerSet: boolean; // kind: owner (protected) vs community
    isPublic: boolean; // false = private draft
    isTournament: boolean; // 🏆 tag
    createdById: string | null; // drives the "Mine" bucket (=== viewer)
    canEdit: boolean; // this viewer may edit THIS set
    updatedBy: string;
    updatedAt: string;
    description: ProseMirrorDoc | null;
    sections: SettingsSection[];
  }
  ```
- [ ] **Step 2:** `pnpm exec tsc --noEmit -p tsconfig.app.json` will now error in `settings-queries.ts`, `SettingsTab.tsx`, `SettingsSetCard.tsx` — expected; fixed in Tasks 4/6.

---

### Task 3: Per-set authorization helpers (pure, unit-tested)

**Files:**

- Create: `src/lib/machines/settings-permissions.ts`
- Test: `src/test/unit/lib/machines/settings-permissions.test.ts`

**Interfaces — Produces:**

```ts
export interface SettingsSetAuth {
  isOwnerSet: boolean;
  isPublic: boolean;
  isPreferred: boolean;
  createdById: string | null;
}
export function canViewSet(
  s: SettingsSetAuth,
  viewerId: string | null,
  access: AccessLevel
): boolean;
export function canEditSet(
  s: SettingsSetAuth,
  machineOwnerId: string | null,
  viewerId: string | null,
  access: AccessLevel
): boolean;
export function canSetOwnerDefault(
  s: SettingsSetAuth,
  machineOwnerId: string | null,
  viewerId: string | null,
  access: AccessLevel
): boolean;
export const canPublishSet: typeof canEditSet; // alias
export const canTagTournamentSet: typeof canEditSet; // alias
```

- [ ] **Step 1: Write failing tests** covering: public visible to all; private visible only to creator+admin; owner's default always visible; owner-set editable by owner+admin but NOT technician; community-set editable by technician, owner, admin but NOT a plain member non-owner; private draft editable only by creator (+admin); `canSetOwnerDefault` true only for owner/admin on an owner set (false on community set).
- [ ] **Step 2:** Run → FAIL (module missing).
- [ ] **Step 3: Implement:**
  ```ts
  import { type AccessLevel } from "~/lib/permissions/matrix";
  const isTechPlus = (a: AccessLevel) => a === "technician" || a === "admin";
  const isOwner = (ownerId: string | null, viewerId: string | null) =>
    viewerId != null && viewerId === ownerId;

  export function canViewSet(s, viewerId, access) {
    return (
      s.isPublic ||
      s.isPreferred ||
      access === "admin" ||
      (s.createdById != null && s.createdById === viewerId)
    );
  }
  export function canEditSet(s, machineOwnerId, viewerId, access) {
    if (!canViewSet(s, viewerId, access)) return false;
    if (s.isOwnerSet)
      return access === "admin" || isOwner(machineOwnerId, viewerId);
    return (
      access === "admin" ||
      isTechPlus(access) ||
      isOwner(machineOwnerId, viewerId)
    );
  }
  export function canSetOwnerDefault(s, machineOwnerId, viewerId, access) {
    return (
      s.isOwnerSet && (access === "admin" || isOwner(machineOwnerId, viewerId))
    );
  }
  export const canPublishSet = canEditSet;
  export const canTagTournamentSet = canEditSet;
  ```
- [ ] **Step 4:** Run → PASS. **Step 5:** Commit.

---

### Task 4: Query (view filter + per-set canEdit) + page wiring

**Files:**

- Modify: `src/lib/machines/settings-queries.ts:43-79`
- Modify: `src/app/(app)/m/[initials]/(tabs)/settings/page.tsx:63-83`
- Test: `src/test/integration/` (new `machine-settings-visibility.test.ts`)

**Interfaces — Consumes:** Task 3 helpers. **Produces:** `getMachineSettingsSets(dbi, machineId, viewer)` where `viewer: { viewerId: string | null; access: AccessLevel; machineOwnerId: string | null }`.

- [ ] **Step 1:** New signature + select `isOwnerSet, isPublic, isTournament, createdBy`. Filter rows through `canViewSet`. Map each: set `isOwnerSet/isPublic/isTournament/isPreferred`, `createdById: row.createdBy`, `canEdit: canEditSet(row, viewer.machineOwnerId, viewer.viewerId, viewer.access)`. Drop the name-regex tournament stub and `createdByOwner`.
- [ ] **Step 2:** `page.tsx`: compute `access = getAccessLevel(profile?.role)`; pass `getMachineSettingsSets(db, machine.id, { viewerId: user?.id ?? null, access, machineOwnerId: machine.owner?.id ?? null })`. Keep a machine-wide `canCreate = checkPermission("machines.settings.manage", …)` for the "Add set" button. Pass to `SettingsTab`: `canCreate`, `viewerId`, `ownerName: machine.owner?.name ?? null`, `machineOwnerId`.
- [ ] **Step 3:** Integration test: create sets of each kind/visibility via direct insert; assert an anonymous viewer sees only public+preferred; a creating-tech sees their draft; `canEdit` matches the matrix per viewer.
- [ ] **Step 4:** Run integration → PASS. **Step 5:** Commit.

---

### Task 5: Server actions

**Files:**

- Modify: `src/app/(app)/m/[initials]/(tabs)/settings/actions.ts`
- Test: `src/test/integration/machine-settings-actions.test.ts` (extend)

**Interfaces — Produces:** `publishSettingsSetAction({id, isPublic})`, `setTournamentTagAction({id, isTournament})`; `setPreferredSettingsSetAction` re-gated to owner/admin.

- [ ] **Step 1:** Add an `authorizeEditSet(setId)` helper: load the set (`isOwnerSet,isPublic,isPreferred,createdBy,machineId`) + its machine owner + the authed user's id/access; return `{ ok, userId, access, set, machineOwnerId, initials }` and check `canEditSet`. Use it in update/delete/duplicate/publish/tag paths (replaces the blanket `authorizeManage` for per-set ops). Keep `authorizeManage` for **create** (machine-wide `machines.settings.manage`).
- [ ] **Step 2: `saveSettingsSetAction` (insert branch):** stamp `isOwnerSet = (userId === machineOwnerId)`, `isPublic = false`, `isTournament = false`. **Auto-default:** if `userId === machineOwnerId` AND no existing preferred set for the machine → also set `isPreferred = true, isPublic = true`. (Update branch → `authorizeEditSet`.)
- [ ] **Step 3: `duplicateSettingsSetAction`:** copy `isTournament` from source; set `isOwnerSet = (userId === machineOwnerId)`, `isPublic = false`, `isPreferred = false`; gate = can view source + `authorizeManage` (create).
- [ ] **Step 4: `deleteSettingsSetAction`:** gate via `authorizeEditSet`.
- [ ] **Step 5: `setPreferredSettingsSetAction`:** gate via `canSetOwnerDefault` (owner/admin + target is an owner set); keep clear-then-set + unique-index. **Remove the `emitSettingsSetEvent` "preferred" emit.**
- [ ] **Step 6: New `publishSettingsSetAction`:** `authorizeEditSet`; refuse when un-publishing a set that `isPreferred` (error "Unset the default first"); update `isPublic`.
- [ ] **Step 7: New `setTournamentTagAction`:** `authorizeEditSet`; update `isTournament`. No timeline event.
- [ ] **Step 8:** Remove `settings_set_preferred` from `~/lib/timeline/machine-events` (and its event-type registration); leave save/delete/duplicate events intact.
- [ ] **Step 9:** Integration tests: owner-set update rejected for technician; community-set update allowed for technician; publish flips visibility & refuses on default; tournament tag toggles & is edit-gated; duplicate carries tag + re-derives ownership; setPreferred rejects non-owner + non-owner-set.
- [ ] **Step 10:** Run → PASS. **Step 11:** Commit.

---

### Task 6: Tab UI — buckets, badges, actions, "owned by"

**Files:**

- Modify: `src/components/machines/settings/SettingsTab.tsx`
- Modify: `src/components/machines/settings/SettingsSetCard.tsx`
- Modify: `src/components/inline-editable-field.tsx` (finalize the prototyped collapsible)
- Test: `src/test/unit/components/machines/` (extend / new for filter + gating)

**Interfaces — Consumes:** Task 2 type (`canEdit`, `isOwnerSet`, `isPublic`, `isTournament`, `createdById`), Task 5 actions, page props (`canCreate`, `viewerId`, `ownerName`, `machineOwnerId`).

- [ ] **Step 1:** Replace prototype filter state with final buckets. Predicates: **Mine** `createdById === viewerId`; **Owner's** `isOwnerSet` (chip hidden when `viewerId === machineOwnerId`); **Community** `!isOwnerSet && isPublic`; **🏆 Tournament** `isTournament`. Chips intersect (all-off = All). Cards collapsed by default (already prototyped).
- [ ] **Step 2:** `SettingsSetCard` badges: **★ Owner's default** (`isPreferred`), **🏆 Tournament** (`isTournament`), kind/visibility chip (**Owner** / **Community** / **Private draft** from `isOwnerSet`+`isPublic`). Dropdown actions gated by `canEdit`: Edit, Publish/Unpublish (calls `publishSettingsSetAction`), Set as Owner's default (only when `canSetOwnerDefault`-eligible — pass a `canSetDefault` prop or derive), Tag/Remove Tournament (`setTournamentTagAction`), Duplicate, Delete. Replace the prototype's client-only optimistic tournament toggle with the real action.
- [ ] **Step 3:** "Owned by _{ownerName}_" text near the top of the tab (name only). Add-set button shown only when `canCreate`.
- [ ] **Step 4:** `inline-editable-field.tsx`: keep the prototyped `collapsible`/`defaultOpen` `<details>` variant and the compressed spacing (production-ready per spec §12).
- [ ] **Step 5:** RTL tests: chip intersection (Mine∩Tournament etc.); badges render for each kind; a card with `canEdit=false` shows no edit actions; "owned by" renders the name.
- [ ] **Step 6:** `pnpm run smoke` for the settings page. **Step 7:** Commit.

---

### Task 7: Seed spread + final gates

**Files:**

- Modify: `scripts/seed-machine-settings.mjs` (or the settings seed module)

- [ ] **Step 1:** Seed a representative spread on a demo machine: an owner's default (owner-scoped, tournament), an owner set, a community public set, a community private draft, a second tournament community set. Drop the prototype's local `created_by`/demo-SQL tweaks.
- [ ] **Step 2:** `pnpm run db:reset` (local only) + verify the tab renders each bucket.
- [ ] **Step 3:** `pnpm run preflight`. Expected: green.
- [ ] **Step 4:** Commit.

---

## Self-review notes

- **Spec coverage:** §3 cols → T1; §2.2/§4 auth → T3; §5 query → T4; §6 actions (incl. remove preferred event, publish/tag/default, duplicate-carries-tag) → T5; §7 UI (buckets, badges, owned-by, collapsible) → T6; §8 migration → T1; §9 tests → T3/T4/T5/T6; seed → T7. No set cap: nothing to add (dropped).
- **Consistency:** helper names (`canViewSet`/`canEditSet`/`canSetOwnerDefault`) used identically in T3/T4/T5. `SettingsSetData.canEdit` produced in T4, consumed in T6.
- **Open exec-time decision to surface to Tim:** whether to rename `setPreferredSettingsSetAction` → `setOwnerDefaultAction` (clarity) or keep the name to minimize churn — decide at T5; low stakes.
