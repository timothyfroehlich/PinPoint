import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { createTestMachine, createTestUser } from "~/test/helpers/factories";
import {
  collections,
  collectionMachines,
  machines,
  userProfiles,
} from "~/server/db/schema";

// --- boundary mocks -------------------------------------------------------
// Vary the signed-in user per test by resolving mockGetUser.
const mockGetUser = vi.fn();
vi.mock("~/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ auth: { getUser: mockGetUser } }),
}));
// Route the production `db` import at the worker-scoped PGlite instance.
vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

function signIn(userId: string): void {
  mockGetUser.mockResolvedValue({
    data: { user: { id: userId } },
    error: null,
  });
}

function signOut(): void {
  mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
}

async function membershipOf(collectionId: string): Promise<Set<string>> {
  const db = await getTestDb();
  const rows = await db
    .select({ machineId: collectionMachines.machineId })
    .from(collectionMachines)
    .where(eq(collectionMachines.collectionId, collectionId));
  return new Set(rows.map((r) => r.machineId));
}

describe("collection actions", () => {
  setupTestDb();
  beforeEach(() => mockGetUser.mockReset());

  it("createCollectionAction: member creates; returns id; guest denied", async () => {
    const db = await getTestDb();
    const member = createTestUser({ role: "member" });
    const guest = createTestUser({ role: "guest" });
    await db.insert(userProfiles).values([member, guest]);
    const { createCollectionAction } =
      await import("~/app/(app)/c/collections/actions");

    signIn(member.id);
    const created = await createCollectionAction({ name: "My Faves" });
    expect(created.success).toBe(true);
    if (!created.success) throw new Error("expected success");
    expect(created.data?.id).toBeTruthy();
    const row = await db.query.collections.findFirst({
      where: eq(collections.id, created.data?.id ?? ""),
    });
    expect(row?.ownerId).toBe(member.id);
    expect(row?.name).toBe("My Faves");

    signIn(guest.id);
    const before = await db.select().from(collections);
    const denied = await createCollectionAction({ name: "Nope" });
    expect(denied.success).toBe(false);
    const after = await db.select().from(collections);
    expect(after.length).toBe(before.length);
  });

  it("createCollectionAction: rejects blank name and unauthenticated", async () => {
    const db = await getTestDb();
    const member = createTestUser({ role: "member" });
    await db.insert(userProfiles).values(member);
    const { createCollectionAction } =
      await import("~/app/(app)/c/collections/actions");

    signIn(member.id);
    const blank = await createCollectionAction({ name: "   " });
    expect(blank.success).toBe(false);

    signOut();
    const anon = await createCollectionAction({ name: "Anon" });
    expect(anon.success).toBe(false);
  });

  it("updateCollectionMachinesAction: owner replaces membership (add + remove)", async () => {
    const db = await getTestDb();
    const owner = createTestUser({ role: "member" });
    await db.insert(userProfiles).values(owner);
    const a = createTestMachine({ initials: "AA", name: "A" });
    const b = createTestMachine({ initials: "BB", name: "B" });
    const c = createTestMachine({ initials: "CC", name: "C" });
    await db.insert(machines).values([a, b, c]);
    const [collection] = await db
      .insert(collections)
      .values({ name: "Set", ownerId: owner.id })
      .returning();
    await db
      .insert(collectionMachines)
      .values({ collectionId: collection.id, machineId: a.id });

    const { updateCollectionMachinesAction } =
      await import("~/app/(app)/c/collections/actions");
    signIn(owner.id);
    const result = await updateCollectionMachinesAction({
      collectionId: collection.id,
      machineIds: [b.id, c.id],
    });
    expect(result.success).toBe(true);
    expect(await membershipOf(collection.id)).toEqual(new Set([b.id, c.id]));
  });

  it("updateCollectionMachinesAction: rejects unknown machine id, membership unchanged", async () => {
    const db = await getTestDb();
    const owner = createTestUser({ role: "member" });
    await db.insert(userProfiles).values(owner);
    const a = createTestMachine({ initials: "AA", name: "A" });
    await db.insert(machines).values(a);
    const [collection] = await db
      .insert(collections)
      .values({ name: "Set", ownerId: owner.id })
      .returning();
    await db
      .insert(collectionMachines)
      .values({ collectionId: collection.id, machineId: a.id });

    const { updateCollectionMachinesAction } =
      await import("~/app/(app)/c/collections/actions");
    signIn(owner.id);
    const result = await updateCollectionMachinesAction({
      collectionId: collection.id,
      machineIds: [a.id, crypto.randomUUID()],
    });
    expect(result.success).toBe(false);
    expect(await membershipOf(collection.id)).toEqual(new Set([a.id]));
  });

  it("updateCollectionMachinesAction: non-owner denied, membership unchanged", async () => {
    const db = await getTestDb();
    const owner = createTestUser({ role: "member" });
    const intruder = createTestUser({ role: "admin" });
    await db.insert(userProfiles).values([owner, intruder]);
    const a = createTestMachine({ initials: "AA", name: "A" });
    const b = createTestMachine({ initials: "BB", name: "B" });
    await db.insert(machines).values([a, b]);
    const [collection] = await db
      .insert(collections)
      .values({ name: "Set", ownerId: owner.id })
      .returning();
    await db
      .insert(collectionMachines)
      .values({ collectionId: collection.id, machineId: a.id });

    const { updateCollectionMachinesAction } =
      await import("~/app/(app)/c/collections/actions");
    // Admin is not the owner — manage is owner-only.
    signIn(intruder.id);
    const result = await updateCollectionMachinesAction({
      collectionId: collection.id,
      machineIds: [b.id],
    });
    expect(result.success).toBe(false);
    expect(await membershipOf(collection.id)).toEqual(new Set([a.id]));
  });

  it("renameCollectionAction / deleteCollectionAction: owner only", async () => {
    const db = await getTestDb();
    const owner = createTestUser({ role: "member" });
    const other = createTestUser({ role: "member" });
    await db.insert(userProfiles).values([owner, other]);
    const [collection] = await db
      .insert(collections)
      .values({ name: "Original", ownerId: owner.id })
      .returning();

    const { renameCollectionAction, deleteCollectionAction } =
      await import("~/app/(app)/c/collections/actions");

    // Non-owner rename denied — name unchanged.
    signIn(other.id);
    const denied = await renameCollectionAction({
      collectionId: collection.id,
      name: "Hijacked",
    });
    expect(denied.success).toBe(false);
    let row = await db.query.collections.findFirst({
      where: eq(collections.id, collection.id),
    });
    expect(row?.name).toBe("Original");

    // Owner rename succeeds.
    signIn(owner.id);
    const renamed = await renameCollectionAction({
      collectionId: collection.id,
      name: "Renamed",
    });
    expect(renamed.success).toBe(true);
    row = await db.query.collections.findFirst({
      where: eq(collections.id, collection.id),
    });
    expect(row?.name).toBe("Renamed");

    // Non-owner delete denied — row still present.
    signIn(other.id);
    const delDenied = await deleteCollectionAction({
      collectionId: collection.id,
    });
    expect(delDenied.success).toBe(false);
    expect(
      await db.query.collections.findFirst({
        where: eq(collections.id, collection.id),
      })
    ).toBeTruthy();

    // Owner delete succeeds.
    signIn(owner.id);
    const deleted = await deleteCollectionAction({
      collectionId: collection.id,
    });
    expect(deleted.success).toBe(true);
    expect(
      await db.query.collections.findFirst({
        where: eq(collections.id, collection.id),
      })
    ).toBeUndefined();
  });
});
