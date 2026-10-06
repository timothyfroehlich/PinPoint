import { beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { createTestMachine, createTestUser } from "~/test/helpers/factories";
import {
  collections,
  collectionMachines,
  collectionCollaborators,
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

  it("setCollectionSharingAction: disabling revokes a live link (old token no longer resolves)", async () => {
    const db = await getTestDb();
    const owner = createTestUser({ role: "member" });
    await db.insert(userProfiles).values(owner);
    const [collection] = await db
      .insert(collections)
      .values({ name: "Bank", ownerId: owner.id })
      .returning();

    const { setCollectionSharingAction } =
      await import("~/app/(app)/c/collections/actions");
    const { getCollectionByViewToken } = await import("~/lib/collections/user");
    signIn(owner.id);

    // Enable and confirm the minted token resolves the collection — the link is
    // live (this is exactly what the /c/<token> resolver does).
    const enabled = await setCollectionSharingAction({
      collectionId: collection.id,
      enabled: true,
    });
    if (!enabled.success) throw new Error("expected success");
    const token = enabled.data?.viewToken ?? "";
    expect(token).toBeTruthy();
    expect((await getCollectionByViewToken(undefined, token))?.id).toBe(
      collection.id
    );

    // Disable, then the same token must be dead — the resolver returns null, so
    // /c/<token> 404s. This is the revocation guarantee for shared links.
    const disabled = await setCollectionSharingAction({
      collectionId: collection.id,
      enabled: false,
    });
    if (!disabled.success) throw new Error("expected success");
    expect(await getCollectionByViewToken(undefined, token)).toBeNull();

    // Re-enabling mints a fresh token; the revoked one stays dead forever.
    const reEnabled = await setCollectionSharingAction({
      collectionId: collection.id,
      enabled: true,
    });
    if (!reEnabled.success) throw new Error("expected success");
    expect(reEnabled.data?.viewToken).not.toBe(token);
    expect(await getCollectionByViewToken(undefined, token)).toBeNull();
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

  it("setCollectionSharingAction: rejects a stringified enabled without touching sharing", async () => {
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

    // A form/RPC caller can smuggle the string "false" past the compile-time
    // boolean type. Pre-fix, `!"false"` is falsy so the action took the ENABLE
    // branch and minted a token — the opposite of the owner's intent. Zod's
    // z.boolean() (no coercion) must reject it, leaving sharing untouched.
    const result = await setCollectionSharingAction({
      collectionId: collection.id,
      enabled: "false",
    } as unknown as { collectionId: string; enabled: boolean });
    expect(result.success).toBe(false);
    expect(await tokenOf(collection.id)).toBeNull();
  });

  it("setCollectionSharingAction: rejects a non-uuid collectionId", async () => {
    const { setCollectionSharingAction } =
      await import("~/app/(app)/c/collections/actions");
    const owner = createTestUser({ role: "member" });
    const db = await getTestDb();
    await db.insert(userProfiles).values(owner);
    signIn(owner.id);

    const result = await setCollectionSharingAction({
      collectionId: "not-a-uuid",
      enabled: true,
    });
    expect(result.success).toBe(false);
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

  it("updateCollectionAction: an editor collaborator can edit; a stranger cannot", async () => {
    const db = await getTestDb();
    const owner = createTestUser({ role: "member" });
    const editor = createTestUser({ role: "member" });
    const stranger = createTestUser({ role: "member" });
    await db.insert(userProfiles).values([owner, editor, stranger]);
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
    await db.insert(collectionCollaborators).values({
      collectionId: collection.id,
      userId: editor.id,
      role: "editor",
      addedBy: owner.id,
    });

    const { updateCollectionAction } =
      await import("~/app/(app)/c/collections/actions");

    // The granted editor can rename + change machines.
    signIn(editor.id);
    const ok = await updateCollectionAction({
      collectionId: collection.id,
      name: "Renamed",
      machineIds: [b.id],
    });
    expect(ok.success).toBe(true);
    expect(await nameOf(collection.id)).toBe("Renamed");
    expect(await membershipOf(collection.id)).toEqual(new Set([b.id]));

    // A signed-in non-collaborator cannot.
    signIn(stranger.id);
    const denied = await updateCollectionAction({
      collectionId: collection.id,
      name: "Nope",
      machineIds: [],
    });
    expect(denied.success).toBe(false);
  });

  it("addCollectionCollaboratorAction: owner-only, idempotent", async () => {
    const db = await getTestDb();
    const owner = createTestUser({ role: "member" });
    const target = createTestUser({ role: "member" });
    const other = createTestUser({ role: "member" });
    await db.insert(userProfiles).values([owner, target, other]);
    const [collection] = await db
      .insert(collections)
      .values({ name: "Bank", ownerId: owner.id })
      .returning();

    const { addCollectionCollaboratorAction } =
      await import("~/app/(app)/c/collections/actions");

    signIn(owner.id);
    expect(
      (
        await addCollectionCollaboratorAction({
          collectionId: collection.id,
          userId: target.id,
        })
      ).success
    ).toBe(true);
    // Second grant of the same person is a no-op, not a duplicate row.
    expect(
      (
        await addCollectionCollaboratorAction({
          collectionId: collection.id,
          userId: target.id,
        })
      ).success
    ).toBe(true);
    const rows = await db
      .select()
      .from(collectionCollaborators)
      .where(eq(collectionCollaborators.collectionId, collection.id));
    expect(rows).toHaveLength(1);

    // A non-owner cannot grant.
    signIn(target.id);
    const denied = await addCollectionCollaboratorAction({
      collectionId: collection.id,
      userId: other.id,
    });
    expect(denied.success).toBe(false);
  });

  it("addCollectionCollaboratorAction: rejects a guest target", async () => {
    const db = await getTestDb();
    const owner = createTestUser({ role: "member" });
    const guest = createTestUser({ role: "guest" });
    await db.insert(userProfiles).values([owner, guest]);
    const [collection] = await db
      .insert(collections)
      .values({ name: "Bank", ownerId: owner.id })
      .returning();

    const { addCollectionCollaboratorAction } =
      await import("~/app/(app)/c/collections/actions");

    // Guests can't create collections, so they can't be granted edit access.
    signIn(owner.id);
    const denied = await addCollectionCollaboratorAction({
      collectionId: collection.id,
      userId: guest.id,
    });
    expect(denied.success).toBe(false);
    const rows = await db
      .select()
      .from(collectionCollaborators)
      .where(eq(collectionCollaborators.collectionId, collection.id));
    expect(rows).toHaveLength(0);
  });

  it("removeCollectionCollaboratorAction: owner removes; editor then loses edit", async () => {
    const db = await getTestDb();
    const owner = createTestUser({ role: "member" });
    const editor = createTestUser({ role: "member" });
    await db.insert(userProfiles).values([owner, editor]);
    const [collection] = await db
      .insert(collections)
      .values({ name: "Bank", ownerId: owner.id })
      .returning();
    await db.insert(collectionCollaborators).values({
      collectionId: collection.id,
      userId: editor.id,
      role: "editor",
      addedBy: owner.id,
    });

    const { updateCollectionAction, removeCollectionCollaboratorAction } =
      await import("~/app/(app)/c/collections/actions");

    // Editor can edit while granted.
    signIn(editor.id);
    expect(
      (
        await updateCollectionAction({
          collectionId: collection.id,
          name: "By Editor",
          machineIds: [],
        })
      ).success
    ).toBe(true);

    // Owner revokes; a non-owner cannot revoke.
    signIn(editor.id);
    const revokeDenied = await removeCollectionCollaboratorAction({
      collectionId: collection.id,
      userId: editor.id,
    });
    expect(revokeDenied.success).toBe(false);

    signIn(owner.id);
    expect(
      (
        await removeCollectionCollaboratorAction({
          collectionId: collection.id,
          userId: editor.id,
        })
      ).success
    ).toBe(true);

    // The removed editor immediately loses edit access.
    signIn(editor.id);
    const denied = await updateCollectionAction({
      collectionId: collection.id,
      name: "Nope",
      machineIds: [],
    });
    expect(denied.success).toBe(false);
  });
});
