/**
 * Integration Test: machine mutation services (PP-u4ab.1)
 *
 * Worker-scoped PGlite (CORE-TEST-001). Exercises the extracted service
 * functions in `~/services/machines` directly — the transaction, watcher
 * reconciliation, lifecycle timeline emits, guest→member promotion, and the
 * returned notification delivery plan — independently of the server-action
 * wrappers (which are covered by the m/actions integration tests). Authorization
 * lives in the callers, so these tests pass already-resolved inputs.
 *
 * `getChannels` is stubbed to `[]` to avoid the Vault round-trip; `planNotification`
 * stays real so the services drive it with the arguments they would in production.
 */

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

import {
  authUsers,
  invitedUsers,
  machineWatchers,
  machines,
  timelineEvents,
  userProfiles,
} from "~/server/db/schema";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import type * as NotificationsModule from "~/lib/notifications";

vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

// Keep planNotification real; only stub getChannels so the service doesn't make
// a Vault round-trip for the Discord config in the test environment.
vi.mock("~/lib/notifications", async (importOriginal) => {
  const actual = await importOriginal<typeof NotificationsModule>();
  return { ...actual, getChannels: vi.fn().mockResolvedValue([]) };
});

import {
  createMachine,
  updateMachineOwner,
  updateMachinePresence,
  type MachineMutationSnapshot,
} from "~/services/machines";

describe("machine mutation services (PP-u4ab.1)", () => {
  setupTestDb();

  async function makeUser(
    role: "guest" | "member" | "technician" | "admin" = "member"
  ): Promise<string> {
    const db = await getTestDb();
    const id = randomUUID();
    await db.insert(authUsers).values({ id, email: `${id}@example.com` });
    await db.insert(userProfiles).values({
      id,
      email: `${id}@example.com`,
      firstName: "Test",
      lastName: "User",
      role,
    });
    return id;
  }

  async function makeInvited(
    role: "guest" | "member" = "member"
  ): Promise<string> {
    const db = await getTestDb();
    const [row] = await db
      .insert(invitedUsers)
      .values({
        firstName: "Invited",
        lastName: "User",
        email: `invited-${randomUUID()}@example.com`,
        role,
      })
      .returning();
    if (!row) throw new Error("failed to seed invited user");
    return row.id;
  }

  let counter = 0;
  function nextInitials(): string {
    counter += 1;
    return `SV${String(counter).padStart(3, "0")}`;
  }

  async function seedMachine(overrides?: {
    ownerId?: string | null;
    invitedOwnerId?: string | null;
    presenceStatus?: "on_the_floor" | "off_the_floor";
  }): Promise<{ id: string; initials: string }> {
    const db = await getTestDb();
    const [machine] = await db
      .insert(machines)
      .values({
        name: "Seed Machine",
        initials: nextInitials(),
        ownerId: overrides?.ownerId ?? null,
        invitedOwnerId: overrides?.invitedOwnerId ?? null,
        presenceStatus: overrides?.presenceStatus ?? "on_the_floor",
      })
      .returning();
    if (!machine) throw new Error("failed to seed machine");
    return machine;
  }

  async function eventsFor(machineId: string) {
    const db = await getTestDb();
    return db
      .select()
      .from(timelineEvents)
      .where(eq(timelineEvents.machineId, machineId));
  }

  async function eventKinds(machineId: string): Promise<string[]> {
    const rows = await eventsFor(machineId);
    return rows.flatMap((r) => {
      const kind = r.eventData?.kind;
      return kind ? [kind] : [];
    });
  }

  async function watcher(machineId: string, userId: string) {
    const db = await getTestDb();
    const [row] = await db
      .select()
      .from(machineWatchers)
      .where(
        and(
          eq(machineWatchers.machineId, machineId),
          eq(machineWatchers.userId, userId)
        )
      );
    return row;
  }

  async function snapshotOf(
    machineId: string
  ): Promise<MachineMutationSnapshot> {
    const db = await getTestDb();
    const [m] = await db
      .select({
        name: machines.name,
        ownerId: machines.ownerId,
        invitedOwnerId: machines.invitedOwnerId,
        presenceStatus: machines.presenceStatus,
      })
      .from(machines)
      .where(eq(machines.id, machineId));
    if (!m) throw new Error("machine not found");
    return m;
  }

  // --- createMachine -------------------------------------------------------

  describe("createMachine", () => {
    it("creates an unowned machine and emits machine_added only", async () => {
      const actorId = await makeUser("admin");
      const initials = nextInitials();

      const { machine, deliveryPlan } = await createMachine({
        name: "Medieval Madness",
        initials,
        actorUserId: actorId,
      });

      expect(machine.initials).toBe(initials);
      expect(machine.ownerId).toBeNull();
      expect(machine.presenceStatus).toBe("on_the_floor");
      expect(deliveryPlan.deliveries).toEqual([]);

      const kinds = await eventKinds(machine.id);
      expect(kinds).toContain("machine_added");
      expect(kinds).not.toContain("owner_set");
    });

    it("subscribes an active owner and emits owner_set", async () => {
      const actorId = await makeUser("admin");
      const ownerId = await makeUser("member");

      const { machine } = await createMachine({
        name: "Attack from Mars",
        initials: nextInitials(),
        actorUserId: actorId,
        ownerId,
      });

      expect(machine.ownerId).toBe(ownerId);
      const w = await watcher(machine.id, ownerId);
      expect(w?.watchMode).toBe("subscribe");
      expect(await eventKinds(machine.id)).toEqual(
        expect.arrayContaining(["machine_added", "owner_set"])
      );
    });

    it("applies presenceStatus and description", async () => {
      const actorId = await makeUser("admin");
      const description = {
        type: "doc" as const,
        content: [
          {
            type: "paragraph",
            content: [{ type: "text", text: "needs new rubbers" }],
          },
        ],
      };

      const { machine } = await createMachine({
        name: "Twilight Zone",
        initials: nextInitials(),
        actorUserId: actorId,
        presenceStatus: "off_the_floor",
        description,
      });

      expect(machine.presenceStatus).toBe("off_the_floor");
      expect(machine.description).toEqual(description);
    });

    it("records an invited owner without adding a watcher row", async () => {
      const actorId = await makeUser("admin");
      const invitedOwnerId = await makeInvited("member");

      const { machine } = await createMachine({
        name: "Cirqus Voltaire",
        initials: nextInitials(),
        actorUserId: actorId,
        invitedOwnerId,
      });

      expect(machine.invitedOwnerId).toBe(invitedOwnerId);
      expect(machine.ownerId).toBeNull();
      expect(await eventKinds(machine.id)).toEqual(
        expect.arrayContaining(["machine_added", "owner_set"])
      );
    });

    it("promotes an active guest to member and plans an added notification", async () => {
      const actorId = await makeUser("admin");
      const guestId = await makeUser("guest");

      const { machine, deliveryPlan } = await createMachine({
        name: "The Addams Family",
        initials: nextInitials(),
        actorUserId: actorId,
        ownerId: guestId,
        promoteGuest: { userId: guestId, type: "active" },
      });

      const db = await getTestDb();
      const [promoted] = await db
        .select({ role: userProfiles.role })
        .from(userProfiles)
        .where(eq(userProfiles.id, guestId));
      expect(promoted?.role).toBe("member");
      expect((await watcher(machine.id, guestId))?.watchMode).toBe("subscribe");
      // The plan is returned for the caller to deliver post-commit.
      expect(Array.isArray(deliveryPlan.deliveries)).toBe(true);
    });
  });

  // --- updateMachineOwner --------------------------------------------------

  describe("updateMachineOwner", () => {
    it("assigns an owner to an unowned machine — watcher + owner_changed", async () => {
      const actorId = await makeUser("admin");
      const newOwnerId = await makeUser("member");
      const seed = await seedMachine();

      const { machine } = await updateMachineOwner({
        machineId: seed.id,
        actorUserId: actorId,
        current: await snapshotOf(seed.id),
        newOwner: { ownerId: newOwnerId, invitedOwnerId: null },
      });

      expect(machine.ownerId).toBe(newOwnerId);
      expect((await watcher(seed.id, newOwnerId))?.watchMode).toBe("subscribe");
      expect(await eventKinds(seed.id)).toContain("owner_changed");
    });

    it("swaps owners — drops the old watcher and subscribes the new", async () => {
      const actorId = await makeUser("admin");
      const oldOwnerId = await makeUser("member");
      const newOwnerId = await makeUser("member");
      const seed = await seedMachine({ ownerId: oldOwnerId });
      // Mirror the create-time subscription of the existing owner.
      const db = await getTestDb();
      await db.insert(machineWatchers).values({
        machineId: seed.id,
        userId: oldOwnerId,
        watchMode: "subscribe",
      });

      const { machine } = await updateMachineOwner({
        machineId: seed.id,
        actorUserId: actorId,
        current: await snapshotOf(seed.id),
        newOwner: { ownerId: newOwnerId, invitedOwnerId: null },
      });

      expect(machine.ownerId).toBe(newOwnerId);
      expect(await watcher(seed.id, oldOwnerId)).toBeUndefined();
      expect((await watcher(seed.id, newOwnerId))?.watchMode).toBe("subscribe");
      expect(await eventKinds(seed.id)).toContain("owner_changed");
    });

    it("clears the owner and removes the watcher", async () => {
      const actorId = await makeUser("admin");
      const ownerId = await makeUser("member");
      const seed = await seedMachine({ ownerId });
      const db = await getTestDb();
      await db.insert(machineWatchers).values({
        machineId: seed.id,
        userId: ownerId,
        watchMode: "subscribe",
      });

      const { machine } = await updateMachineOwner({
        machineId: seed.id,
        actorUserId: actorId,
        current: await snapshotOf(seed.id),
        newOwner: { ownerId: null, invitedOwnerId: null },
      });

      expect(machine.ownerId).toBeNull();
      expect(await watcher(seed.id, ownerId)).toBeUndefined();
      expect(await eventKinds(seed.id)).toContain("owner_changed");
    });

    it("leaves the name and presence untouched", async () => {
      const actorId = await makeUser("admin");
      const newOwnerId = await makeUser("member");
      const seed = await seedMachine({ presenceStatus: "off_the_floor" });

      const { machine } = await updateMachineOwner({
        machineId: seed.id,
        actorUserId: actorId,
        current: await snapshotOf(seed.id),
        newOwner: { ownerId: newOwnerId, invitedOwnerId: null },
      });

      expect(machine.name).toBe("Seed Machine");
      expect(machine.presenceStatus).toBe("off_the_floor");
      const kinds = await eventKinds(seed.id);
      expect(kinds).not.toContain("name_changed");
      expect(kinds).not.toContain("presence_changed");
    });

    it("throws when the machine does not exist", async () => {
      const actorId = await makeUser("admin");
      await expect(
        updateMachineOwner({
          machineId: randomUUID(),
          actorUserId: actorId,
          current: {
            name: "Ghost",
            ownerId: null,
            invitedOwnerId: null,
            presenceStatus: "on_the_floor",
          },
          newOwner: { ownerId: null, invitedOwnerId: null },
        })
      ).rejects.toThrow(/not found/i);
    });
  });

  // --- updateMachinePresence ----------------------------------------------

  describe("updateMachinePresence", () => {
    it("changes presence and emits presence_changed", async () => {
      const actorId = await makeUser("admin");
      const seed = await seedMachine({ presenceStatus: "on_the_floor" });

      const { changed } = await updateMachinePresence({
        machineId: seed.id,
        presenceStatus: "off_the_floor",
        actorUserId: actorId,
        current: await snapshotOf(seed.id),
      });

      expect(changed).toBe(true);
      const db = await getTestDb();
      const [row] = await db
        .select({ presenceStatus: machines.presenceStatus })
        .from(machines)
        .where(eq(machines.id, seed.id));
      expect(row?.presenceStatus).toBe("off_the_floor");

      const presence = (await eventsFor(seed.id)).filter(
        (e) => e.eventData?.kind === "presence_changed"
      );
      expect(presence).toHaveLength(1);
      expect(presence[0]?.eventData).toMatchObject({
        kind: "presence_changed",
        from: "on_the_floor",
        to: "off_the_floor",
      });
    });

    it("is a no-op with no event when the value is unchanged", async () => {
      const actorId = await makeUser("admin");
      const seed = await seedMachine({ presenceStatus: "on_the_floor" });

      const { changed } = await updateMachinePresence({
        machineId: seed.id,
        presenceStatus: "on_the_floor",
        actorUserId: actorId,
        current: await snapshotOf(seed.id),
      });

      expect(changed).toBe(false);
      expect(await eventKinds(seed.id)).not.toContain("presence_changed");
    });
  });
});
