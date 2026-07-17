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

  it("createCollectionAction: creates with initial machines attached", async () => {
    const db = await getTestDb();
    const member = createTestUser({ role: "member" });
    await db.insert(userProfiles).values(member);
    const a = createTestMachine({ initials: "AA", name: "A" });
    const b = createTestMachine({ initials: "BB", name: "B" });
    await db.insert(machines).values([a, b]);
    const { createCollectionAction } =
      await import("~/app/(app)/c/collections/actions");

    signIn(member.id);
    const created = await createCollectionAction({
      name: "Bank",
      machineIds: [a.id, b.id],
    });
    expect(created.success).toBe(true);
    if (!created.success) throw new Error("expected success");
    expect(await membershipOf(created.data?.id ?? "")).toEqual(
      new Set([a.id, b.id])
    );
  });

  it("createCollectionAction: rejects an unknown initial machine id", async () => {
    const db = await getTestDb();
    const member = createTestUser({ role: "member" });
    await db.insert(userProfiles).values(member);
    const { createCollectionAction } =
      await import("~/app/(app)/c/collections/actions");

    signIn(member.id);
    const before = await db.select().from(collections);
    const result = await createCollectionAction({
      name: "Bank",
      machineIds: [crypto.randomUUID()],
    });
    expect(result.success).toBe(false);
    // Nothing persists when validation fails before the transaction.
    const after = await db.select().from(collections);
    expect(after.length).toBe(before.length);
  });

  async function nameOf(collectionId: string): Promise<string | undefined> {
    const db = await getTestDb();
    const row = await db.query.collections.findFirst({
      where: eq(collections.id, collectionId),
    });
    return row?.name;
  }

  it("updateCollectionAction: owner updates name + machines together (add + remove)", async () => {
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

    const { updateCollectionAction } =
      await import("~/app/(app)/c/collections/actions");
    signIn(owner.id);
    const result = await updateCollectionAction({
      collectionId: collection.id,
      name: "Renamed Set",
      machineIds: [b.id, c.id],
    });
    expect(result.success).toBe(true);
    expect(await nameOf(collection.id)).toBe("Renamed Set");
    expect(await membershipOf(collection.id)).toEqual(new Set([b.id, c.id]));
  });

  it("updateCollectionAction: rejects unknown machine id, name + membership unchanged", async () => {
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

    const { updateCollectionAction } =
      await import("~/app/(app)/c/collections/actions");
    signIn(owner.id);
    const result = await updateCollectionAction({
      collectionId: collection.id,
      name: "New Name",
      machineIds: [a.id, crypto.randomUUID()],
    });
    expect(result.success).toBe(false);
    // Validation happens before the transaction — nothing persists.
    expect(await nameOf(collection.id)).toBe("Set");
    expect(await membershipOf(collection.id)).toEqual(new Set([a.id]));
  });

  it("updateCollectionAction: rejects blank name, name + membership unchanged", async () => {
    const db = await getTestDb();
    const owner = createTestUser({ role: "member" });
    await db.insert(userProfiles).values(owner);
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

    const { updateCollectionAction } =
      await import("~/app/(app)/c/collections/actions");
    signIn(owner.id);
    const result = await updateCollectionAction({
      collectionId: collection.id,
      name: "   ",
      machineIds: [a.id, b.id],
    });
    expect(result.success).toBe(false);
    expect(await nameOf(collection.id)).toBe("Set");
    expect(await membershipOf(collection.id)).toEqual(new Set([a.id]));
  });

  it("updateCollectionAction: non-owner denied, name + membership unchanged", async () => {
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

    const { updateCollectionAction } =
      await import("~/app/(app)/c/collections/actions");
    // Admin is not the owner — manage is owner-only.
    signIn(intruder.id);
    const result = await updateCollectionAction({
      collectionId: collection.id,
      name: "Hijacked",
      machineIds: [b.id],
    });
    expect(result.success).toBe(false);
    expect(await nameOf(collection.id)).toBe("Set");
    expect(await membershipOf(collection.id)).toEqual(new Set([a.id]));
  });

  it("updateCollectionAction: missing collection returns not found", async () => {
    const db = await getTestDb();
    const owner = createTestUser({ role: "member" });
    await db.insert(userProfiles).values(owner);

    const { updateCollectionAction } =
      await import("~/app/(app)/c/collections/actions");
    signIn(owner.id);
    const result = await updateCollectionAction({
      collectionId: crypto.randomUUID(),
      name: "Whatever",
      machineIds: [],
    });
    expect(result.success).toBe(false);
  });

  async function tokenOf(collectionId: string): Promise<string | null> {
    const db = await getTestDb();
    const row = await db.query.collections.findFirst({
      where: eq(collections.id, collectionId),
      columns: { viewToken: true },
    });
    return row?.viewToken ?? null;
  }

  it("setCollectionSharingAction: enable mints a token, disable nulls it, enable is idempotent", async () => {
    const db = await getTestDb();
    const owner = createTestUser({ role: "member" });
    await db.insert(userProfiles).values(owner);
    const [collection] = await db
      .insert(collections)
      .values({ name: "Bank", ownerId: owner.id })
      .returning();

    const { setCollectionSharingAction } =
      await import("~/app/(app)/c/collections/actions");
    signIn(owner.id);

    // Off by default.
    expect(await tokenOf(collection.id)).toBeNull();

    // Enable mints a token.
    const enabled = await setCollectionSharingAction({
      collectionId: collection.id,
      enabled: true,
    });
    expect(enabled.success).toBe(true);
    if (!enabled.success) throw new Error("expected success");
    const token = enabled.data?.viewToken ?? null;
    expect(token).toBeTruthy();
    expect(await tokenOf(collection.id)).toBe(token);

    // Enabling again keeps the same token (stable link).
    const again = await setCollectionSharingAction({
      collectionId: collection.id,
      enabled: true,
    });
    expect(again.success && again.data?.viewToken).toBe(token);

    // Disable nulls it (revokes all links).
    const disabled = await setCollectionSharingAction({
      collectionId: collection.id,
      enabled: false,
    });
    expect(disabled.success).toBe(true);
    if (!disabled.success) throw new Error("expected success");
    expect(disabled.data?.viewToken).toBeNull();
    expect(await tokenOf(collection.id)).toBeNull();
  });

  it("setCollectionSharingAction: non-owner and unauthenticated denied", async () => {
    const db = await getTestDb();
    const owner = createTestUser({ role: "member" });
    const intruder = createTestUser({ role: "admin" });
    await db.insert(userProfiles).values([owner, intruder]);
    const [collection] = await db
      .insert(collections)
      .values({ name: "Bank", ownerId: owner.id })
      .returning();

    const { setCollectionSharingAction } =
      await import("~/app/(app)/c/collections/actions");

    // Admin is not the owner — sharing is owner-only.
    signIn(intruder.id);
    const denied = await setCollectionSharingAction({
      collectionId: collection.id,
      enabled: true,
    });
    expect(denied.success).toBe(false);
    expect(await tokenOf(collection.id)).toBeNull();

    signOut();
    const anon = await setCollectionSharingAction({
      collectionId: collection.id,
      enabled: true,
    });
    expect(anon.success).toBe(false);
    expect(await tokenOf(collection.id)).toBeNull();
  });

  it("resetCollectionViewLinkAction: rotates the token; non-owner denied", async () => {
    const db = await getTestDb();
    const owner = createTestUser({ role: "member" });
    const other = createTestUser({ role: "member" });
    await db.insert(userProfiles).values([owner, other]);
    const [collection] = await db
      .insert(collections)
      .values({ name: "Bank", ownerId: owner.id, viewToken: "original-token" })
      .returning();

    const { resetCollectionViewLinkAction } =
      await import("~/app/(app)/c/collections/actions");

    // Non-owner cannot rotate — token unchanged.
    signIn(other.id);
    const denied = await resetCollectionViewLinkAction({
      collectionId: collection.id,
    });
    expect(denied.success).toBe(false);
    expect(await tokenOf(collection.id)).toBe("original-token");

    // Owner rotates — new token, old one dead.
    signIn(owner.id);
    const reset = await resetCollectionViewLinkAction({
      collectionId: collection.id,
    });
    expect(reset.success).toBe(true);
    if (!reset.success) throw new Error("expected success");
    const rotated = reset.data?.viewToken ?? null;
    expect(rotated).toBeTruthy();
    expect(rotated).not.toBe("original-token");
    expect(await tokenOf(collection.id)).toBe(rotated);
  });

  it("deleteCollectionAction: owner only", async () => {
    const db = await getTestDb();
    const owner = createTestUser({ role: "member" });
    const other = createTestUser({ role: "member" });
    await db.insert(userProfiles).values([owner, other]);
    const [collection] = await db
      .insert(collections)
      .values({ name: "Original", ownerId: owner.id })
      .returning();

    const { deleteCollectionAction } =
      await import("~/app/(app)/c/collections/actions");

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
