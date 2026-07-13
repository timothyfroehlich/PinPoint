# Sharable Collections — Wave 0a (Private Collections) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a member+ user create private, owner-only collections of arbitrary machines and view aggregate Overview / Issues / Timeline for that set at `/c/collection/[id]`, reusing the existing `/c/` view via a new resolver.

**Architecture:** Two new Drizzle tables (`collections`, `collection_machines`). A new `getCollection` resolver returns a `UserCollection` whose `machines: CollectionMachine[]` are consumed unchanged by the existing `summarizeCollection`, `CollectionOverviewTable`, issues-list scoping, and `getMachineTimeline`. Route files under `/c/collection/[id]` mirror the existing `/c/owner/[userId]` ones. Authorization (owner-or-admin view; owner-only manage) lives in a pure, unit-tested `access.ts` helper composed by the route's cached `_data` loader. Sharing (view/edit link tokens) is **Wave 0b** — this slice is private, owner-only.

**Tech Stack:** Next.js App Router (Server Components default), Drizzle ORM + Postgres, Supabase SSR auth, Zod, Vitest + PGlite (worker-scoped) integration tests, shadcn/ui `MultiSelect`, Tailwind v4.

**Bead:** PP-wqit.1 · **Epic:** PP-wqit · **Spec:** `docs/superpowers/specs/2026-07-13-sharable-collections-design.md` · **Branch:** `feat/sharable-collections`

## Global Constraints

Every task's requirements implicitly include these (verbatim from spec + AGENTS.md §2):

- **Drizzle migrations only** (CORE-ARCH-009): `pnpm run db:generate` + `pnpm run db:migrate`. Never `drizzle-kit push`. After any schema change also run `pnpm run test:_generate-schema` to regenerate the PGlite test schema.
- **ts-strictest** (CORE-TS-007): no `any`, no non-null `!`, no unsafe `as`. **Path aliases** (CORE-TS-008): always `~/`.
- **Server Components by default** (CORE-ARCH-001); `"use client"` only on interaction leaves. **Progressive enhancement** (CORE-ARCH-002): `<form action={serverAction}>`, no inline handlers for the primary path.
- **Supabase SSR** (CORE-SSR-001/002): `createClient()` → `auth.getUser()` immediately.
- **Permissions via the matrix** (CORE-ARCH-008): role gates through `checkPermission()`; the help page auto-generates from `matrix.ts`. Row-level ownership is checked in the action beside the matrix call.
- **Email privacy** (CORE-SEC-007): owner shown by **name only**, never email.
- **Denied access → `notFound()` (404), never 403** — do not reveal a private collection's existence.
- **Timestamps**: `timestamp(col, { withTimezone: true }).notNull().defaultNow()`. No Drizzle `$onUpdate`; set `updatedAt` explicitly in every mutating action.
- **Run `pnpm run preflight`** before pushing (this slice changes DB schema + server actions).

---

### Task 1: Schema — `collections` + `collection_machines` tables

**Files:**

- Modify: `src/server/db/schema.ts` (add two `pgTable` blocks + two `relations` blocks; extend `userProfilesRelations` and `machinesRelations`)
- Generate: `drizzle/NNNN_*.sql` (via `db:generate`)
- Regenerate: `src/test/setup/schema.sql` (via `test:_generate-schema`)

**Interfaces:**

- Produces: `collections` table (`id`, `name`, `description`, `ownerId`, `createdAt`, `updatedAt`); `collectionMachines` join (`collectionId`, `machineId`, `addedAt`, `addedBy`, composite PK). No share-token columns — those are Wave 0b.

- [ ] **Step 1: Add the two tables to `schema.ts`.** Place after `machineSettingsSets` (keep related tables together). `ProseMirrorDoc` and the `jsonb`/`uuid`/`text`/`timestamp`/`index`/`primaryKey` imports already exist in this file.

```ts
export const collections = pgTable(
  "collections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: jsonb("description").$type<ProseMirrorDoc>(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => userProfiles.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // No Drizzle $onUpdate — every UPDATE sets this explicitly in the action.
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    ownerIdx: index("idx_collections_owner_id").on(t.ownerId),
  })
).enableRLS();

export const collectionMachines = pgTable(
  "collection_machines",
  {
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    machineId: uuid("machine_id")
      .notNull()
      .references(() => machines.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    addedBy: uuid("added_by").references(() => userProfiles.id, {
      onDelete: "set null",
    }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.collectionId, t.machineId] }),
    machineIdx: index("idx_collection_machines_machine").on(t.machineId),
  })
).enableRLS();
```

- [ ] **Step 2: Add relations.** Place beside the other `relations(...)` blocks.

```ts
export const collectionsRelations = relations(collections, ({ one, many }) => ({
  owner: one(userProfiles, {
    fields: [collections.ownerId],
    references: [userProfiles.id],
  }),
  members: many(collectionMachines),
}));

export const collectionMachinesRelations = relations(
  collectionMachines,
  ({ one }) => ({
    collection: one(collections, {
      fields: [collectionMachines.collectionId],
      references: [collections.id],
    }),
    machine: one(machines, {
      fields: [collectionMachines.machineId],
      references: [machines.id],
    }),
  })
);
```

- [ ] **Step 3: Extend existing relations.** Add `ownedCollections: many(collections)` to `userProfilesRelations`, and `collectionMemberships: many(collectionMachines)` to `machinesRelations`. (These are additive lines inside the existing blocks — do not remove existing keys.)

- [ ] **Step 4: Generate the migration.**

Run: `pnpm run db:generate`
Expected: a new file `drizzle/NNNN_*.sql` containing `CREATE TABLE "collections"` and `CREATE TABLE "collection_machines"`, plus `drizzle/meta/` snapshot updates. Do **not** hand-edit these.

- [ ] **Step 5: Apply the migration locally.** (Requires the local stack — if Supabase is down, `supabase start` from this worktree first.)

Run: `pnpm run db:migrate`
Expected: migration applies with no error.

- [ ] **Step 6: Regenerate the PGlite test schema** so integration tests see the new tables.

Run: `pnpm run test:_generate-schema`
Expected: `src/test/setup/schema.sql` now contains both new tables (`git diff --stat` shows it changed).

- [ ] **Step 7: Verify types compile.**

Run: `pnpm run typecheck`
Expected: PASS.

- [ ] **Step 8: Commit.**

```bash
git add src/server/db/schema.ts drizzle/ src/test/setup/schema.sql
git commit -m "feat(collections): add collections + collection_machines schema (PP-wqit.1)"
```

---

### Task 2: `getCollection` resolver + `UserCollection` type

**Files:**

- Create: `src/lib/collections/user.ts`
- Test: `src/test/integration/collections-user.test.ts`

**Interfaces:**

- Consumes: `CollectionMachine` and the query shape from `src/lib/collections/owner.ts`; `collections`, `collectionMachines`, `machines`, `userProfiles`, `issues` from schema; `CLOSED_STATUSES` from `~/lib/issues/status`.
- Produces:

  ```ts
  export interface UserCollection {
    id: string;
    name: string;
    description: ProseMirrorDoc | null;
    owner: { id: string; name: string };
    machines: CollectionMachine[]; // open-issues-only, sorted by machine name
  }
  export function getCollection(
    tx: DbTransaction = db,
    collectionId: string
  ): Promise<UserCollection | null>;
  ```

- [ ] **Step 1: Write the failing test.** Create `src/test/integration/collections-user.test.ts` (mirrors `collections-owner.test.ts` harness):

```ts
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { asDbOrTx, getTestDb, setupTestDb } from "~/test/setup/pglite";
import {
  createTestIssue,
  createTestMachine,
  createTestUser,
} from "~/test/helpers/factories";
import {
  collections,
  collectionMachines,
  issues,
  machines,
  userProfiles,
} from "~/server/db/schema";
import { getCollection } from "~/lib/collections/user";

describe("getCollection", () => {
  setupTestDb();

  async function seed() {
    const db = await getTestDb();
    const owner = createTestUser({ firstName: "Cara", lastName: "Curator" });
    const other = createTestUser({ firstName: "Dan", lastName: "Other" });
    await db.insert(userProfiles).values([owner, other]);

    // Machines span two owners — a collection may include machines the
    // curator does not own.
    const zeta = createTestMachine({
      initials: "ZZ",
      name: "Zeta",
      ownerId: owner.id,
    });
    const alpha = createTestMachine({
      initials: "AA",
      name: "Alpha",
      ownerId: other.id,
    });
    const excluded = createTestMachine({
      initials: "XX",
      name: "Excluded",
      ownerId: owner.id,
    });
    await db.insert(machines).values([zeta, alpha, excluded]);

    await db.insert(issues).values([
      createTestIssue("ZZ", {
        issueNumber: 1,
        title: "open",
        status: "new",
        severity: "major",
      }),
      createTestIssue("ZZ", {
        issueNumber: 2,
        title: "closed",
        status: "fixed",
        severity: "unplayable",
      }),
    ]);

    const [collection] = await db
      .insert(collections)
      .values({ name: "Summer Classic", ownerId: owner.id })
      .returning();
    await db.insert(collectionMachines).values([
      { collectionId: collection.id, machineId: zeta.id },
      { collectionId: collection.id, machineId: alpha.id },
    ]);
    return { db, owner, collection, zeta, alpha };
  }

  it("returns members (both owners' machines) with open issues only, sorted by name", async () => {
    const { db, owner, collection } = await seed();
    const result = await getCollection(asDbOrTx(db), collection.id);
    expect(result).not.toBeNull();
    expect(result?.name).toBe("Summer Classic");
    expect(result?.owner).toEqual({ id: owner.id, name: "Cara Curator" });
    expect(result?.machines.map((m) => m.initials)).toEqual(["AA", "ZZ"]);
    const zetaRow = result?.machines.find((m) => m.initials === "ZZ");
    expect(zetaRow?.issues).toEqual([
      { status: "new", severity: "major", createdAt: expect.any(Date) },
    ]);
  });

  it("excludes non-member machines", async () => {
    const { db, collection } = await seed();
    const result = await getCollection(asDbOrTx(db), collection.id);
    expect(result?.machines.map((m) => m.initials)).not.toContain("XX");
  });

  it("returns an empty machine list for a collection with no members", async () => {
    const db = await getTestDb();
    const owner = createTestUser();
    await db.insert(userProfiles).values(owner);
    const [collection] = await db
      .insert(collections)
      .values({ name: "Empty", ownerId: owner.id })
      .returning();
    const result = await getCollection(asDbOrTx(db), collection.id);
    expect(result?.machines).toEqual([]);
  });

  it("returns null for unknown or malformed ids", async () => {
    const db = await getTestDb();
    expect(await getCollection(asDbOrTx(db), randomUUID())).toBeNull();
    expect(await getCollection(asDbOrTx(db), "not-a-uuid")).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails.**

Run: `pnpm exec vitest run src/test/integration/collections-user.test.ts`
Expected: FAIL — `getCollection` not found / module `~/lib/collections/user` missing.

- [ ] **Step 3: Implement the resolver.** Create `src/lib/collections/user.ts`:

```ts
import { asc, eq, inArray, notInArray } from "drizzle-orm";
import { z } from "zod";
import { db, type DbTransaction } from "~/server/db";
import {
  collections,
  collectionMachines,
  issues,
  machines,
  userProfiles,
} from "~/server/db/schema";
import { CLOSED_STATUSES } from "~/lib/issues/status";
import type { ProseMirrorDoc } from "~/lib/tiptap/types";
import type { CollectionMachine } from "./owner";

export interface UserCollection {
  id: string;
  name: string;
  description: ProseMirrorDoc | null;
  owner: { id: string; name: string };
  machines: CollectionMachine[];
}

const uuidSchema = z.uuid();

/**
 * Resolve a user-created collection: the machines explicitly added to it.
 *
 * A second collection resolver (spec §Reuse of the existing collection view),
 * returning the same open-issues-only `CollectionMachine[]` shape as
 * getOwnerCollection so the /c/ tabs, summary, and timeline reuse it unchanged.
 * Pure data — authorization lives in ./access + the route loader.
 *
 * Returns null when the id is malformed or no such collection exists.
 */
export async function getCollection(
  tx: DbTransaction = db,
  collectionId: string
): Promise<UserCollection | null> {
  if (!uuidSchema.safeParse(collectionId).success) return null;

  const collection = await tx.query.collections.findFirst({
    where: eq(collections.id, collectionId),
    columns: { id: true, name: true, description: true, ownerId: true },
    with: { owner: { columns: { id: true, name: true } } },
  });
  if (!collection) return null;

  const memberRows = await tx
    .select({ machineId: collectionMachines.machineId })
    .from(collectionMachines)
    .where(eq(collectionMachines.collectionId, collectionId));
  const machineIds = memberRows.map((r) => r.machineId);

  const machineRows: CollectionMachine[] =
    machineIds.length === 0
      ? []
      : await tx.query.machines.findMany({
          where: inArray(machines.id, machineIds),
          columns: {
            id: true,
            initials: true,
            name: true,
            presenceStatus: true,
          },
          with: {
            issues: {
              where: notInArray(issues.status, [...CLOSED_STATUSES]),
              columns: { status: true, severity: true, createdAt: true },
            },
          },
          orderBy: [asc(machines.name)],
        });

  return {
    id: collection.id,
    name: collection.name,
    description: collection.description ?? null,
    owner: collection.owner,
    machines: machineRows,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes.**

Run: `pnpm exec vitest run src/test/integration/collections-user.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit.**

```bash
git add src/lib/collections/user.ts src/test/integration/collections-user.test.ts
git commit -m "feat(collections): getCollection resolver for user collections (PP-wqit.1)"
```

---

### Task 3: Authorization helper (`access.ts`)

**Files:**

- Create: `src/lib/collections/access.ts`
- Test: `src/lib/collections/access.test.ts`

**Interfaces:**

- Produces:

  ```ts
  export interface CollectionViewer {
    userId?: string | undefined;
    role?: string | null | undefined;
  }
  export function canViewCollection(
    collection: { owner: { id: string } },
    viewer: CollectionViewer
  ): boolean;
  export function canManageCollection(
    collection: { owner: { id: string } },
    viewer: CollectionViewer
  ): boolean;
  ```

  Wave 0a semantics: view = owner **or** admin; manage = owner only. (Wave 0b extends `canView` with view/edit tokens.)

- [ ] **Step 1: Write the failing test.** Create `src/lib/collections/access.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { canManageCollection, canViewCollection } from "./access";

const collection = { owner: { id: "owner-1" } };

describe("canViewCollection (Wave 0a: owner or admin)", () => {
  it("allows the owner", () => {
    expect(
      canViewCollection(collection, { userId: "owner-1", role: "member" })
    ).toBe(true);
  });
  it("allows an admin who is not the owner", () => {
    expect(
      canViewCollection(collection, { userId: "someone", role: "admin" })
    ).toBe(true);
  });
  it("denies a non-owner non-admin", () => {
    expect(
      canViewCollection(collection, { userId: "someone", role: "member" })
    ).toBe(false);
  });
  it("denies anonymous", () => {
    expect(canViewCollection(collection, {})).toBe(false);
  });
});

describe("canManageCollection (owner only)", () => {
  it("allows the owner", () => {
    expect(
      canManageCollection(collection, { userId: "owner-1", role: "member" })
    ).toBe(true);
  });
  it("denies an admin who is not the owner", () => {
    expect(
      canManageCollection(collection, { userId: "someone", role: "admin" })
    ).toBe(false);
  });
  it("denies anonymous", () => {
    expect(canManageCollection(collection, {})).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails.**

Run: `pnpm exec vitest run src/lib/collections/access.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement.** Create `src/lib/collections/access.ts`:

```ts
export interface CollectionViewer {
  /** Current user's id (undefined if unauthenticated). */
  userId?: string | undefined;
  /** Current user's role (undefined/null if unauthenticated). */
  role?: string | null | undefined;
}

/**
 * Wave 0a: a collection is private to its owner; admins may also view.
 * Wave 0b extends this with view/edit link tokens.
 */
export function canViewCollection(
  collection: { owner: { id: string } },
  viewer: CollectionViewer
): boolean {
  if (viewer.userId !== undefined && viewer.userId === collection.owner.id) {
    return true;
  }
  return viewer.role === "admin";
}

/** Manage (rename, delete, edit membership) is owner-only in MVP. */
export function canManageCollection(
  collection: { owner: { id: string } },
  viewer: CollectionViewer
): boolean {
  return viewer.userId !== undefined && viewer.userId === collection.owner.id;
}
```

- [ ] **Step 4: Run to verify pass.**

Run: `pnpm exec vitest run src/lib/collections/access.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit.**

```bash
git add src/lib/collections/access.ts src/lib/collections/access.test.ts
git commit -m "feat(collections): view/manage authorization helper (PP-wqit.1)"
```

---

### Task 4: Permissions matrix — Collections category

**Files:**

- Modify: `src/lib/permissions/matrix.ts` (append a category to `PERMISSIONS_MATRIX`)
- Verify: any matrix snapshot/help test (run the permissions test after)

**Interfaces:**

- Produces permission ids `collections.view` (all access levels `true`) and `collections.create` (member+).

- [ ] **Step 1: Add the category.** Append to the `PERMISSIONS_MATRIX` array in `matrix.ts`, following the exact `PermissionDefinition` shape used by the `issues` category:

```ts
  {
    id: "collections",
    label: "Collections",
    permissions: [
      {
        id: "collections.view",
        label: "View collections",
        description:
          "View a collection's Overview, Issues, and Timeline. Private collections are additionally restricted to their owner (and admins); link-based sharing is handled outside the role matrix.",
        access: {
          unauthenticated: true,
          guest: true,
          member: true,
          technician: true,
          admin: true,
        },
      },
      {
        id: "collections.create",
        label: "Create collections",
        description:
          "Create a personal collection and add machines to it. Managing a collection (rename, delete, edit membership) is restricted to its owner.",
        access: {
          unauthenticated: false,
          guest: false,
          member: true,
          technician: true,
          admin: true,
        },
      },
    ],
  },
```

- [ ] **Step 2: Typecheck + run the permissions test.**

Run: `pnpm run typecheck && pnpm exec vitest run src/lib/permissions`
Expected: PASS. If a snapshot test covers the matrix/help output, update it with `pnpm exec vitest run src/lib/permissions -u` and eyeball the diff (should show only the new Collections rows).

- [ ] **Step 3: Commit.**

```bash
git add src/lib/permissions/
git commit -m "feat(collections): add Collections permission category (PP-wqit.1)"
```

---

### Task 5: Server actions — create / rename / delete / update membership

**Files:**

- Create: `src/app/(app)/c/collections/actions.ts`
- Test: `src/test/integration/collections-actions.test.ts`

**Interfaces:**

- Consumes: `getCollection` (Task 2), `canManageCollection` (Task 3), `checkPermission`/`getAccessLevel`, `collections`/`collectionMachines`/`machines`/`userProfiles` schema, `createClient`.
- Produces (all `"use server"`):
  ```ts
  type ActionResult<T = undefined> = { success: true; data?: T } | { success: false; error: string };
  createCollectionAction(input: { name: string }): Promise<ActionResult<{ id: string }>>;
  renameCollectionAction(input: { collectionId: string; name: string }): Promise<ActionResult>;
  deleteCollectionAction(input: { collectionId: string }): Promise<ActionResult>;
  updateCollectionMachinesAction(input: { collectionId: string; machineIds: string[] }): Promise<ActionResult>;
  ```

> Note on auth resolution: mirror the inline pattern from `m/[initials]/(tabs)/timeline/actions.ts` — `createClient()` → `auth.getUser()`; role via `db.query.userProfiles.findFirst`. There is no wrapper helper; do not invent one (Rule of Three — this is the 2nd action module of this shape, not the 3rd).

- [ ] **Step 1: Write the failing test.** Create `src/test/integration/collections-actions.test.ts`. Because the actions call `createClient()` for auth, mock it at the module boundary (CORE-TEST-006 — mock third-party SDK at its seam). Pattern:

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";
import { asDbOrTx, getTestDb, setupTestDb } from "~/test/setup/pglite";
import { createTestMachine, createTestUser } from "~/test/helpers/factories";
import {
  collections,
  collectionMachines,
  machines,
  userProfiles,
} from "~/server/db/schema";
import { eq } from "drizzle-orm";

// --- boundary mocks -------------------------------------------------------
const mockGetUser = vi.fn();
vi.mock("~/lib/supabase/server", () => ({
  createClient: () => ({ auth: { getUser: mockGetUser } }),
}));
// Route the action's `db` at the worker-scoped PGlite instance.
vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return {
    get db() {
      return getTestDbSync();
    } /* DbTransaction type only */,
  };
});
// (If the repo already has a shared helper for db-mocking in integration
// action tests, use it instead — grep src/test/setup for "vi.mock(\"~/server/db\"".)
```

> **Implementer note:** PinPoint already has an established way to test server actions against PGlite. Before writing the mock above, grep for an existing action integration test (e.g. `rg -l "actions" src/test/integration`) and copy its `createClient` + `db` mocking harness verbatim rather than hand-rolling. The assertions below are the contract regardless of harness:

```ts
describe("collection actions", () => {
  setupTestDb();
  beforeEach(() => mockGetUser.mockReset());

  it("createCollectionAction: member creates; returns id; guest denied", async () => {
    // signed-in member -> success; assert a row exists with ownerId = member.id
    // signed-in guest  -> { success: false } and no row created
  });

  it("updateCollectionMachinesAction: owner replaces membership (add + remove)", async () => {
    // seed collection with [A]; call with [B,C]; assert membership == {B,C}
  });

  it("updateCollectionMachinesAction: non-owner denied, membership unchanged", async () => {});

  it("renameCollectionAction / deleteCollectionAction: owner only", async () => {});
});
```

Fill each `it` with concrete arrange/act/assert using `db.insert(...)`, `mockGetUser.mockResolvedValue({ data: { user: { id } } })`, calling the action, and asserting via `db.query`/`db.select`. Assert denial returns `{ success: false }` AND that the DB is unchanged.

- [ ] **Step 2: Run it to verify it fails.**

Run: `pnpm exec vitest run src/test/integration/collections-actions.test.ts`
Expected: FAIL — actions module missing.

- [ ] **Step 3: Implement the actions.** Create `src/app/(app)/c/collections/actions.ts`:

```ts
"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { checkPermission, getAccessLevel } from "~/lib/permissions/helpers";
import { canManageCollection } from "~/lib/collections/access";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import {
  collections,
  collectionMachines,
  machines,
  userProfiles,
} from "~/server/db/schema";

type ActionResult<T = undefined> =
  { success: true; data?: T } | { success: false; error: string };

async function resolveActor(): Promise<{
  userId: string;
  role: string;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const profile = await db.query.userProfiles.findFirst({
    where: eq(userProfiles.id, user.id),
    columns: { role: true },
  });
  if (!profile) return null;
  return { userId: user.id, role: profile.role };
}

const nameSchema = z.string().trim().min(1, "Name is required").max(120);

export async function createCollectionAction(input: {
  name: string;
}): Promise<ActionResult<{ id: string }>> {
  const actor = await resolveActor();
  if (!actor) return { success: false, error: "Not authenticated" };

  if (!checkPermission("collections.create", getAccessLevel(actor.role))) {
    return { success: false, error: "Forbidden" };
  }
  const parsed = nameSchema.safeParse(input.name);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid name",
    };
  }

  const [row] = await db
    .insert(collections)
    .values({ name: parsed.data, ownerId: actor.userId })
    .returning({ id: collections.id });
  if (!row) return { success: false, error: "Create failed" };

  revalidatePath("/c/collections");
  return { success: true, data: { id: row.id } };
}

/** Load a collection's owner for a manage-gate check. */
async function loadOwner(
  collectionId: string
): Promise<{ owner: { id: string } } | null> {
  if (!z.uuid().safeParse(collectionId).success) return null;
  const row = await db.query.collections.findFirst({
    where: eq(collections.id, collectionId),
    columns: { ownerId: true },
  });
  return row ? { owner: { id: row.ownerId } } : null;
}

export async function renameCollectionAction(input: {
  collectionId: string;
  name: string;
}): Promise<ActionResult> {
  const actor = await resolveActor();
  if (!actor) return { success: false, error: "Not authenticated" };
  const collection = await loadOwner(input.collectionId);
  if (!collection) return { success: false, error: "Not found" };
  if (!canManageCollection(collection, { userId: actor.userId })) {
    return { success: false, error: "Forbidden" };
  }
  const parsed = nameSchema.safeParse(input.name);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid name",
    };
  }
  await db
    .update(collections)
    .set({ name: parsed.data, updatedAt: new Date() })
    .where(eq(collections.id, input.collectionId));
  revalidatePath(`/c/collection/${input.collectionId}`);
  revalidatePath("/c/collections");
  return { success: true };
}

export async function deleteCollectionAction(input: {
  collectionId: string;
}): Promise<ActionResult> {
  const actor = await resolveActor();
  if (!actor) return { success: false, error: "Not authenticated" };
  const collection = await loadOwner(input.collectionId);
  if (!collection) return { success: false, error: "Not found" };
  if (!canManageCollection(collection, { userId: actor.userId })) {
    return { success: false, error: "Forbidden" };
  }
  // collection_machines rows cascade-delete via the FK.
  await db.delete(collections).where(eq(collections.id, input.collectionId));
  revalidatePath("/c/collections");
  return { success: true };
}

export async function updateCollectionMachinesAction(input: {
  collectionId: string;
  machineIds: string[];
}): Promise<ActionResult> {
  const actor = await resolveActor();
  if (!actor) return { success: false, error: "Not authenticated" };
  const collection = await loadOwner(input.collectionId);
  if (!collection) return { success: false, error: "Not found" };
  if (!canManageCollection(collection, { userId: actor.userId })) {
    return { success: false, error: "Forbidden" };
  }

  const idsParsed = z.array(z.uuid()).safeParse(input.machineIds);
  if (!idsParsed.success)
    return { success: false, error: "Invalid machine ids" };
  const desired = [...new Set(idsParsed.data)];

  // Reject ids that are not real machines (silently dropping would hide bugs).
  if (desired.length > 0) {
    const existing = await db
      .select({ id: machines.id })
      .from(machines)
      .where(inArray(machines.id, desired));
    if (existing.length !== desired.length) {
      return { success: false, error: "Unknown machine" };
    }
  }

  await db.transaction(async (tx) => {
    const current = await tx
      .select({ machineId: collectionMachines.machineId })
      .from(collectionMachines)
      .where(eq(collectionMachines.collectionId, input.collectionId));
    const currentSet = new Set(current.map((r) => r.machineId));
    const desiredSet = new Set(desired);

    const toRemove = [...currentSet].filter((id) => !desiredSet.has(id));
    const toAdd = desired.filter((id) => !currentSet.has(id));

    if (toRemove.length > 0) {
      await tx
        .delete(collectionMachines)
        .where(
          and(
            eq(collectionMachines.collectionId, input.collectionId),
            inArray(collectionMachines.machineId, toRemove)
          )
        );
    }
    if (toAdd.length > 0) {
      await tx.insert(collectionMachines).values(
        toAdd.map((machineId) => ({
          collectionId: input.collectionId,
          machineId,
          addedBy: actor.userId,
        }))
      );
    }
    await tx
      .update(collections)
      .set({ updatedAt: new Date() })
      .where(eq(collections.id, input.collectionId));
  });

  revalidatePath(`/c/collection/${input.collectionId}`);
  return { success: true };
}
```

- [ ] **Step 4: Run tests to verify pass.**

Run: `pnpm exec vitest run src/test/integration/collections-actions.test.ts`
Expected: PASS (all cases, including denial-leaves-DB-unchanged).

- [ ] **Step 5: Commit.**

```bash
git add "src/app/(app)/c/collections/actions.ts" src/test/integration/collections-actions.test.ts
git commit -m "feat(collections): create/rename/delete/update-membership actions (PP-wqit.1)"
```

---

### Task 6: Collection view route `/c/collection/[id]` (Overview + Issues + Timeline)

**Files:**

- Create: `src/app/(app)/c/collection/[id]/_data.ts`
- Create: `src/app/(app)/c/collection/[id]/(tabs)/layout.tsx`
- Create: `src/app/(app)/c/collection/[id]/(tabs)/page.tsx`
- Create: `src/app/(app)/c/collection/[id]/(tabs)/issues/page.tsx`
- Create: `src/app/(app)/c/collection/[id]/(tabs)/timeline/page.tsx`

**Interfaces:**

- Consumes: `getCollection` (Task 2), `canViewCollection`/`canManageCollection` (Task 3), existing `CollectionHeader`, `CollectionTabStrip`, `CollectionOverviewTable`, `summarizeCollection`, `getLatestTimelineEventPerMachine`, `getMachineTimeline`, issues-list machinery.
- Produces: `getCollectionForLayout(collectionId)` returning `{ collection: UserCollection; viewerCanManage: boolean } | null`.

- [ ] **Step 1: Write `_data.ts` (auth + authorization).**

```ts
import { cache } from "react";
import { eq } from "drizzle-orm";
import { getCollection, type UserCollection } from "~/lib/collections/user";
import {
  canManageCollection,
  canViewCollection,
} from "~/lib/collections/access";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";

export interface CollectionForLayout {
  collection: UserCollection;
  viewerCanManage: boolean;
}

/**
 * Request-deduped fetch shared by the (tabs) layout and tab pages.
 * Returns null when the collection is missing OR the viewer cannot see it
 * (private to owner; admins may view). The route maps null -> notFound()
 * so a private collection's existence is never revealed (404 not 403).
 */
export const getCollectionForLayout = cache(
  async (collectionId: string): Promise<CollectionForLayout | null> => {
    const collection = await getCollection(undefined, collectionId);
    if (!collection) return null;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    let role: string | null = null;
    if (user) {
      const profile = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, user.id),
        columns: { role: true },
      });
      role = profile?.role ?? null;
    }

    const viewer = { userId: user?.id, role };
    if (!canViewCollection(collection, viewer)) return null;
    return {
      collection,
      viewerCanManage: canManageCollection(collection, viewer),
    };
  }
);
```

- [ ] **Step 2: Write the layout** (mirror `/c/owner/[userId]/(tabs)/layout.tsx`; title from `collection.name`, basePath `/c/collection/[id]`):

```tsx
import type React from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageContainer } from "~/components/layout/PageContainer";
import { CollectionHeader } from "~/components/collections/CollectionHeader";
import { CollectionTabStrip } from "~/components/collections/CollectionTabStrip";
import { summarizeCollection } from "~/lib/collections/summary";
import { getCollectionForLayout } from "../_data";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const data = await getCollectionForLayout(id);
  return {
    title: data
      ? `${data.collection.name} | PinPoint`
      : "Collection | PinPoint",
  };
}

export default async function CollectionLayout({
  children,
  params,
}: LayoutProps): Promise<React.JSX.Element> {
  const { id } = await params;
  const data = await getCollectionForLayout(id);
  if (!data) notFound();

  const summary = summarizeCollection(data.collection.machines);
  const worstStatus =
    summary.unplayable > 0
      ? "unplayable"
      : summary.needsService > 0
        ? "needs_service"
        : "operational";

  return (
    <PageContainer size="standard">
      <div className="space-y-2">
        <CollectionHeader title={data.collection.name} summary={summary} />
        <CollectionTabStrip
          basePath={`/c/collection/${data.collection.id}`}
          openIssueCount={summary.openIssues}
          status={worstStatus}
        />
        <div className="pt-2">{children}</div>
      </div>
    </PageContainer>
  );
}
```

- [ ] **Step 3: Write the Overview page** (mirror owner Overview; add owner-only manage entry point placeholder wired in Task 7 — for now just render the table):

```tsx
import type React from "react";
import { notFound } from "next/navigation";
import { getLatestTimelineEventPerMachine } from "~/lib/collections/latest-activity";
import { deriveMachineStatus } from "~/lib/machines/status";
import { getCollectionForLayout } from "../_data";
import {
  CollectionOverviewTable,
  type CollectionOverviewRow,
} from "~/components/collections/CollectionOverviewTable";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CollectionOverviewPage({
  params,
}: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;
  const data = await getCollectionForLayout(id);
  if (!data) notFound();
  const { machines } = data.collection;

  if (machines.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No machines in this collection yet.
      </p>
    );
  }

  const latest = await getLatestTimelineEventPerMachine(
    undefined,
    machines.map((m) => m.id)
  );

  const rows: CollectionOverviewRow[] = machines.map((m) => ({
    id: m.id,
    initials: m.initials,
    name: m.name,
    status: deriveMachineStatus(m.issues),
    openCount: m.issues.length,
    lastActivity: latest.get(m.id) ?? null,
    oldestOpenAt:
      m.issues.length > 0
        ? new Date(Math.min(...m.issues.map((i) => i.createdAt.getTime())))
        : null,
    presence: m.presenceStatus,
  }));

  return <CollectionOverviewTable rows={rows} />;
}
```

- [ ] **Step 4: Write the Issues page** — copy `/c/owner/[userId]/(tabs)/issues/page.tsx` verbatim, changing: `params` to `{ id: string }`; import `getCollectionForLayout` from `../_data`; replace `const collection = await getOwnerCollectionForLayout(userId)` + null check with `const data = await getCollectionForLayout(id); if (!data) notFound(); const collection = data.collection;`. Everything below (filter parsing, force-scoping to `collection.machines`, `loadIssueListPage`, render) is unchanged.

- [ ] **Step 5: Write the Timeline page** — copy `/c/owner/[userId]/(tabs)/timeline/page.tsx` verbatim (including the co-located `TimelinePagination` component), with the same `params`/`getCollectionForLayout` swap as Step 4, and change the two `baseUrl`/`basePath` strings from `/c/owner/${collection.owner.id}/timeline` to `/c/collection/${id}/timeline`. The `TimelinePagination` `ownerId` prop should be renamed/repurposed to carry the collection id used to rebuild the base path (rename prop `ownerId` → `basePath: string` passed as `/c/collection/${id}/timeline`, and build hrefs off it) — or simplest: pass `basePath` and drop the owner-specific string building. Keep the change mechanical.

- [ ] **Step 6: Smoke-check the route renders.** Start the dev stack if needed (`pnpm run dev:status`), create a collection via a quick manual insert or wait for Task 6 UI. For now verify compile + lint:

Run: `pnpm run check`
Expected: PASS (types, lint, format).

- [ ] **Step 7: Commit.**

```bash
git add "src/app/(app)/c/collection/"
git commit -m "feat(collections): /c/collection/[id] view route (owner-gated) (PP-wqit.1)"
```

---

### Task 7: "My Collections" list + create form + user-menu link

**Files:**

- Create: `src/app/(app)/c/collections/page.tsx` (list + create)
- Create: `src/components/collections/CreateCollectionForm.tsx` (`"use client"` leaf)
- Create: `src/lib/collections/list.ts` (`getMyCollections` query)
- Modify: `src/components/layout/user-menu-client.tsx` (add "My Collections" link)
- Test: `src/test/integration/collections-list.test.ts`

**Interfaces:**

- Produces: `getMyCollections(tx, ownerId): Promise<{ id: string; name: string; machineCount: number }[]>`.

- [ ] **Step 1: Failing test for `getMyCollections`.** `src/test/integration/collections-list.test.ts` — seed two collections for owner A (one with 2 machines, one empty) and one for owner B; assert `getMyCollections(db, A.id)` returns A's two, sorted by name, with correct `machineCount`, and excludes B's.

- [ ] **Step 2: Run — expect FAIL.**

Run: `pnpm exec vitest run src/test/integration/collections-list.test.ts`

- [ ] **Step 3: Implement `getMyCollections`** in `src/lib/collections/list.ts` using a left join + group-by count:

```ts
import { asc, count, eq } from "drizzle-orm";
import { db, type DbTransaction } from "~/server/db";
import { collections, collectionMachines } from "~/server/db/schema";

export interface CollectionListItem {
  id: string;
  name: string;
  machineCount: number;
}

export async function getMyCollections(
  tx: DbTransaction = db,
  ownerId: string
): Promise<CollectionListItem[]> {
  const rows = await tx
    .select({
      id: collections.id,
      name: collections.name,
      machineCount: count(collectionMachines.machineId),
    })
    .from(collections)
    .leftJoin(
      collectionMachines,
      eq(collectionMachines.collectionId, collections.id)
    )
    .where(eq(collections.ownerId, ownerId))
    .groupBy(collections.id, collections.name)
    .orderBy(asc(collections.name));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    machineCount: Number(r.machineCount),
  }));
}
```

- [ ] **Step 4: Run — expect PASS.**

- [ ] **Step 5: Create the client create-form leaf** `src/components/collections/CreateCollectionForm.tsx`:

```tsx
"use client";

import type React from "react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { createCollectionAction } from "~/app/(app)/c/collections/actions";

export function CreateCollectionForm(): React.JSX.Element {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function action(formData: FormData): Promise<void> {
    const name = String(formData.get("name") ?? "");
    const result = await createCollectionAction({ name });
    if (result.success && result.data) {
      router.push(`/c/collection/${result.data.id}`);
    } else {
      setError(result.success ? "Create failed" : result.error);
    }
  }

  return (
    <form
      action={(fd) => startTransition(() => void action(fd))}
      className="flex items-start gap-2"
    >
      <div className="flex flex-col gap-1">
        <Input
          name="name"
          required
          maxLength={120}
          placeholder="New collection name"
          aria-label="New collection name"
          enterKeyHint="done"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 6: Create the list page** `src/app/(app)/c/collections/page.tsx` (Server Component): resolve the current user (redirect to sign-in if unauthenticated — mirror how other `(app)` authed pages redirect), fetch `getMyCollections`, render `CreateCollectionForm` + a list linking each to `/c/collection/[id]` with its `machineCount`, and a friendly empty state.

- [ ] **Step 7: Add the user-menu link.** In `src/components/layout/user-menu-client.tsx`, directly after the existing "My Machines" `DropdownMenuItem` block (the `userId && (...)` block around line 105-119), add a sibling. Reuse an imported lucide icon already present or add `Library`/`FolderHeart` to the existing lucide import line:

```tsx
{
  userId && (
    <DropdownMenuItem asChild>
      <a
        href="/c/collections"
        className="flex items-center cursor-pointer"
        data-testid="user-menu-my-collections"
      >
        <Library className="mr-2 size-4" />
        <span>My Collections</span>
      </a>
    </DropdownMenuItem>
  );
}
```

- [ ] **Step 8: Run checks.**

Run: `pnpm run check`
Expected: PASS.

- [ ] **Step 9: Commit.**

```bash
git add "src/app/(app)/c/collections/" src/components/collections/CreateCollectionForm.tsx src/lib/collections/list.ts src/components/layout/user-menu-client.tsx src/test/integration/collections-list.test.ts
git commit -m "feat(collections): My Collections list, create form, nav link (PP-wqit.1)"
```

---

### Task 8: Manage-machines UI (owner) + rename/delete controls + smoke E2E

**Files:**

- Create: `src/components/collections/ManageCollectionMachines.tsx` (`"use client"`)
- Create: `src/components/collections/CollectionOwnerControls.tsx` (`"use client"` — rename/delete)
- Modify: `src/app/(app)/c/collection/[id]/(tabs)/page.tsx` (render owner controls when `viewerCanManage`)
- Create: `e2e/collections.smoke.spec.ts`

**Interfaces:**

- Consumes: `updateCollectionMachinesAction`, `renameCollectionAction`, `deleteCollectionAction` (Task 5); shared `MultiSelect` (`Option[]`, `value`, `onChange`); the full machine list (fetch `id`+`initials`+`name` for all machines in the Overview page and pass to the manage component).

- [ ] **Step 1: Build `ManageCollectionMachines`.** A `"use client"` leaf: props `{ collectionId: string; allMachines: {id;initials;name}[]; currentIds: string[] }`. Renders a `MultiSelect` (options mapped from `allMachines`, `value = currentIds`), and on change (debounced or on an explicit "Save" button) calls `updateCollectionMachinesAction({ collectionId, machineIds })` inside `useTransition`; surfaces an error string on failure and calls `router.refresh()` on success.

```tsx
"use client";

import type React from "react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { MultiSelect } from "~/components/ui/multi-select";
import { Button } from "~/components/ui/button";
import { updateCollectionMachinesAction } from "~/app/(app)/c/collections/actions";

interface Props {
  collectionId: string;
  allMachines: { id: string; initials: string; name: string }[];
  currentIds: string[];
}

export function ManageCollectionMachines({
  collectionId,
  allMachines,
  currentIds,
}: Props): React.JSX.Element {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string[]>(currentIds);
  const [error, setError] = useState<string | null>(null);

  const options = useMemo(
    () =>
      allMachines.map((m) => ({
        label: m.name,
        value: m.id,
        badgeLabel: m.initials,
      })),
    [allMachines]
  );

  function save(): void {
    setError(null);
    startTransition(async () => {
      const result = await updateCollectionMachinesAction({
        collectionId,
        machineIds: selected,
      });
      if (!result.success) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <MultiSelect
        options={options}
        value={selected}
        onChange={setSelected}
        placeholder="Add machines…"
        searchPlaceholder="Search machines…"
        ariaLabel="Machines in this collection"
        className="w-64"
      />
      <Button onClick={save} disabled={pending}>
        {pending ? "Saving…" : "Save machines"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Build `CollectionOwnerControls`** (`"use client"`): rename (an inline `<form action>` calling `renameCollectionAction`) and delete (a `<dialog>` confirm calling `deleteCollectionAction`, then `router.push("/c/collections")`). Real `<button>`s; `inert` on the background is not needed for a native `<dialog>` opened with `showModal()` (it handles inertness). Follow `pinpoint-ui` for the `<dialog>` pattern.

- [ ] **Step 3: Wire owner controls into the Overview page.** In `src/app/(app)/c/collection/[id]/(tabs)/page.tsx`, when `data.viewerCanManage`, fetch the full machine list (`db.query.machines.findMany({ columns: { id: true, initials: true, name: true }, orderBy: [asc(machines.name)] })`) and render `<CollectionOwnerControls>` + `<ManageCollectionMachines currentIds={machines.map(m=>m.id)} .../>` above the table. Non-managers see only the table. (Adding the machine-list fetch here is acceptable; it runs only for the owner view.)

- [ ] **Step 4: RTL unit test** `src/components/collections/ManageCollectionMachines.test.tsx` (optional but recommended): mock the action, assert Save calls it with the selected ids and shows the error on `{ success: false }`. Follow an existing component test for the render/mocking harness.

- [ ] **Step 5: Smoke E2E** `e2e/collections.smoke.spec.ts` (follow `pinpoint-e2e` for worker isolation + auth fixtures): sign in as a member, go to `/c/collections`, create a collection, add machines via the multi-select, assert the Overview/Issues/Timeline tabs each render (no 500), and assert an empty collection renders its empty state. Keep it a "renders without 500" smoke, not a deep journey.

- [ ] **Step 6: Run the smoke spec.**

Run: `pnpm exec playwright test e2e/collections.smoke.spec.ts --project=chromium`
Expected: PASS.

- [ ] **Step 7: Full local gate.**

Run: `pnpm run preflight`
Expected: PASS (schema change + server actions ⇒ preflight, per Global Constraints).

- [ ] **Step 8: Commit.**

```bash
git add "src/app/(app)/c/collection/" src/components/collections/ e2e/collections.smoke.spec.ts
git commit -m "feat(collections): owner manage-machines + rename/delete + smoke E2E (PP-wqit.1)"
```

---

## Self-Review

**Spec coverage** (spec §MVP / Wave 0a): data model ✓ (T1), `getCollection` resolver returning the reused shape ✓ (T2), owner-gated access with 404-not-403 ✓ (T3 + T6), `collections.create` matrix gate ✓ (T4), create/rename/delete/add-remove actions with ownership ✓ (T5), `/c/collection/[id]` three tabs reusing the view ✓ (T6), "My Collections" list + create + nav link ✓ (T7), multi-select add machines + owner controls + smoke E2E ✓ (T8). Sharing tokens correctly **excluded** (Wave 0b). Machine-page "add to collection" correctly **excluded** (later bead).

**Placeholder scan:** Task 5 Step 1 and Task 7 Step 6 / Task 8 Steps 2,4,5 describe test/page bodies in prose rather than full code, because they must adopt an **existing repo harness** (server-action db-mock, authed-page redirect, RTL mock, E2E auth fixtures) that the implementer must copy verbatim rather than invent — the acceptance contract for each is stated explicitly. All novel logic (schema, resolver, access, matrix, actions, list query, client leaves) has complete code. This is a deliberate "follow the established pattern" instruction, not an unspecified TODO.

**Type consistency:** `UserCollection` (T2) is consumed by `_data.ts` (T6) and `CollectionForLayout` wraps it; `CollectionMachine` reused from `owner.ts`; `CollectionOverviewRow` fields match the owner Overview builder exactly; action signatures in T5 match their T7/T8 call sites (`createCollectionAction({name})→{id}`, `updateCollectionMachinesAction({collectionId,machineIds})`); `canViewCollection`/`canManageCollection` signatures match T3 definitions and T6/T5 uses.

**Deviations to confirm with the reviewer during execution:**

- `/c/collections` (list, plural) vs `/c/collection/[id]` (view, singular) — chosen for `/c/<type>/<key>` consistency with `/c/owner/`. Confirm the plural/singular split is acceptable.
- `updateCollectionMachinesAction` is a **full-set replace** (multi-select semantics), not per-row add/remove — simplest UI↔action fit; add/remove endpoints can come with the machine-page button (later bead).
