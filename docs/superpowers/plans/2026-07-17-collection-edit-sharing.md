# Collection Edit Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a collection owner grant specific signed-in users an **editor** role so they can change the collection's machines and name — account-based, no edit link.

**Architecture:** A new `collection_collaborators(collection_id, user_id, role)` join table backs a capability split: `canEditCollection` (owner OR editor → content edits) vs. the existing owner-only `canManageCollection` (delete / share-link / manage collaborators). The `/c/[id]` layout resolver computes both booleans; the collections list becomes grouped ("Your collections" / "Shared with you"); the owner-only Share dialog gains a "People with access" section.

**Tech Stack:** Next.js App Router (Server Components + server actions), Drizzle ORM (Postgres), Supabase SSR auth, Vitest (unit + PGlite integration), Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-07-17-collection-edit-sharing-design.md`
**Bead:** PP-wqit.7 · **Branch:** `feat/collection-edit-sharing` (already created off `origin/main`).

## Global Constraints

- **Drizzle migrations only** — `pnpm db:generate` + `pnpm db:migrate`; never `drizzle-kit push` (CORE-ARCH-009).
- **Type safety** — ts-strictest; no `any`, no `!`, no unsafe `as` (CORE-TS-007).
- **Path aliases** — always `~/` (CORE-TS-008).
- **Email privacy** — no user emails on any collaborator/collection surface; resolve/display by name only (CORE-SEC-007).
- **No side effects inside DB transactions** (CORE-ARCH-011).
- **Server Components default**; `"use client"` only on interaction leaves (CORE-ARCH-001).
- **`localhost`, never `127.0.0.1`** (CORE-SEC-008).
- Commit after every task. Run `pnpm run check` before any commit; run `pnpm run preflight` before the schema/action commits (migration + server-action changes).

**Test commands (targeted):**

- Unit: `pnpm exec vitest run --project unit <path>`
- Integration (PGlite): `pnpm exec vitest run --project integration <path>`
- E2E: `pnpm exec playwright test <spec> --project=chromium`

---

### Task 1: `collection_collaborators` table + migration

**Files:**

- Modify: `src/server/db/schema.ts` (collections block ~625–695, relations ~941+)
- Generate: `drizzle/00XX_*.sql` + `drizzle/meta/*` (whatever `db:generate` emits)

**Interfaces:**

- Produces: `collectionCollaborators` Drizzle table with columns `collectionId`, `userId`, `role`, `addedAt`, `addedBy`; PK `(collectionId, userId)`; index `idx_collection_collaborators_user` on `userId`.

- [ ] **Step 1: Add the table** after `collectionMachines` in `src/server/db/schema.ts`:

```ts
/**
 * Account-based edit sharing (PP-wqit.7). A row grants `user_id` the given
 * `role` on `collection_id`. MVP uses only 'editor' (may add owner-granted
 * 'viewer' later without a migration). Distinct from view_token (anonymous
 * read) and from a future saved_collections bookmark (self-added view-only).
 */
export const collectionCollaborators = pgTable(
  "collection_collaborators",
  {
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => userProfiles.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("editor"),
    addedAt: timestamp("added_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    addedBy: uuid("added_by").references(() => userProfiles.id, {
      onDelete: "set null",
    }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.collectionId, t.userId] }),
    userIdx: index("idx_collection_collaborators_user").on(t.userId),
  })
).enableRLS();
```

- [ ] **Step 2: Add relations.** Extend `collectionsRelations` (add `collaborators: many(collectionCollaborators)`) and add a new relations block:

```ts
export const collectionCollaboratorsRelations = relations(
  collectionCollaborators,
  ({ one }) => ({
    collection: one(collections, {
      fields: [collectionCollaborators.collectionId],
      references: [collections.id],
    }),
    user: one(userProfiles, {
      fields: [collectionCollaborators.userId],
      references: [userProfiles.id],
    }),
  })
);
```

- [ ] **Step 3: Generate the migration**

Run: `pnpm db:generate`
Expected: a new `drizzle/00XX_*.sql` creating `collection_collaborators` with the PK + index, plus updated `drizzle/meta`. Confirm the SQL matches the columns above.

- [ ] **Step 4: Apply + typecheck**

Run: `pnpm db:migrate && pnpm exec tsc --noEmit -p tsconfig.json`
Expected: migration applies clean; no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/server/db/schema.ts drizzle/
git commit -m "feat(collections): collection_collaborators table (PP-wqit.7)"
```

---

### Task 2: `canEditCollection` capability + unit tests

**Files:**

- Modify: `src/lib/collections/access.ts`
- Test: `src/lib/collections/access.test.ts`

**Interfaces:**

- Consumes: existing `canManageCollection(collection, viewer)`, `CollectionViewer`.
- Produces: `canEditCollection(collection: { owner: { id: string } }, viewer: CollectionViewer, isEditorCollaborator: boolean): boolean`.

- [ ] **Step 1: Write the failing tests** — append to `src/lib/collections/access.test.ts`:

```ts
describe("canEditCollection", () => {
  const collection = { owner: { id: "owner-1" } };

  it("allows the owner (regardless of collaborator flag)", () => {
    expect(canEditCollection(collection, { userId: "owner-1" }, false)).toBe(
      true
    );
  });
  it("allows a signed-in editor collaborator", () => {
    expect(canEditCollection(collection, { userId: "u-2" }, true)).toBe(true);
  });
  it("denies a signed-in non-collaborator", () => {
    expect(canEditCollection(collection, { userId: "u-3" }, false)).toBe(false);
  });
  it("denies an admin who is not owner/collaborator (no edit-any)", () => {
    expect(
      canEditCollection(collection, { userId: "a-1", role: "admin" }, false)
    ).toBe(false);
  });
  it("denies anonymous even if the flag is somehow true", () => {
    expect(canEditCollection(collection, {}, true)).toBe(false);
  });
});
```

Add `canEditCollection` to the existing import from `./access` at the top of the test file.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm exec vitest run --project unit src/lib/collections/access.test.ts`
Expected: FAIL — `canEditCollection is not a function`.

- [ ] **Step 3: Implement** — append to `src/lib/collections/access.ts`:

```ts
/**
 * Content edit (name + machines) is allowed for the owner OR a signed-in editor
 * collaborator (PP-wqit.7). `isEditorCollaborator` is resolved by the caller
 * (a membership-row lookup) so this stays pure. Admins do NOT get edit-any —
 * an admin edits a collection only via an explicit grant.
 */
export function canEditCollection(
  collection: { owner: { id: string } },
  viewer: CollectionViewer,
  isEditorCollaborator: boolean
): boolean {
  if (canManageCollection(collection, viewer)) return true;
  return viewer.userId !== undefined && isEditorCollaborator;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm exec vitest run --project unit src/lib/collections/access.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/collections/access.ts src/lib/collections/access.test.ts
git commit -m "feat(collections): canEditCollection capability (PP-wqit.7)"
```

---

### Task 3: Collaborator query helpers

**Files:**

- Create: `src/lib/collections/collaborators.ts`
- Test: `src/lib/collections/collaborators.test.ts`

**Interfaces:**

- Consumes: `db`, `DbTransaction`, schema `collectionCollaborators`, `userProfiles`.
- Produces:
  - `interface CollaboratorUser { id: string; name: string }`
  - `isEditorCollaborator(tx: DbTransaction, collectionId: string, userId: string | undefined): Promise<boolean>`
  - `getEditorCollaborators(tx: DbTransaction, collectionId: string): Promise<CollaboratorUser[]>`
  - `getGrantableMembers(tx: DbTransaction, excludeUserId: string): Promise<CollaboratorUser[]>`

- [ ] **Step 1: Write the failing tests** — `src/lib/collections/collaborators.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { getTestDb } from "~/test/helpers/pglite-test-db";
import {
  collections,
  collectionCollaborators,
  userProfiles,
} from "~/server/db/schema";
import {
  isEditorCollaborator,
  getEditorCollaborators,
  getGrantableMembers,
} from "./collaborators";

const db = getTestDb();

async function seedUser(id: string, name: string): Promise<void> {
  await db
    .insert(userProfiles)
    .values({ id, name, email: `${id}@t.co`, role: "member" });
}

describe("collaborators", () => {
  beforeEach(async () => {
    await db.delete(collectionCollaborators);
    await db.delete(collections);
    await db.delete(userProfiles);
    await seedUser("owner-1", "Owner One");
    await seedUser("ed-1", "Editor One");
    await seedUser("m-1", "Member One");
    await db
      .insert(collections)
      .values({ id: "c-1", name: "C1", ownerId: "owner-1" });
    await db.insert(collectionCollaborators).values({
      collectionId: "c-1",
      userId: "ed-1",
      role: "editor",
      addedBy: "owner-1",
    });
  });

  it("isEditorCollaborator: true for a granted editor, false otherwise", async () => {
    expect(await isEditorCollaborator(db, "c-1", "ed-1")).toBe(true);
    expect(await isEditorCollaborator(db, "c-1", "m-1")).toBe(false);
    expect(await isEditorCollaborator(db, "c-1", undefined)).toBe(false);
  });

  it("getEditorCollaborators: returns granted editors by name", async () => {
    const rows = await getEditorCollaborators(db, "c-1");
    expect(rows).toEqual([{ id: "ed-1", name: "Editor One" }]);
  });

  it("getGrantableMembers: all members except the excluded user", async () => {
    const rows = await getGrantableMembers(db, "owner-1");
    expect(rows.map((r) => r.id).sort()).toEqual(["ed-1", "m-1"]);
    expect(rows.some((r) => r.id === "owner-1")).toBe(false);
  });
});
```

(If `~/test/helpers/pglite-test-db` differs, match the import used by `src/lib/collections/summary.test.ts` — mirror that file's DB-setup helper.)

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm exec vitest run --project integration src/lib/collections/collaborators.test.ts`
Expected: FAIL — module `./collaborators` not found.

- [ ] **Step 3: Implement** — `src/lib/collections/collaborators.ts`:

```ts
import { and, asc, eq } from "drizzle-orm";
import { db, type DbTransaction } from "~/server/db";
import { collectionCollaborators, userProfiles } from "~/server/db/schema";

export interface CollaboratorUser {
  id: string;
  name: string;
}

/** True iff `userId` holds an editor row on `collectionId`. */
export async function isEditorCollaborator(
  tx: DbTransaction = db,
  collectionId: string,
  userId: string | undefined
): Promise<boolean> {
  if (userId === undefined) return false;
  const row = await tx.query.collectionCollaborators.findFirst({
    where: and(
      eq(collectionCollaborators.collectionId, collectionId),
      eq(collectionCollaborators.userId, userId),
      eq(collectionCollaborators.role, "editor")
    ),
    columns: { userId: true },
  });
  return row !== undefined;
}

/** Editor collaborators on a collection, id + name, alphabetical. */
export async function getEditorCollaborators(
  tx: DbTransaction = db,
  collectionId: string
): Promise<CollaboratorUser[]> {
  const rows = await tx
    .select({ id: userProfiles.id, name: userProfiles.name })
    .from(collectionCollaborators)
    .innerJoin(
      userProfiles,
      eq(userProfiles.id, collectionCollaborators.userId)
    )
    .where(
      and(
        eq(collectionCollaborators.collectionId, collectionId),
        eq(collectionCollaborators.role, "editor")
      )
    )
    .orderBy(asc(userProfiles.name));
  return rows;
}

/** All registered members except `excludeUserId` (the owner), id + name. */
export async function getGrantableMembers(
  tx: DbTransaction = db,
  excludeUserId: string
): Promise<CollaboratorUser[]> {
  const rows = await tx
    .select({ id: userProfiles.id, name: userProfiles.name })
    .from(userProfiles)
    .orderBy(asc(userProfiles.name));
  return rows.filter((r) => r.id !== excludeUserId);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm exec vitest run --project integration src/lib/collections/collaborators.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/collections/collaborators.ts src/lib/collections/collaborators.test.ts
git commit -m "feat(collections): collaborator query helpers (PP-wqit.7)"
```

---

### Task 4: Widen `updateCollectionAction` + add/remove collaborator actions

**Files:**

- Modify: `src/app/(app)/c/collections/actions.ts`
- Test: `src/test/integration/collections-actions.test.ts`

**Interfaces:**

- Consumes: `canEditCollection` (Task 2), `isEditorCollaborator` (Task 3), existing `resolveActor`, `loadOwner`, `canManageCollection`.
- Produces:
  - `addCollectionCollaboratorAction(input: { collectionId: string; userId: string }): Promise<ActionResult>`
  - `removeCollectionCollaboratorAction(input: { collectionId: string; userId: string }): Promise<ActionResult>`
  - `updateCollectionAction` gate widened to owner-OR-editor.

- [ ] **Step 1: Write the failing tests** — add to `src/test/integration/collections-actions.test.ts` (mirror the existing describe/setup in that file; it already vi.mocks the production db to PGlite and seeds users/collections):

```ts
it("updateCollectionAction: an editor collaborator can edit machines; a stranger cannot", async () => {
  // owner creates collection c with machine m1 (use existing seed helpers)
  await db.insert(collectionCollaborators).values({
    collectionId: c.id,
    userId: editorUser.id,
    role: "editor",
    addedBy: owner.id,
  });
  mockActor(editorUser); // set resolveActor()/auth.getUser() to the editor
  const ok = await updateCollectionAction({
    collectionId: c.id,
    name: "Renamed",
    machineIds: [m2.id],
  });
  expect(ok.success).toBe(true);

  mockActor(strangerUser);
  const denied = await updateCollectionAction({
    collectionId: c.id,
    name: "Nope",
    machineIds: [],
  });
  expect(denied).toEqual({ success: false, error: "Forbidden" });
});

it("addCollectionCollaboratorAction: owner-only, idempotent", async () => {
  mockActor(owner);
  expect(
    (
      await addCollectionCollaboratorAction({
        collectionId: c.id,
        userId: editorUser.id,
      })
    ).success
  ).toBe(true);
  // idempotent second call
  expect(
    (
      await addCollectionCollaboratorAction({
        collectionId: c.id,
        userId: editorUser.id,
      })
    ).success
  ).toBe(true);
  const rows = await db
    .select()
    .from(collectionCollaborators)
    .where(eq(collectionCollaborators.collectionId, c.id));
  expect(rows).toHaveLength(1);

  mockActor(editorUser); // non-owner
  const denied = await addCollectionCollaboratorAction({
    collectionId: c.id,
    userId: strangerUser.id,
  });
  expect(denied).toEqual({ success: false, error: "Forbidden" });
});

it("removeCollectionCollaboratorAction: owner removes; editor immediately loses edit", async () => {
  await db.insert(collectionCollaborators).values({
    collectionId: c.id,
    userId: editorUser.id,
    role: "editor",
    addedBy: owner.id,
  });
  mockActor(owner);
  expect(
    (
      await removeCollectionCollaboratorAction({
        collectionId: c.id,
        userId: editorUser.id,
      })
    ).success
  ).toBe(true);
  mockActor(editorUser);
  const denied = await updateCollectionAction({
    collectionId: c.id,
    name: "X",
    machineIds: [],
  });
  expect(denied).toEqual({ success: false, error: "Forbidden" });
});
```

Use the file's existing actor-mock mechanism and seed helpers rather than inventing new ones — match how the current tests in this file drive `resolveActor` (via the mocked Supabase `auth.getUser`). Add `collectionCollaborators` to the schema import and `addCollectionCollaboratorAction` / `removeCollectionCollaboratorAction` to the actions import.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm exec vitest run --project integration src/test/integration/collections-actions.test.ts`
Expected: FAIL — the two new actions are undefined; editor-edit currently Forbidden.

- [ ] **Step 3a: Widen `updateCollectionAction`.** In `src/app/(app)/c/collections/actions.ts`, add imports:

```ts
import {
  canEditCollection,
  canManageCollection,
} from "~/lib/collections/access";
import { isEditorCollaborator } from "~/lib/collections/collaborators";
import {
  collections,
  collectionMachines,
  collectionCollaborators,
  machines,
  userProfiles,
} from "~/server/db/schema";
```

Replace the gate block in `updateCollectionAction` (currently `canManageCollection`) with:

```ts
const collection = await loadOwner(input.collectionId);
if (!collection) return { success: false, error: "Not found" };
const canEdit = canEditCollection(
  collection,
  { userId: actor.userId },
  await isEditorCollaborator(db, input.collectionId, actor.userId)
);
if (!canEdit) return { success: false, error: "Forbidden" };
```

- [ ] **Step 3b: Add the two collaborator actions** at the end of the file:

```ts
const collaboratorSchema = z.object({
  collectionId: z.uuid(),
  userId: z.uuid(),
});

/** Grant a member editor access. Owner-only (managing access). Idempotent. */
export async function addCollectionCollaboratorAction(input: {
  collectionId: string;
  userId: string;
}): Promise<ActionResult> {
  const actor = await resolveActor();
  if (!actor) return { success: false, error: "Not authenticated" };
  const parsed = collaboratorSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid request" };

  const collection = await loadOwner(parsed.data.collectionId);
  if (!collection) return { success: false, error: "Not found" };
  if (!canManageCollection(collection, { userId: actor.userId })) {
    return { success: false, error: "Forbidden" };
  }
  if (parsed.data.userId === collection.owner.id) {
    return { success: false, error: "The owner already has full access" };
  }
  const target = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, parsed.data.userId),
    columns: { id: true },
  });
  if (!target) return { success: false, error: "Unknown user" };

  await db
    .insert(collectionCollaborators)
    .values({
      collectionId: parsed.data.collectionId,
      userId: parsed.data.userId,
      role: "editor",
      addedBy: actor.userId,
    })
    .onConflictDoNothing();

  revalidatePath(`/c/${parsed.data.collectionId}`);
  revalidatePath("/c/collections");
  return { success: true };
}

/** Revoke a collaborator's access. Owner-only. */
export async function removeCollectionCollaboratorAction(input: {
  collectionId: string;
  userId: string;
}): Promise<ActionResult> {
  const actor = await resolveActor();
  if (!actor) return { success: false, error: "Not authenticated" };
  const parsed = collaboratorSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Invalid request" };

  const collection = await loadOwner(parsed.data.collectionId);
  if (!collection) return { success: false, error: "Not found" };
  if (!canManageCollection(collection, { userId: actor.userId })) {
    return { success: false, error: "Forbidden" };
  }

  await db
    .delete(collectionCollaborators)
    .where(
      and(
        eq(collectionCollaborators.collectionId, parsed.data.collectionId),
        eq(collectionCollaborators.userId, parsed.data.userId)
      )
    );

  revalidatePath(`/c/${parsed.data.collectionId}`);
  revalidatePath("/c/collections");
  return { success: true };
}
```

`loadOwner` already returns `{ owner: { id } }`; confirm `and`/`eq` are imported (they are).

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm exec vitest run --project integration src/test/integration/collections-actions.test.ts`
Expected: PASS (existing + 3 new).

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/c/collections/actions.ts" src/test/integration/collections-actions.test.ts
git commit -m "feat(collections): editor-gated update + grant/revoke actions (PP-wqit.7)"
```

---

### Task 5: Grouped collections list (query + page)

**Files:**

- Modify: `src/lib/collections/list.ts`
- Modify: `src/app/(app)/c/collections/page.tsx`
- Test: `src/lib/collections/list.test.ts` (create if absent)

**Interfaces:**

- Consumes: schema `collections`, `collectionMachines`, `collectionCollaborators`, `userProfiles`.
- Produces:
  - `interface SharedCollectionListItem { id: string; name: string; machineCount: number; ownerName: string }`
  - `getSharedWithMe(tx: DbTransaction, userId: string): Promise<SharedCollectionListItem[]>`
  - (existing `getMyCollections` unchanged.)

- [ ] **Step 1: Write the failing test** — `src/lib/collections/list.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { getTestDb } from "~/test/helpers/pglite-test-db";
import {
  collections,
  collectionCollaborators,
  userProfiles,
} from "~/server/db/schema";
import { getSharedWithMe } from "./list";

const db = getTestDb();

describe("getSharedWithMe", () => {
  beforeEach(async () => {
    await db.delete(collectionCollaborators);
    await db.delete(collections);
    await db.delete(userProfiles);
    await db.insert(userProfiles).values([
      { id: "owner-1", name: "Owner One", email: "o@t.co", role: "member" },
      { id: "me", name: "Me", email: "me@t.co", role: "member" },
    ]);
    await db
      .insert(collections)
      .values({ id: "c-1", name: "Shared C", ownerId: "owner-1" });
    await db.insert(collectionCollaborators).values({
      collectionId: "c-1",
      userId: "me",
      role: "editor",
      addedBy: "owner-1",
    });
  });

  it("returns collections shared with the user, with owner name", async () => {
    const rows = await getSharedWithMe(db, "me");
    expect(rows).toEqual([
      { id: "c-1", name: "Shared C", machineCount: 0, ownerName: "Owner One" },
    ]);
  });

  it("excludes collections the user only owns", async () => {
    const rows = await getSharedWithMe(db, "owner-1");
    expect(rows).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm exec vitest run --project integration src/lib/collections/list.test.ts`
Expected: FAIL — `getSharedWithMe` not exported.

- [ ] **Step 3: Implement** — add to `src/lib/collections/list.ts` (extend imports: `and`, plus `collectionCollaborators`, `userProfiles`):

```ts
export interface SharedCollectionListItem {
  id: string;
  name: string;
  machineCount: number;
  ownerName: string;
}

/** Collections where `userId` is an editor collaborator (not owner). */
export async function getSharedWithMe(
  tx: DbTransaction = db,
  userId: string
): Promise<SharedCollectionListItem[]> {
  const rows = await tx
    .select({
      id: collections.id,
      name: collections.name,
      ownerName: userProfiles.name,
      machineCount: count(collectionMachines.machineId),
    })
    .from(collectionCollaborators)
    .innerJoin(
      collections,
      eq(collections.id, collectionCollaborators.collectionId)
    )
    .innerJoin(userProfiles, eq(userProfiles.id, collections.ownerId))
    .leftJoin(
      collectionMachines,
      eq(collectionMachines.collectionId, collections.id)
    )
    .where(
      and(
        eq(collectionCollaborators.userId, userId),
        eq(collectionCollaborators.role, "editor")
      )
    )
    .groupBy(collections.id, collections.name, userProfiles.name)
    .orderBy(asc(collections.name));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    machineCount: Number(r.machineCount),
    ownerName: r.ownerName,
  }));
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm exec vitest run --project integration src/lib/collections/list.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Render the grouped page.** In `src/app/(app)/c/collections/page.tsx`, fetch both lists and render two sections. Replace the single `getMyCollections` fetch and the list markup:

```tsx
import { getMyCollections, getSharedWithMe } from "~/lib/collections/list";
// ...
const [owned, shared, allMachines] = await Promise.all([
  getMyCollections(undefined, user.id),
  getSharedWithMe(undefined, user.id),
  db.query.machines.findMany({
    columns: { id: true, initials: true, name: true },
    orderBy: [asc(machinesTable.name)],
  }),
]);
```

Replace the body below `<PageHeader … />` with:

```tsx
{
  owned.length === 0 && shared.length === 0 ? (
    <p className="py-8 text-center text-sm text-muted-foreground">
      You haven&apos;t created any collections yet. Create one to get started.
    </p>
  ) : (
    <div className="space-y-8">
      <section>
        <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Your collections
        </h2>
        {owned.length === 0 ? (
          <p className="px-1 py-2 text-sm text-muted-foreground">
            You haven&apos;t created any collections yet.
          </p>
        ) : (
          <ul className="divide-y divide-outline-variant rounded-md border border-outline-variant">
            {owned.map((collection) => (
              <li key={collection.id}>
                <Link
                  href={`/c/${collection.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-surface-variant"
                >
                  <span className="font-medium text-foreground">
                    {collection.name}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {collection.machineCount}{" "}
                    {collection.machineCount === 1 ? "machine" : "machines"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {shared.length > 0 && (
        <section>
          <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Shared with you
          </h2>
          <ul className="divide-y divide-outline-variant rounded-md border border-outline-variant">
            {shared.map((collection) => (
              <li key={collection.id}>
                <Link
                  href={`/c/${collection.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-surface-variant"
                >
                  <span className="min-w-0">
                    <span className="block font-medium text-foreground">
                      {collection.name}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      Shared by {collection.ownerName}
                      <span className="ml-2 rounded-full bg-secondary-container px-2 py-0.5 text-[11px] font-semibold text-on-secondary-container">
                        Editor
                      </span>
                    </span>
                  </span>
                  <span className="shrink-0 text-sm text-muted-foreground">
                    {collection.machineCount}{" "}
                    {collection.machineCount === 1 ? "machine" : "machines"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Verify build/typecheck + smoke**

Run: `pnpm run check`
Expected: PASS. (Optional visual: `pnpm run smoke`.)

- [ ] **Step 7: Commit**

```bash
git add src/lib/collections/list.ts src/lib/collections/list.test.ts "src/app/(app)/c/collections/page.tsx"
git commit -m "feat(collections): grouped list with shared-with-you section (PP-wqit.7)"
```

---

### Task 6: Resolver `viewerCanEdit` + layout split + `canDelete` prop

**Files:**

- Modify: `src/app/(app)/c/[id]/_data.ts`
- Modify: `src/app/(app)/c/[id]/(tabs)/layout.tsx`
- Modify: `src/components/collections/EditCollectionDialog.tsx`
- Test: `src/components/collections/EditCollectionDialog.test.tsx`

**Interfaces:**

- Consumes: `canEditCollection`, `isEditorCollaborator`, existing `getCollectionForLayout`.
- Produces: `CollectionForLayout.viewerCanEdit: boolean`; `EditCollectionDialog` gains `canDelete: boolean`.

- [ ] **Step 1: Add `viewerCanEdit` to the resolver.** In `src/app/(app)/c/[id]/_data.ts`: import `canEditCollection` from `~/lib/collections/access` and `isEditorCollaborator` from `~/lib/collections/collaborators`; add `viewerCanEdit: boolean` to the `CollectionForLayout` interface with a doc line; then on BOTH resolver paths compute it. uuid path:

```ts
const collection = await getCollection(undefined, handle);
if (!collection) return null;
if (!canViewCollection(collection, viewer)) return null;
const isEditor = await isEditorCollaborator(db, collection.id, viewer.userId);
return {
  collection,
  viewerCanManage: canManageCollection(collection, viewer),
  viewerCanEdit: canEditCollection(collection, viewer, isEditor),
  handle,
  viaViewToken: false,
};
```

token path:

```ts
const collection = await getCollectionByViewToken(undefined, handle);
if (!collection) return null;
const isEditor = await isEditorCollaborator(db, collection.id, viewer.userId);
return {
  collection,
  viewerCanManage: canManageCollection(collection, viewer),
  viewerCanEdit: canEditCollection(collection, viewer, isEditor),
  handle,
  viaViewToken: true,
};
```

- [ ] **Step 2: Add the `canDelete` prop to `EditCollectionDialog`.** In `src/components/collections/EditCollectionDialog.tsx`: add `canDelete: boolean` to `Props`, destructure it, and wrap the `<AlertDialog>…</AlertDialog>` delete block in `{canDelete && ( … )}`. Update the doc comment to note delete is owner-only.

- [ ] **Step 3: Update the RTL test.** In `src/components/collections/EditCollectionDialog.test.tsx`, pass `canDelete` in existing renders, and add:

```ts
it("hides the delete control when canDelete is false (editor)", async () => {
  render(<EditCollectionDialog collectionId="c1" currentName="C" allMachines={[]} currentIds={[]} canDelete={false} />);
  await userEvent.click(screen.getByTestId("collection-edit-trigger"));
  expect(screen.queryByTestId("collection-delete-trigger")).not.toBeInTheDocument();
});
```

Run: `pnpm exec vitest run --project unit src/components/collections/EditCollectionDialog.test.tsx`
Expected: FAIL first (prop required / delete still shown), then PASS after Step 2. If existing tests error on the missing required prop, add `canDelete` to their renders (owner default `canDelete`).

- [ ] **Step 4: Split the layout.** In `src/app/(app)/c/[id]/(tabs)/layout.tsx`, import `getEditorCollaborators`, `getGrantableMembers` from `~/lib/collections/collaborators` and `db` from `~/server/db`; replace the `if (data.viewerCanManage)` block:

```tsx
let headerAction: React.ReactNode = null;
if (data.viewerCanEdit) {
  const allMachines = await getPickerMachines();
  let sharePanel: React.ReactNode = null;
  if (data.viewerCanManage) {
    const [editors, grantableMembers] = await Promise.all([
      getEditorCollaborators(db, data.collection.id),
      getGrantableMembers(db, data.collection.owner.id),
    ]);
    sharePanel = (
      <CollectionShareDialog
        collectionId={data.collection.id}
        viewToken={data.collection.viewToken}
        ownerName={data.collection.owner.name}
        editors={editors}
        grantableMembers={grantableMembers}
      />
    );
  }
  headerAction = (
    <div className="flex items-center gap-2">
      {sharePanel}
      <EditCollectionDialog
        collectionId={data.collection.id}
        currentName={data.collection.name}
        allMachines={allMachines}
        currentIds={data.collection.machines.map((m) => m.id)}
        canDelete={data.viewerCanManage}
      />
    </div>
  );
}
```

(The new `CollectionShareDialog` props land in Task 7; this compiles once Task 7's prop additions exist — do Step 5 typecheck after Task 7 if needed, or stub the three new props as optional there first. To keep this task green on its own, add the three props to `CollectionShareDialog` as part of Task 7 immediately after.)

- [ ] **Step 5: Typecheck**

Run: `pnpm exec tsc --noEmit -p tsconfig.json`
Expected: PASS once Task 7's prop signature is in place. If running Task 6 alone, temporarily keep the `CollectionShareDialog` call to its old two props and add `ownerName/editors/grantableMembers` in Task 7 together with the layout wiring — commit Tasks 6 and 7 together if that's cleaner.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(app)/c/[id]/_data.ts" "src/app/(app)/c/[id]/(tabs)/layout.tsx" src/components/collections/EditCollectionDialog.tsx src/components/collections/EditCollectionDialog.test.tsx
git commit -m "feat(collections): viewerCanEdit resolver + owner-only delete/share split (PP-wqit.7)"
```

---

### Task 7: Share dialog "People with access" section

**Files:**

- Create: `src/components/collections/CollectionCollaborators.tsx`
- Modify: `src/components/collections/CollectionShareDialog.tsx`
- Test: `src/components/collections/CollectionCollaborators.test.tsx`

**Interfaces:**

- Consumes: `addCollectionCollaboratorAction`, `removeCollectionCollaboratorAction` (Task 4).
- Produces:
  - `CollectionCollaborators` client component, props `{ collectionId: string; ownerName: string; editors: CollaboratorUser[]; grantableMembers: CollaboratorUser[] }`.
  - `CollectionShareDialog` gains props `ownerName: string; editors: CollaboratorUser[]; grantableMembers: CollaboratorUser[]` (imported `CollaboratorUser` type from `~/lib/collections/collaborators`).

- [ ] **Step 1: Write the failing RTL test** — `src/components/collections/CollectionCollaborators.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CollectionCollaborators } from "./CollectionCollaborators";

const add = vi.fn();
const remove = vi.fn();
vi.mock("~/app/(app)/c/collections/actions", () => ({
  addCollectionCollaboratorAction: (i: unknown) => add(i),
  removeCollectionCollaboratorAction: (i: unknown) => remove(i),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const members = [
  { id: "m-1", name: "Alpha" },
  { id: "m-2", name: "Bravo" },
];

describe("CollectionCollaborators", () => {
  beforeEach(() => {
    add.mockReset();
    remove.mockReset();
  });

  it("lists the owner and current editors, excludes them from the picker", async () => {
    add.mockResolvedValue({ success: true });
    render(
      <CollectionCollaborators
        collectionId="c1"
        ownerName="Owner"
        editors={[{ id: "m-1", name: "Alpha" }]}
        grantableMembers={members}
      />
    );
    expect(screen.getByText(/Owner/)).toBeInTheDocument();
    expect(screen.getByText("Alpha")).toBeInTheDocument();

    await userEvent.click(screen.getByTestId("collab-add-trigger"));
    // Alpha is already an editor -> not offered; Bravo is.
    expect(screen.queryByTestId("collab-option-m-1")).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId("collab-option-m-2"));
    await waitFor(() =>
      expect(add).toHaveBeenCalledWith({ collectionId: "c1", userId: "m-2" })
    );
  });

  it("removes an editor", async () => {
    remove.mockResolvedValue({ success: true });
    render(
      <CollectionCollaborators
        collectionId="c1"
        ownerName="Owner"
        editors={[{ id: "m-1", name: "Alpha" }]}
        grantableMembers={members}
      />
    );
    await userEvent.click(screen.getByTestId("collab-remove-m-1"));
    await waitFor(() =>
      expect(remove).toHaveBeenCalledWith({ collectionId: "c1", userId: "m-1" })
    );
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm exec vitest run --project unit src/components/collections/CollectionCollaborators.test.tsx`
Expected: FAIL — component not found.

- [ ] **Step 3: Implement the component** — `src/components/collections/CollectionCollaborators.tsx`:

```tsx
"use client";

import type React from "react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { X } from "lucide-react";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Button } from "~/components/ui/button";
import type { CollaboratorUser } from "~/lib/collections/collaborators";
import {
  addCollectionCollaboratorAction,
  removeCollectionCollaboratorAction,
} from "~/app/(app)/c/collections/actions";

interface Props {
  collectionId: string;
  ownerName: string;
  editors: CollaboratorUser[];
  grantableMembers: CollaboratorUser[];
}

function Avatar({ name }: { name: string }): React.JSX.Element {
  return (
    <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs text-muted-foreground">
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

export function CollectionCollaborators({
  collectionId,
  ownerName,
  editors: initialEditors,
  grantableMembers,
}: Props): React.JSX.Element {
  const router = useRouter();
  const [editors, setEditors] = useState<CollaboratorUser[]>(initialEditors);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const editorIds = useMemo(() => new Set(editors.map((e) => e.id)), [editors]);
  const available = useMemo(
    () => grantableMembers.filter((m) => !editorIds.has(m.id)),
    [grantableMembers, editorIds]
  );

  function add(user: CollaboratorUser): void {
    setError(null);
    setOpen(false);
    startTransition(async () => {
      const result = await addCollectionCollaboratorAction({
        collectionId,
        userId: user.id,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setEditors((prev) =>
        [...prev, user].sort((a, b) => a.name.localeCompare(b.name))
      );
      router.refresh();
    });
  }

  function remove(userId: string): void {
    setError(null);
    startTransition(async () => {
      const result = await removeCollectionCollaboratorAction({
        collectionId,
        userId,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setEditors((prev) => prev.filter((e) => e.id !== userId));
      router.refresh();
    });
  }

  return (
    <div>
      <p className="text-sm font-semibold">People with access</p>
      <p className="mb-2 text-xs text-muted-foreground">
        Editors can add or remove machines and rename this collection. They
        can&apos;t delete it, change the share link, or manage this list.
      </p>

      <div className="max-h-[196px] space-y-1 overflow-y-auto">
        <div className="flex items-center gap-2 py-1">
          <Avatar name={ownerName} />
          <span className="flex-1 text-sm font-medium">
            {ownerName} (owner)
          </span>
        </div>
        {editors.map((e) => (
          <div key={e.id} className="flex items-center gap-2 py-1">
            <Avatar name={e.name} />
            <span className="flex-1 text-sm">{e.name}</span>
            <button
              type="button"
              onClick={() => remove(e.id)}
              disabled={pending}
              aria-label={`Remove ${e.name}`}
              data-testid={`collab-remove-${e.id}`}
              className="rounded-md p-1 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            data-testid="collab-add-trigger"
            disabled={pending}
          >
            Add people
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-0">
          <Command>
            <CommandInput
              placeholder="Search members…"
              aria-label="Search members"
            />
            <CommandList>
              <CommandGroup>
                {available.length === 0 ? (
                  <p className="px-2 py-2 text-xs text-muted-foreground">
                    No members to add.
                  </p>
                ) : (
                  available.map((m) => (
                    <CommandItem
                      key={m.id}
                      value={m.name}
                      onSelect={() => add(m)}
                      data-testid={`collab-option-${m.id}`}
                    >
                      <Avatar name={m.name} />
                      <span className="ml-2">{m.name}</span>
                    </CommandItem>
                  ))
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {error && (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
```

(`Command` here uses its default fuzzy filtering on `value={m.name}`, so the search box works without manual filtering. Confirm `~/components/ui/command` exports `Command/CommandInput/CommandList/CommandGroup/CommandItem` — it does, per `AssigneePicker`.)

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm exec vitest run --project unit src/components/collections/CollectionCollaborators.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Wire it into `CollectionShareDialog`.** Add the three props + import, and render the section under the view-link block (after the `{enabled && …}` link row, before the error `<p>`):

```tsx
import type { CollaboratorUser } from "~/lib/collections/collaborators";
import { CollectionCollaborators } from "./CollectionCollaborators";
// Props:
//   ownerName: string;
//   editors: CollaboratorUser[];
//   grantableMembers: CollaboratorUser[];
```

```tsx
        <div className="h-px bg-border" />
        <CollectionCollaborators
          collectionId={collectionId}
          ownerName={ownerName}
          editors={editors}
          grantableMembers={grantableMembers}
        />
```

Update `src/components/collections/CollectionShareDialog.test.tsx`: add the three new props (`ownerName="You"`, `editors={[]}`, `grantableMembers={[]}`) to each `render(...)` so existing tests still compile/pass.

- [ ] **Step 6: Full check + smoke**

Run: `pnpm run check && pnpm run smoke`
Expected: PASS (types resolve now that both Task 6 and Task 7 props align; smoke renders collection pages without 500).

- [ ] **Step 7: Commit**

```bash
git add src/components/collections/CollectionCollaborators.tsx src/components/collections/CollectionCollaborators.test.tsx src/components/collections/CollectionShareDialog.tsx src/components/collections/CollectionShareDialog.test.tsx
git commit -m "feat(collections): People-with-access section in Share dialog (PP-wqit.7)"
```

---

### Task 8: E2E — grant → edit → revoke journey

**Files:**

- Create: `e2e/collections-edit-sharing.spec.ts`

**Interfaces:**

- Consumes: existing E2E auth/seed helpers (mirror an existing collections spec, e.g. `e2e/` collection view-sharing spec from Wave 0b).

- [ ] **Step 1: Write the spec.** Mirror the existing collections E2E spec's fixtures/login helpers. Journey:
  1. Sign in as the owner (admin seed user), open a collection, open Share, add a member as editor (search + select in the picker), assert the editor row appears.
  2. Sign in as that editor (fresh context), open `/c/collections`, assert the collection appears under "Shared with you" with an "Editor" badge; open it; assert the **Edit** control is present and **Share** is absent.
  3. As the editor, open Edit, add a machine, save; assert the machine count updated.
  4. Back as the owner, open Share, remove the editor.
  5. As the (now-removed) editor, reload the collection; assert it 404s / is gone from "Shared with you".

Use `data-testid`s already defined: `collection-share-trigger`, `collab-add-trigger`, `collab-option-<id>`, `collab-remove-<id>`, `collection-edit-trigger`, `collection-save`.

- [ ] **Step 2: Run the spec**

Run: `pnpm exec playwright test e2e/collections-edit-sharing.spec.ts --project=chromium`
Expected: PASS. (If fixtures are missing, run the whole file — E2E specs share `beforeAll` seed state.)

- [ ] **Step 3: Commit**

```bash
git add e2e/collections-edit-sharing.spec.ts
git commit -m "test(collections): e2e grant/edit/revoke edit-sharing journey (PP-wqit.7)"
```

---

## Final: preflight + PR

- [ ] Run `pnpm run preflight` (migration + server actions + schema changed → full gate).
- [ ] Push branch; open PR **ready-for-review** (`pinpoint-pr-workflow` Phase 2).
- [ ] Post UI screenshots (`scripts/workflow/pr-screenshots.mjs`) — this PR touches collection UI.
- [ ] Let CI run; satisfy the `reviewed` gate (Copilot out of quota → `/code-review` + `mark-claude-review.sh`).
- [ ] Hand Tim: `! scripts/workflow/merge-pr.sh <PR> --human`. Do NOT merge yourself.
- [ ] After merge: update PP-wqit.7 `--notes` (PR #, migration state) and close it; PP-wqit.10 / PP-wqit.11 unblock.

## Self-review notes

- **Spec coverage:** table (T1), `canEditCollection` (T2), collaborator helpers (T3), widened action + grant/revoke (T4), grouped list (T5), resolver `viewerCanEdit` + layout split + owner-only delete (T6), People-with-access UI (T7), E2E (T8). Admins-not-edit-any is enforced by T2's function (no admin branch) and tested there. Description-editing is explicitly deferred (PP-wqit.11) — not in any task.
- **Cross-task types:** `CollaboratorUser {id,name}` defined in T3, consumed by T5's separate `SharedCollectionListItem` and T7's props; `viewerCanEdit` added in T6 consumes T2+T3; `canDelete` prop defined + consumed in T6, used by tests in T6.
- **Ordering caveat:** T6 and T7 both change `CollectionShareDialog`'s call/signature. If executed by separate subagents, run them in order (T6 then T7) or fold the `CollectionShareDialog` prop addition into whichever lands first; the plan notes this inline.
