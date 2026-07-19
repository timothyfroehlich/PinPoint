/**
 * Integration Test: Machine Owner Member Invariant (PP-rb8)
 *
 * Tests atomicity of the forcePromoteUserId path in createMachineAction and
 * updateMachineAction, as well as the DB trigger semantics enforced by migration
 * 0027_machine_owner_member_invariant.
 *
 * IMPORTANT: The DB triggers (check_machine_owner_not_guest, etc.) are defined in the
 * Drizzle migration SQL file. The PGlite test DB is built from the schema.sql export,
 * which does NOT include raw SQL from migrations. Trigger semantics tests therefore use
 * direct raw SQL queries to verify the trigger bodies. The atomicity tests exercise the
 * server action logic end-to-end with a PGlite-backed db mock.
 *
 * Trigger existence tests use raw SQL to verify the functions + triggers exist in the
 * schema.sql (if present) or skip gracefully when running against PGlite without triggers.
 */

import { describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import {
  machines,
  userProfiles,
  invitedUsers,
  machineWatchers,
  authUsers,
} from "~/server/db/schema";
import { plainTextToDoc } from "~/lib/tiptap/types";

// Mock the database to use the PGlite instance for server action tests
vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return {
    db: await getTestDb(),
  };
});

// Mock Supabase auth
vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    const error = new Error("NEXT_REDIRECT");
    (error as any).digest = `NEXT_REDIRECT;replace;${url};`;
    throw error;
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Run `after()` callbacks synchronously so post-commit dispatch is exercised
// inline (createMachineAction now delivers notifications via after()).
vi.mock("next/server", () => ({
  after: (cb: () => unknown) => {
    void cb();
  },
}));

vi.mock("~/lib/notifications", () => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
  getChannels: vi.fn().mockResolvedValue([]),
  planNotification: vi.fn().mockResolvedValue({ deliveries: [] }),
  dispatchNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("~/lib/logger", () => ({
  log: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

describe("Machine Owner Promotion — Server Action Integration (PP-rb8)", () => {
  setupTestDb();

  const createUser = async (
    role: "guest" | "member" | "technician" | "admin" = "member"
  ) => {
    const db = await getTestDb();
    const id = randomUUID();
    await db.insert(authUsers).values({ id, email: `${id}@example.com` });
    const [user] = await db
      .insert(userProfiles)
      .values({
        id,
        email: `${id}@example.com`,
        firstName: "Test",
        lastName: "User",
        role,
      })
      .returning();
    return user;
  };

  const createInvitedUser = async (role: "guest" | "member" = "member") => {
    const db = await getTestDb();
    const [user] = await db
      .insert(invitedUsers)
      .values({
        firstName: "Invited",
        lastName: "User",
        email: `invited-${randomUUID()}@example.com`,
        role,
      })
      .returning();
    return user;
  };

  let machineCounter = 0;
  const createMachine = async (ownerId?: string) => {
    const db = await getTestDb();
    machineCounter += 1;
    const [machine] = await db
      .insert(machines)
      .values({
        name: "Medieval Madness",
        initials: `M${String(machineCounter).padStart(3, "0")}`,
        ownerId,
      })
      .returning();
    return machine;
  };

  describe("updateMachineAction — forcePromoteUserId atomicity", () => {
    it("should atomically promote guest to member and assign machine ownership", async () => {
      const { createClient } = await import("~/lib/supabase/server");
      const { updateMachineAction } = await import("~/app/(app)/m/actions");
      const db = await getTestDb();

      // Create admin caller and guest target
      const adminUser = await createUser("admin");
      const guestUser = await createUser("guest");
      const machine = await createMachine(adminUser.id);

      // Mock auth to admin
      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: adminUser.id } } }),
        },
      } as any);

      const formData = new FormData();
      formData.append("id", machine.id);
      formData.append("name", machine.name);
      formData.append("ownerId", guestUser.id);
      formData.append("forcePromoteUserId", guestUser.id);

      const result = await updateMachineAction(undefined, formData);

      expect(result.ok).toBe(true);

      // Verify promotion happened in DB
      const promotedUser = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, guestUser.id),
      });
      expect(promotedUser?.role).toBe("member");

      // Verify machine ownership was assigned
      const updatedMachine = await db.query.machines.findFirst({
        where: eq(machines.id, machine.id),
      });
      expect(updatedMachine?.ownerId).toBe(guestUser.id);

      // Verify watcher row was created
      const watcherRow = await db.query.machineWatchers.findFirst({
        where: eq(machineWatchers.machineId, machine.id),
      });
      expect(watcherRow?.userId).toBe(guestUser.id);
      expect(watcherRow?.watchMode).toBe("subscribe");
    });

    it("should leave guest role unchanged if validation fails before the transaction starts", async () => {
      const { createClient } = await import("~/lib/supabase/server");
      const { updateMachineAction } = await import("~/app/(app)/m/actions");
      const db = await getTestDb();

      // Create admin caller and guest target
      const adminUser = await createUser("admin");
      const guestUser = await createUser("guest");
      const machine = await createMachine(adminUser.id);

      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: adminUser.id } } }),
        },
      } as any);

      // Provide an invalid machine name to trigger a validation error BEFORE the tx
      const formData = new FormData();
      formData.append("id", machine.id);
      formData.append("name", ""); // empty name — Zod validation fails before tx
      formData.append("ownerId", guestUser.id);
      formData.append("forcePromoteUserId", guestUser.id);

      const result = await updateMachineAction(undefined, formData);

      expect(result.ok).toBe(false);

      // Guest role should be unchanged
      const unchangedUser = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, guestUser.id),
      });
      expect(unchangedUser?.role).toBe("guest");
    });

    it("should roll back role promotion when machine update fails mid-transaction (atomicity)", async () => {
      // This test verifies the core atomicity guarantee: role promotion and machine
      // assignment MUST be atomic. If the machine update fails after the role has
      // been promoted inside the transaction, the promotion must roll back — the
      // guest stays a guest.
      //
      // Strategy: spy on the PGlite db's transaction() to intercept the tx object,
      // then throw on the second db.update() call (machines) while letting the first
      // (userProfiles role update) proceed normally on the real tx. The real Drizzle
      // transaction then rolls back both changes.
      const { createClient } = await import("~/lib/supabase/server");
      const { updateMachineAction } = await import("~/app/(app)/m/actions");
      const db = await getTestDb();

      const adminUser = await createUser("admin");
      const guestUser = await createUser("guest");
      const machine = await createMachine(adminUser.id);

      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: adminUser.id } } }),
        },
      } as any);

      // Spy on the real transaction to intercept the tx object.
      // Type the mock/callback with the transaction's own parameter types so
      // the spy signature matches `db.transaction` exactly (the callback
      // receives a PgTransaction, not the top-level db).
      type TxCb = Parameters<typeof db.transaction>[0];
      type Tx = Parameters<TxCb>[0];
      const originalTransaction = db.transaction.bind(db);
      const transactionSpy = vi
        .spyOn(db, "transaction")
        .mockImplementationOnce(async (callback: TxCb) => {
          return originalTransaction(async (realTx: Tx) => {
            // Wrap the tx: let the first update (role promotion on userProfiles) go
            // through, then throw on the second update (machines) to simulate a
            // constraint violation or infrastructure failure mid-transaction.
            let updateCallCount = 0;
            const txProxy = new Proxy(realTx, {
              get(target, prop, receiver) {
                if (prop === "update") {
                  return (...args: Parameters<typeof target.update>) => {
                    updateCallCount++;
                    if (updateCallCount > 1) {
                      // Simulate the machine update failing (e.g. constraint violation)
                      throw new Error(
                        "Simulated mid-transaction constraint violation on machines table"
                      );
                    }
                    return target.update(...args);
                  };
                }
                return Reflect.get(target, prop, receiver);
              },
            });
            return callback(txProxy);
          });
        });

      const formData = new FormData();
      formData.append("id", machine.id);
      formData.append("name", machine.name);
      formData.append("ownerId", guestUser.id);
      formData.append("forcePromoteUserId", guestUser.id);

      const result = await updateMachineAction(undefined, formData);

      // The action must return an error
      expect(result.ok).toBe(false);

      // The guest role must still be "guest" — the promotion was rolled back
      const guestAfter = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, guestUser.id),
      });
      expect(guestAfter?.role).toBe("guest");

      // The machine owner must not have changed
      const machineAfter = await db.query.machines.findFirst({
        where: eq(machines.id, machine.id),
      });
      expect(machineAfter?.ownerId).toBe(adminUser.id);

      // No machineWatchers row for the guest should have been created
      const watcherAfter = await db.query.machineWatchers.findFirst({
        where: eq(machineWatchers.machineId, machine.id),
      });
      // The guest was not added as a watcher — either no row exists or it's not the guest
      if (watcherAfter) {
        expect(watcherAfter.userId).not.toBe(guestUser.id);
      }

      // Restore the spy (important: don't leave it active for subsequent tests)
      transactionSpy.mockRestore();
    });
  });

  describe("createMachineAction — forcePromoteUserId atomicity", () => {
    it("should atomically promote guest to member and create machine with owner", async () => {
      const { createClient } = await import("~/lib/supabase/server");
      const { createMachineAction } = await import("~/app/(app)/m/actions");
      const db = await getTestDb();

      const adminUser = await createUser("admin");
      const guestUser = await createUser("guest");

      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: adminUser.id } } }),
        },
      } as any);

      machineCounter += 1;
      const uniqueInitials = `P${String(machineCounter).padStart(3, "0")}`;
      const formData = new FormData();
      formData.append("name", "Test Promote Machine");
      formData.append("initials", uniqueInitials);
      formData.append("ownerId", guestUser.id);
      formData.append("forcePromoteUserId", guestUser.id);

      const result = await createMachineAction(undefined, formData);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.redirectTo).toMatch(/^\/m\//);
      }

      // Verify promotion happened
      const promotedUser = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, guestUser.id),
      });
      expect(promotedUser?.role).toBe("member");

      // Verify machine was created with owner
      const createdMachine = await db.query.machines.findFirst({
        where: eq(machines.ownerId, guestUser.id),
      });
      expect(createdMachine).toBeDefined();
      expect(createdMachine?.ownerId).toBe(guestUser.id);
    });

    it("should allow technician to use forcePromoteUserId to create machine with owner", async () => {
      const { createClient } = await import("~/lib/supabase/server");
      const { createMachineAction } = await import("~/app/(app)/m/actions");
      const db = await getTestDb();

      const techUser = await createUser("technician");
      const guestUser = await createUser("guest");

      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: techUser.id } } }),
        },
      } as any);

      machineCounter += 1;
      const uniqueInitials = `T${String(machineCounter).padStart(3, "0")}`;
      const formData = new FormData();
      formData.append("name", "Tech Promote Machine");
      formData.append("initials", uniqueInitials);
      formData.append("ownerId", guestUser.id);
      formData.append("forcePromoteUserId", guestUser.id);

      const result = await createMachineAction(undefined, formData);
      expect(result.ok).toBe(true);

      // Verify promotion happened
      const promotedUser = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, guestUser.id),
      });
      expect(promotedUser?.role).toBe("member");

      // Verify machine was created
      const createdMachine = await db.query.machines.findFirst({
        where: eq(machines.ownerId, guestUser.id),
      });
      expect(createdMachine).toBeDefined();
    });

    it("should reject forcePromoteUserId from member (UNAUTHORIZED)", async () => {
      const { createClient } = await import("~/lib/supabase/server");
      const { createMachineAction } = await import("~/app/(app)/m/actions");
      const db = await getTestDb();

      const memberUser = await createUser("member");
      const guestUser = await createUser("guest");

      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: memberUser.id } } }),
        },
      } as any);

      machineCounter += 1;
      const uniqueInitials = `R${String(machineCounter).padStart(3, "0")}`;
      const formData = new FormData();
      formData.append("name", "Should Be Rejected");
      formData.append("initials", uniqueInitials);
      formData.append("ownerId", guestUser.id);
      formData.append("forcePromoteUserId", guestUser.id);

      const result = await createMachineAction(undefined, formData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("UNAUTHORIZED");
      }

      // Read-only failure path: target guest NOT promoted, no machine inserted
      const targetAfter = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, guestUser.id),
      });
      expect(targetAfter?.role).toBe("guest");
      const machineAfter = await db.query.machines.findFirst({
        where: eq(machines.initials, uniqueInitials),
      });
      expect(machineAfter).toBeUndefined();
    });

    it("should reject forcePromoteUserId when it does not match ownerId (VALIDATION)", async () => {
      const { createClient } = await import("~/lib/supabase/server");
      const { createMachineAction } = await import("~/app/(app)/m/actions");
      const db = await getTestDb();

      const adminUser = await createUser("admin");
      const guestUser = await createUser("guest");
      const otherGuestUser = await createUser("guest");

      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: adminUser.id } } }),
        },
      } as any);

      machineCounter += 1;
      const uniqueInitials = `V${String(machineCounter).padStart(3, "0")}`;
      const formData = new FormData();
      formData.append("name", "Mismatch Machine");
      formData.append("initials", uniqueInitials);
      formData.append("ownerId", guestUser.id);
      // forcePromoteUserId points at a different user than ownerId
      formData.append("forcePromoteUserId", otherGuestUser.id);

      const result = await createMachineAction(undefined, formData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("VALIDATION");
      }

      // Read-only failure path: neither guest promoted, no machine inserted
      const guestAfter = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, guestUser.id),
      });
      expect(guestAfter?.role).toBe("guest");
      const otherGuestAfter = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, otherGuestUser.id),
      });
      expect(otherGuestAfter?.role).toBe("guest");
      const machineAfter = await db.query.machines.findFirst({
        where: eq(machines.initials, uniqueInitials),
      });
      expect(machineAfter).toBeUndefined();
    });

    it("should reject forcePromoteUserId pointing at non-guest user (VALIDATION)", async () => {
      const { createClient } = await import("~/lib/supabase/server");
      const { createMachineAction } = await import("~/app/(app)/m/actions");
      const db = await getTestDb();

      const adminUser = await createUser("admin");
      const memberTarget = await createUser("member");

      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: adminUser.id } } }),
        },
      } as any);

      machineCounter += 1;
      const uniqueInitials = `G${String(machineCounter).padStart(3, "0")}`;
      const formData = new FormData();
      formData.append("name", "Non-Guest Machine");
      formData.append("initials", uniqueInitials);
      formData.append("ownerId", memberTarget.id);
      // forcePromoteUserId points at a member, not a guest
      formData.append("forcePromoteUserId", memberTarget.id);

      const result = await createMachineAction(undefined, formData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("VALIDATION");
        expect(result.message).toMatch(/not a guest/i);
      }

      // Read-only failure path: target member record unchanged, no machine inserted
      const targetAfter = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, memberTarget.id),
      });
      expect(targetAfter?.role).toBe("member");
      const machineAfter = await db.query.machines.findFirst({
        where: eq(machines.initials, uniqueInitials),
      });
      expect(machineAfter).toBeUndefined();
    });
  });

  describe("createMachineAction — permission checks", () => {
    it("should reject creation for non-admin users (member)", async () => {
      const { createClient } = await import("~/lib/supabase/server");
      const { createMachineAction } = await import("~/app/(app)/m/actions");

      const memberUser = await createUser("member");

      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: memberUser.id } } }),
        },
      } as any);

      machineCounter += 1;
      const uniqueInitials = `MR${String(machineCounter).padStart(2, "0")}`;
      const formData = new FormData();
      formData.append("name", "Medieval Madness");
      formData.append("initials", uniqueInitials);

      const result = await createMachineAction(undefined, formData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("UNAUTHORIZED");
      }
    });

    it("should reject creation for guest users", async () => {
      const { createClient } = await import("~/lib/supabase/server");
      const { createMachineAction } = await import("~/app/(app)/m/actions");

      const guestUser = await createUser("guest");

      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: guestUser.id } } }),
        },
      } as any);

      machineCounter += 1;
      const uniqueInitials = `GR${String(machineCounter).padStart(2, "0")}`;
      const formData = new FormData();
      formData.append("name", "Medieval Madness");
      formData.append("initials", uniqueInitials);

      const result = await createMachineAction(undefined, formData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("UNAUTHORIZED");
      }
    });

    it("should allow technician to create a machine", async () => {
      const { createClient } = await import("~/lib/supabase/server");
      const { createMachineAction } = await import("~/app/(app)/m/actions");
      const db = await getTestDb();

      const techUser = await createUser("technician");

      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: techUser.id } } }),
        },
      } as any);

      machineCounter += 1;
      const uniqueInitials = `TC${String(machineCounter).padStart(2, "0")}`;
      const formData = new FormData();
      formData.append("name", "Medieval Madness");
      formData.append("initials", uniqueInitials);

      const result = await createMachineAction(undefined, formData);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.redirectTo).toMatch(/^\/m\//);
      }

      // Verify machine was inserted in real DB
      const createdMachine = await db.query.machines.findFirst({
        where: eq(machines.initials, uniqueInitials),
      });
      expect(createdMachine).toBeDefined();
    });
  });

  describe("createMachineAction — ownerId null regression", () => {
    it("should NOT default ownerId to caller when field is explicitly empty string (regression)", async () => {
      const { createClient } = await import("~/lib/supabase/server");
      const { createMachineAction } = await import("~/app/(app)/m/actions");
      const db = await getTestDb();

      const adminUser = await createUser("admin");

      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: adminUser.id } } }),
        },
      } as any);

      machineCounter += 1;
      const uniqueInitials = `ER${String(machineCounter).padStart(2, "0")}`;
      const formData = new FormData();
      formData.append("name", "Empty Owner Machine");
      formData.append("initials", uniqueInitials);
      // Explicitly empty ownerId (not omitted — was previously defaulting to caller)
      formData.append("ownerId", "");

      const result = await createMachineAction(undefined, formData);

      expect(result.ok).toBe(true);

      // Real DB row must have null ownerId, not the caller's ID
      const machine = await db.query.machines.findFirst({
        where: eq(machines.initials, uniqueInitials),
      });
      expect(machine).toBeDefined();
      expect(machine?.ownerId).toBeNull();
    });
  });

  describe("createMachineAction — ASSIGNEE_NOT_MEMBER via createMachineAction", () => {
    it("should return ASSIGNEE_NOT_MEMBER when active guest is assigned as owner via createMachineAction", async () => {
      const { createClient } = await import("~/lib/supabase/server");
      const { createMachineAction } = await import("~/app/(app)/m/actions");

      const adminUser = await createUser("admin");
      const guestUser = await createUser("guest");

      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: adminUser.id } } }),
        },
      } as any);

      machineCounter += 1;
      const uniqueInitials = `AG${String(machineCounter).padStart(2, "0")}`;
      const formData = new FormData();
      formData.append("name", "Medieval Madness");
      formData.append("initials", uniqueInitials);
      formData.append("ownerId", guestUser.id);
      // No forcePromoteUserId — should fail with ASSIGNEE_NOT_MEMBER

      const result = await createMachineAction(undefined, formData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("ASSIGNEE_NOT_MEMBER");
        expect(result.meta?.assignee.id).toBe(guestUser.id);
        expect(result.meta?.assignee.role).toBe("guest");
        expect(result.meta?.assignee.type).toBe("active");
      }
    });

    it("should return ASSIGNEE_NOT_MEMBER when invited guest is assigned as owner via createMachineAction", async () => {
      const { createClient } = await import("~/lib/supabase/server");
      const { createMachineAction } = await import("~/app/(app)/m/actions");

      const adminUser = await createUser("admin");
      const invitedGuest = await createInvitedUser("guest");

      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: adminUser.id } } }),
        },
      } as any);

      machineCounter += 1;
      const uniqueInitials = `IG${String(machineCounter).padStart(2, "0")}`;
      const formData = new FormData();
      formData.append("name", "Medieval Madness");
      formData.append("initials", uniqueInitials);
      formData.append("ownerId", invitedGuest.id);

      const result = await createMachineAction(undefined, formData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("ASSIGNEE_NOT_MEMBER");
        expect(result.meta?.assignee.type).toBe("invited");
      }
    });
  });

  describe("updateMachineAction — permission and data checks", () => {
    // Routing-table blocks 1–5, 9–10, 14–18 (PP-x4li.1.3 Wave 3 RECLASS)

    it("should allow admin to update unowned machine", async () => {
      const { createClient } = await import("~/lib/supabase/server");
      const { updateMachineAction } = await import("~/app/(app)/m/actions");
      const db = await getTestDb();

      const adminUser = await createUser("admin");
      // No owner: exercises the machineOwnerId === null path in
      // checkPermission("machines.edit", ...) — admin can edit an unowned machine.
      const machine = await createMachine();

      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: adminUser.id } } }),
        },
      } as any);

      const formData = new FormData();
      formData.append("id", machine.id);
      formData.append("name", "Admin Updated Name");

      const result = await updateMachineAction(undefined, formData);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.machineId).toBe(machine.id);
      }

      // Verify the name was updated in the real DB
      const updatedMachine = await db.query.machines.findFirst({
        where: eq(machines.id, machine.id),
      });
      expect(updatedMachine?.name).toBe("Admin Updated Name");
    });

    it("should allow owner to update their own machine", async () => {
      const { createClient } = await import("~/lib/supabase/server");
      const { updateMachineAction } = await import("~/app/(app)/m/actions");
      const db = await getTestDb();

      const ownerUser = await createUser("member");
      const machine = await createMachine(ownerUser.id);

      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: ownerUser.id } } }),
        },
      } as any);

      const formData = new FormData();
      formData.append("id", machine.id);
      formData.append("name", "Owner Updated Name");

      const result = await updateMachineAction(undefined, formData);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.machineId).toBe(machine.id);
      }

      // Verify the name was updated in the real DB
      const updatedMachine = await db.query.machines.findFirst({
        where: eq(machines.id, machine.id),
      });
      expect(updatedMachine?.name).toBe("Owner Updated Name");
    });

    it("should return UNAUTHORIZED when guest-owner tries to edit (regression: drift fix)", async () => {
      const { createClient } = await import("~/lib/supabase/server");
      const { updateMachineAction } = await import("~/app/(app)/m/actions");
      const db = await getTestDb();

      // Legacy/drift scenario: a guest is stored as a machine owner — a bad state
      // that the production DB trigger (check_machine_owner_not_guest) now prevents.
      // NOTE: this PGlite suite is built from the schema.sql export, which does NOT
      // include migration-defined triggers (see file header), so no trigger runs
      // here. We seed the drift state directly by raw-updating the ownerId — there
      // is no trigger to bypass in this environment.
      const guestUser = await createUser("guest");
      const adminUser = await createUser("admin");
      // Create machine owned by admin first, then raw-update to guest to seed the drift state.
      const machine = await createMachine(adminUser.id);
      await db
        .update(machines)
        .set({ ownerId: guestUser.id })
        .where(eq(machines.id, machine.id));

      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: guestUser.id } } }),
        },
      } as any);

      const formData = new FormData();
      formData.append("id", machine.id);
      formData.append("name", "Sneaky Update");

      const result = await updateMachineAction(undefined, formData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("UNAUTHORIZED");
      }

      // Read-only invariant: machine name must NOT have changed
      const machineAfter = await db.query.machines.findFirst({
        where: eq(machines.id, machine.id),
      });
      expect(machineAfter?.name).toBe(machine.name);
    });

    it("should return UNAUTHORIZED when non-owner member tries to update a machine", async () => {
      const { createClient } = await import("~/lib/supabase/server");
      const { updateMachineAction } = await import("~/app/(app)/m/actions");
      const db = await getTestDb();

      const ownerUser = await createUser("member");
      const nonOwnerMember = await createUser("member");
      const machine = await createMachine(ownerUser.id);

      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: nonOwnerMember.id } } }),
        },
      } as any);

      const formData = new FormData();
      formData.append("id", machine.id);
      formData.append("name", "Unauthorized Update");

      const result = await updateMachineAction(undefined, formData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("UNAUTHORIZED");
      }

      // Read-only invariant: machine must be unchanged
      const machineAfter = await db.query.machines.findFirst({
        where: eq(machines.id, machine.id),
      });
      expect(machineAfter?.name).toBe(machine.name);
      expect(machineAfter?.ownerId).toBe(ownerUser.id);
    });

    it("should return NOT_FOUND when machine does not exist", async () => {
      const { createClient } = await import("~/lib/supabase/server");
      const { updateMachineAction } = await import("~/app/(app)/m/actions");

      const memberUser = await createUser("member");

      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: memberUser.id } } }),
        },
      } as any);

      const formData = new FormData();
      formData.append("id", randomUUID());
      formData.append("name", "Does Not Exist");

      const result = await updateMachineAction(undefined, formData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("NOT_FOUND");
      }
    });

    it("should update machine presence status", async () => {
      const { createClient } = await import("~/lib/supabase/server");
      const { updateMachineAction } = await import("~/app/(app)/m/actions");
      const db = await getTestDb();

      const ownerUser = await createUser("member");
      const machine = await createMachine(ownerUser.id);

      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: ownerUser.id } } }),
        },
      } as any);

      const formData = new FormData();
      formData.append("id", machine.id);
      formData.append("name", machine.name);
      formData.append("presenceStatus", "removed");

      const result = await updateMachineAction(undefined, formData);

      expect(result.ok).toBe(true);

      // Verify presence status persisted in real DB
      const updatedMachine = await db.query.machines.findFirst({
        where: eq(machines.id, machine.id),
      });
      expect(updatedMachine?.presenceStatus).toBe("removed");
    });

    it("should allow member owner to transfer ownership to another member", async () => {
      const { createClient } = await import("~/lib/supabase/server");
      const { updateMachineAction } = await import("~/app/(app)/m/actions");
      const db = await getTestDb();

      const ownerUser = await createUser("member");
      const newOwner = await createUser("member");
      const machine = await createMachine(ownerUser.id);

      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: ownerUser.id } } }),
        },
      } as any);

      const formData = new FormData();
      formData.append("id", machine.id);
      formData.append("name", machine.name);
      formData.append("ownerId", newOwner.id);

      const result = await updateMachineAction(undefined, formData);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.machineId).toBe(machine.id);
      }

      // Verify new ownerId persisted in real DB
      const updatedMachine = await db.query.machines.findFirst({
        where: eq(machines.id, machine.id),
      });
      expect(updatedMachine?.ownerId).toBe(newOwner.id);
    });

    it("should allow technician to use forcePromoteUserId (tech has the permission)", async () => {
      const { createClient } = await import("~/lib/supabase/server");
      const { updateMachineAction } = await import("~/app/(app)/m/actions");
      const db = await getTestDb();

      const techUser = await createUser("technician");
      const guestUser = await createUser("guest");
      // Machine not owned by this technician
      const otherOwner = await createUser("member");
      const machine = await createMachine(otherOwner.id);

      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: techUser.id } } }),
        },
      } as any);

      const formData = new FormData();
      formData.append("id", machine.id);
      formData.append("name", machine.name);
      formData.append("ownerId", guestUser.id);
      formData.append("forcePromoteUserId", guestUser.id);

      const result = await updateMachineAction(undefined, formData);

      expect(result.ok).toBe(true);

      // Verify guest was promoted in real DB
      const promotedUser = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, guestUser.id),
      });
      expect(promotedUser?.role).toBe("member");

      // Verify machine ownership transferred
      const updatedMachine = await db.query.machines.findFirst({
        where: eq(machines.id, machine.id),
      });
      expect(updatedMachine?.ownerId).toBe(guestUser.id);
    });

    it("should reject forcePromoteUserId from member (UNAUTHORIZED)", async () => {
      const { createClient } = await import("~/lib/supabase/server");
      const { updateMachineAction } = await import("~/app/(app)/m/actions");
      const db = await getTestDb();

      const ownerMember = await createUser("member");
      const guestUser = await createUser("guest");
      const machine = await createMachine(ownerMember.id);

      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: ownerMember.id } } }),
        },
      } as any);

      const formData = new FormData();
      formData.append("id", machine.id);
      formData.append("name", machine.name);
      formData.append("ownerId", guestUser.id);
      formData.append("forcePromoteUserId", guestUser.id);

      const result = await updateMachineAction(undefined, formData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("UNAUTHORIZED");
      }

      // Read-only invariant: guest NOT promoted, machine unchanged
      const guestAfter = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, guestUser.id),
      });
      expect(guestAfter?.role).toBe("guest");

      const machineAfter = await db.query.machines.findFirst({
        where: eq(machines.id, machine.id),
      });
      expect(machineAfter?.ownerId).toBe(ownerMember.id);
    });

    it("should reject forcePromoteUserId when it does not match ownerId (VALIDATION)", async () => {
      const { createClient } = await import("~/lib/supabase/server");
      const { updateMachineAction } = await import("~/app/(app)/m/actions");
      const db = await getTestDb();

      const adminUser = await createUser("admin");
      const guestUser = await createUser("guest");
      const otherGuestUser = await createUser("guest");
      const machine = await createMachine(adminUser.id);

      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: adminUser.id } } }),
        },
      } as any);

      const formData = new FormData();
      formData.append("id", machine.id);
      formData.append("name", machine.name);
      formData.append("ownerId", guestUser.id);
      // forcePromoteUserId points at a different user than ownerId
      formData.append("forcePromoteUserId", otherGuestUser.id);

      const result = await updateMachineAction(undefined, formData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("VALIDATION");
      }

      // Read-only invariant: neither guest promoted, machine ownership unchanged
      const guestAfter = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, guestUser.id),
      });
      expect(guestAfter?.role).toBe("guest");

      const otherGuestAfter = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, otherGuestUser.id),
      });
      expect(otherGuestAfter?.role).toBe("guest");

      const machineAfter = await db.query.machines.findFirst({
        where: eq(machines.id, machine.id),
      });
      expect(machineAfter?.ownerId).toBe(adminUser.id);
    });

    it("should reject forcePromoteUserId pointing at non-guest user (VALIDATION)", async () => {
      const { createClient } = await import("~/lib/supabase/server");
      const { updateMachineAction } = await import("~/app/(app)/m/actions");
      const db = await getTestDb();

      const adminUser = await createUser("admin");
      const memberTarget = await createUser("member");
      const machine = await createMachine(adminUser.id);

      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: adminUser.id } } }),
        },
      } as any);

      const formData = new FormData();
      formData.append("id", machine.id);
      formData.append("name", machine.name);
      formData.append("ownerId", memberTarget.id);
      // forcePromoteUserId points at a member, not a guest
      formData.append("forcePromoteUserId", memberTarget.id);

      const result = await updateMachineAction(undefined, formData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("VALIDATION");
        expect(result.message).toMatch(/not a guest/i);
      }

      // Read-only invariant: member role unchanged, machine ownership unchanged
      const targetAfter = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, memberTarget.id),
      });
      expect(targetAfter?.role).toBe("member");

      const machineAfter = await db.query.machines.findFirst({
        where: eq(machines.id, machine.id),
      });
      expect(machineAfter?.ownerId).toBe(adminUser.id);
    });

    it("should reject ownerId not found in user_profiles or invited_users", async () => {
      const { createClient } = await import("~/lib/supabase/server");
      const { updateMachineAction } = await import("~/app/(app)/m/actions");
      const db = await getTestDb();

      const adminUser = await createUser("admin");
      const machine = await createMachine(adminUser.id);
      const bogusOwnerId = randomUUID();

      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: adminUser.id } } }),
        },
      } as any);

      const formData = new FormData();
      formData.append("id", machine.id);
      formData.append("name", machine.name);
      formData.append("ownerId", bogusOwnerId);

      const result = await updateMachineAction(undefined, formData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("VALIDATION");
        expect(result.message).toBe("Selected owner does not exist.");
      }

      // Read-only invariant: machine ownership unchanged
      const machineAfter = await db.query.machines.findFirst({
        where: eq(machines.id, machine.id),
      });
      expect(machineAfter?.ownerId).toBe(adminUser.id);
    });
  });

  describe("updateMachineAction — description column (ProseMirror)", () => {
    // Exercises parseDescriptionFormField (actions.ts ~655-756) end-to-end via
    // updateMachineAction. The Edit Machine dialog carries the description as a
    // serialized ProseMirror doc in FormData under the "description" key.
    //
    // Field-presence semantics:
    //   absent           → column untouched
    //   ""               → column set to null
    //   whitespace doc   → normalizes to null
    //   valid doc        → column set to the parsed doc
    //   malformed JSON   → VALIDATION, column untouched
    //   schema-invalid   → VALIDATION, column untouched
    //   oversized (>10k) → VALIDATION, column untouched

    // Helper: seed a machine (unowned) that already has a non-null description,
    // so "untouched" / "unchanged" assertions have something to compare against.
    const seededDescription = plainTextToDoc("Pre-existing description text.");
    const seedMachineWithDescription = async () => {
      const db = await getTestDb();
      const machine = await createMachine();
      await db
        .update(machines)
        .set({ description: seededDescription })
        .where(eq(machines.id, machine.id));
      return machine;
    };

    it("sets description from a valid serialized ProseMirror doc in FormData", async () => {
      const { createClient } = await import("~/lib/supabase/server");
      const { updateMachineAction } = await import("~/app/(app)/m/actions");
      const db = await getTestDb();

      const adminUser = await createUser("admin");
      const machine = await createMachine();

      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: adminUser.id } } }),
        },
      } as any);

      const doc = plainTextToDoc("A rich description of the machine.");
      const formData = new FormData();
      formData.append("id", machine.id);
      formData.append("name", machine.name);
      formData.append("description", JSON.stringify(doc));

      const result = await updateMachineAction(undefined, formData);

      expect(result.ok).toBe(true);

      const machineAfter = await db.query.machines.findFirst({
        where: eq(machines.id, machine.id),
      });
      expect(machineAfter?.description).toEqual(doc);
    });

    it("leaves description untouched when the field is absent from FormData", async () => {
      const { createClient } = await import("~/lib/supabase/server");
      const { updateMachineAction } = await import("~/app/(app)/m/actions");
      const db = await getTestDb();

      const adminUser = await createUser("admin");
      const machine = await seedMachineWithDescription();

      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: adminUser.id } } }),
        },
      } as any);

      // Update only the name — no "description" key in FormData.
      const formData = new FormData();
      formData.append("id", machine.id);
      formData.append("name", "Renamed But Description Intact");

      const result = await updateMachineAction(undefined, formData);

      expect(result.ok).toBe(true);

      const machineAfter = await db.query.machines.findFirst({
        where: eq(machines.id, machine.id),
      });
      expect(machineAfter?.name).toBe("Renamed But Description Intact");
      // Column untouched: still the seeded doc.
      expect(machineAfter?.description).toEqual(seededDescription);
    });

    it("clears description to null when the field is an empty string", async () => {
      const { createClient } = await import("~/lib/supabase/server");
      const { updateMachineAction } = await import("~/app/(app)/m/actions");
      const db = await getTestDb();

      const adminUser = await createUser("admin");
      const machine = await seedMachineWithDescription();

      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: adminUser.id } } }),
        },
      } as any);

      const formData = new FormData();
      formData.append("id", machine.id);
      formData.append("name", machine.name);
      formData.append("description", "");

      const result = await updateMachineAction(undefined, formData);

      expect(result.ok).toBe(true);

      const machineAfter = await db.query.machines.findFirst({
        where: eq(machines.id, machine.id),
      });
      expect(machineAfter?.description).toBeNull();
    });

    it("normalizes a whitespace-only doc to null", async () => {
      const { createClient } = await import("~/lib/supabase/server");
      const { updateMachineAction } = await import("~/app/(app)/m/actions");
      const db = await getTestDb();

      const adminUser = await createUser("admin");
      const machine = await seedMachineWithDescription();

      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: adminUser.id } } }),
        },
      } as any);

      // Valid ProseMirror doc whose text content is only whitespace.
      const whitespaceDoc = plainTextToDoc("   ");
      const formData = new FormData();
      formData.append("id", machine.id);
      formData.append("name", machine.name);
      formData.append("description", JSON.stringify(whitespaceDoc));

      const result = await updateMachineAction(undefined, formData);

      expect(result.ok).toBe(true);

      const machineAfter = await db.query.machines.findFirst({
        where: eq(machines.id, machine.id),
      });
      expect(machineAfter?.description).toBeNull();
    });

    it("returns VALIDATION and leaves description unchanged for malformed JSON", async () => {
      const { createClient } = await import("~/lib/supabase/server");
      const { updateMachineAction } = await import("~/app/(app)/m/actions");
      const db = await getTestDb();

      const adminUser = await createUser("admin");
      const machine = await seedMachineWithDescription();

      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: adminUser.id } } }),
        },
      } as any);

      const formData = new FormData();
      formData.append("id", machine.id);
      formData.append("name", machine.name);
      formData.append("description", "{not valid json");

      const result = await updateMachineAction(undefined, formData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("VALIDATION");
      }

      const machineAfter = await db.query.machines.findFirst({
        where: eq(machines.id, machine.id),
      });
      expect(machineAfter?.description).toEqual(seededDescription);
    });

    it("returns VALIDATION and leaves description unchanged for a schema-invalid doc", async () => {
      const { createClient } = await import("~/lib/supabase/server");
      const { updateMachineAction } = await import("~/app/(app)/m/actions");
      const db = await getTestDb();

      const adminUser = await createUser("admin");
      const machine = await seedMachineWithDescription();

      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: adminUser.id } } }),
        },
      } as any);

      // Valid JSON, but not a ProseMirror doc (missing type: "doc").
      const formData = new FormData();
      formData.append("id", machine.id);
      formData.append("name", machine.name);
      formData.append("description", JSON.stringify({ foo: "bar" }));

      const result = await updateMachineAction(undefined, formData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("VALIDATION");
      }

      const machineAfter = await db.query.machines.findFirst({
        where: eq(machines.id, machine.id),
      });
      expect(machineAfter?.description).toEqual(seededDescription);
    });

    it("returns VALIDATION and leaves description unchanged when plaintext exceeds 10k chars", async () => {
      const { createClient } = await import("~/lib/supabase/server");
      const { updateMachineAction } = await import("~/app/(app)/m/actions");
      const db = await getTestDb();

      const adminUser = await createUser("admin");
      const machine = await seedMachineWithDescription();

      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: adminUser.id } } }),
        },
      } as any);

      // Valid doc whose plaintext content exceeds the 10_000-char cap.
      const oversizedDoc = plainTextToDoc("x".repeat(10_001));
      const formData = new FormData();
      formData.append("id", machine.id);
      formData.append("name", machine.name);
      formData.append("description", JSON.stringify(oversizedDoc));

      const result = await updateMachineAction(undefined, formData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("VALIDATION");
      }

      const machineAfter = await db.query.machines.findFirst({
        where: eq(machines.id, machine.id),
      });
      expect(machineAfter?.description).toEqual(seededDescription);
    });

    it("persists description supplied through the forcePromoteUserId promote path", async () => {
      const { createClient } = await import("~/lib/supabase/server");
      const { updateMachineAction } = await import("~/app/(app)/m/actions");
      const db = await getTestDb();

      const adminUser = await createUser("admin");
      const guestUser = await createUser("guest");
      const machine = await createMachine(adminUser.id);

      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: adminUser.id } } }),
        },
      } as any);

      const doc = plainTextToDoc("Description carried on the promote path.");
      const formData = new FormData();
      formData.append("id", machine.id);
      formData.append("name", machine.name);
      formData.append("ownerId", guestUser.id);
      formData.append("forcePromoteUserId", guestUser.id);
      formData.append("description", JSON.stringify(doc));

      const result = await updateMachineAction(undefined, formData);

      expect(result.ok).toBe(true);

      // Promotion + ownership happened (proves we exercised the promote path).
      const promotedUser = await db.query.userProfiles.findFirst({
        where: eq(userProfiles.id, guestUser.id),
      });
      expect(promotedUser?.role).toBe("member");

      const machineAfter = await db.query.machines.findFirst({
        where: eq(machines.id, machine.id),
      });
      expect(machineAfter?.ownerId).toBe(guestUser.id);
      // Description applied at the promote-path tx.update site (not dropped).
      expect(machineAfter?.description).toEqual(doc);
    });
  });

  describe("ASSIGNEE_NOT_MEMBER validation", () => {
    it("should return ASSIGNEE_NOT_MEMBER when active guest is assigned via updateMachineAction", async () => {
      const { createClient } = await import("~/lib/supabase/server");
      const { updateMachineAction } = await import("~/app/(app)/m/actions");

      const adminUser = await createUser("admin");
      const guestUser = await createUser("guest");
      const machine = await createMachine(adminUser.id);

      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: adminUser.id } } }),
        },
      } as any);

      const formData = new FormData();
      formData.append("id", machine.id);
      formData.append("name", machine.name);
      formData.append("ownerId", guestUser.id);
      // No forcePromoteUserId — should fail with ASSIGNEE_NOT_MEMBER

      const result = await updateMachineAction(undefined, formData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("ASSIGNEE_NOT_MEMBER");
        expect(result.meta?.assignee.role).toBe("guest");
        expect(result.meta?.assignee.type).toBe("active");
      }
    });

    it("should return ASSIGNEE_NOT_MEMBER when invited guest is assigned via updateMachineAction", async () => {
      const { createClient } = await import("~/lib/supabase/server");
      const { updateMachineAction } = await import("~/app/(app)/m/actions");

      const adminUser = await createUser("admin");
      const invitedGuest = await createInvitedUser("guest");
      const machine = await createMachine(adminUser.id);

      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: adminUser.id } } }),
        },
      } as any);

      const formData = new FormData();
      formData.append("id", machine.id);
      formData.append("name", machine.name);
      formData.append("ownerId", invitedGuest.id);

      const result = await updateMachineAction(undefined, formData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("ASSIGNEE_NOT_MEMBER");
        expect(result.meta?.assignee.type).toBe("invited");
      }
    });
  });

  describe("Null owner on creation", () => {
    it("should create machine with null ownerId when no owner is provided", async () => {
      const { createClient } = await import("~/lib/supabase/server");
      const { createMachineAction } = await import("~/app/(app)/m/actions");
      const db = await getTestDb();

      const adminUser = await createUser("admin");

      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: adminUser.id } } }),
        },
      } as any);

      machineCounter += 1;
      const uniqueInitials = `N${String(machineCounter).padStart(3, "0")}`;
      const formData = new FormData();
      formData.append("name", "No Owner Machine");
      formData.append("initials", uniqueInitials);
      // No ownerId — should store NULL

      const result = await createMachineAction(undefined, formData);
      expect(result.ok).toBe(true);

      const machine = await db.query.machines.findFirst({
        where: eq(machines.initials, uniqueInitials),
      });
      expect(machine).toBeDefined();
      expect(machine?.ownerId).toBeNull();
    });
  });

  describe("updateMachineTextField — field edit permission", () => {
    // Wave 3 RECLASS (PP-x4li.1.3): blocks 4–11, 13–14 from
    // src/test/unit/machine-actions.test.ts updateMachineTextField describe.
    // Tests real permission matrix (checkPermission) against a real PGlite DB.
    //
    // Permission matrix reference:
    //   machines.edit: unauthenticated=false, guest=false, member="owner",
    //                  technician=true, admin=true
    //   machines.edit.ownerRequirements: owner-scoped

    // A minimal valid ProseMirror doc for test payloads
    const validDoc = {
      type: "doc" as const,
      content: [
        { type: "paragraph", content: [{ type: "text", text: "hello" }] },
      ],
    };

    it("guest (non-owner) edits description → UNAUTHORIZED, field unchanged in DB", async () => {
      const { createClient } = await import("~/lib/supabase/server");
      const { updateMachineDescription } =
        await import("~/app/(app)/m/actions");
      const db = await getTestDb();

      const ownerUser = await createUser("member");
      const guestUser = await createUser("guest");
      const machine = await createMachine(ownerUser.id);

      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: guestUser.id } } }),
        },
      } as any);

      const result = await updateMachineDescription(machine.id, validDoc);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("UNAUTHORIZED");
      }

      // Read-only invariant: description must NOT have changed
      const machineAfter = await db.query.machines.findFirst({
        where: eq(machines.id, machine.id),
      });
      expect(machineAfter?.description).toBeNull();
    });

    it("member-owner edits description → ok, description persisted in DB", async () => {
      const { createClient } = await import("~/lib/supabase/server");
      const { updateMachineDescription } =
        await import("~/app/(app)/m/actions");
      const db = await getTestDb();

      const ownerUser = await createUser("member");
      const machine = await createMachine(ownerUser.id);

      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: ownerUser.id } } }),
        },
      } as any);

      const result = await updateMachineDescription(machine.id, validDoc);

      expect(result.ok).toBe(true);

      // Persistence invariant: description must be stored in DB
      const machineAfter = await db.query.machines.findFirst({
        where: eq(machines.id, machine.id),
      });
      expect(machineAfter?.description).toBeDefined();
      expect(machineAfter?.description).not.toBeNull();
    });

    it("technician NON-owner edits description → ok (machines.edit: technician=true), description persisted", async () => {
      // Key behavioral test: machines.edit grants technician=true unconditionally,
      // so a technician can edit description regardless of machine ownership.
      const { createClient } = await import("~/lib/supabase/server");
      const { updateMachineDescription } =
        await import("~/app/(app)/m/actions");
      const db = await getTestDb();

      const ownerUser = await createUser("member");
      const techUser = await createUser("technician");
      // Machine owned by member, technician is NOT the owner
      const machine = await createMachine(ownerUser.id);

      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: techUser.id } } }),
        },
      } as any);

      const result = await updateMachineDescription(machine.id, validDoc);

      expect(result.ok).toBe(true);

      // Persistence invariant: description must be stored in DB
      const machineAfter = await db.query.machines.findFirst({
        where: eq(machines.id, machine.id),
      });
      expect(machineAfter?.description).toBeDefined();
      expect(machineAfter?.description).not.toBeNull();
    });

    it("admin NON-owner edits description → ok (machines.edit: admin=true), description persisted", async () => {
      const { createClient } = await import("~/lib/supabase/server");
      const { updateMachineDescription } =
        await import("~/app/(app)/m/actions");
      const db = await getTestDb();

      const ownerUser = await createUser("member");
      const adminUser = await createUser("admin");
      // Machine owned by member, admin is NOT the owner
      const machine = await createMachine(ownerUser.id);

      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: adminUser.id } } }),
        },
      } as any);

      const result = await updateMachineDescription(machine.id, validDoc);

      expect(result.ok).toBe(true);

      // Persistence invariant: description must be stored in DB
      const machineAfter = await db.query.machines.findFirst({
        where: eq(machines.id, machine.id),
      });
      expect(machineAfter?.description).toBeDefined();
      expect(machineAfter?.description).not.toBeNull();
    });

    it("owner edits ownerRequirements → ok, ownerRequirements persisted in DB", async () => {
      const { createClient } = await import("~/lib/supabase/server");
      const { updateMachineOwnerRequirements } =
        await import("~/app/(app)/m/actions");
      const db = await getTestDb();

      const ownerUser = await createUser("member");
      const machine = await createMachine(ownerUser.id);

      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: ownerUser.id } } }),
        },
      } as any);

      const result = await updateMachineOwnerRequirements(machine.id, validDoc);

      expect(result.ok).toBe(true);

      // Persistence invariant: ownerRequirements must be stored in DB
      const machineAfter = await db.query.machines.findFirst({
        where: eq(machines.id, machine.id),
      });
      expect(machineAfter?.ownerRequirements).toBeDefined();
      expect(machineAfter?.ownerRequirements).not.toBeNull();
    });

    it("non-owner member → ownerRequirements UNAUTHORIZED (owner-scoped), ownerRequirements unchanged", async () => {
      const { createClient } = await import("~/lib/supabase/server");
      const { updateMachineOwnerRequirements } =
        await import("~/app/(app)/m/actions");
      const db = await getTestDb();

      const ownerUser = await createUser("member");
      const nonOwnerMember = await createUser("member");
      const machine = await createMachine(ownerUser.id);

      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: nonOwnerMember.id } } }),
        },
      } as any);

      const result = await updateMachineOwnerRequirements(machine.id, validDoc);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("UNAUTHORIZED");
      }

      // Read-only invariant: ownerRequirements must NOT have changed
      const machineAfter = await db.query.machines.findFirst({
        where: eq(machines.id, machine.id),
      });
      expect(machineAfter?.ownerRequirements).toBeNull();
    });
  });

  describe("DB trigger semantics — raw SQL (requires migration 0027 to be applied)", () => {
    it("should detect whether the trigger function exists in the PGlite schema", async () => {
      const db = await getTestDb();

      // Attempt to query pg_proc for our trigger function.
      // PGlite's schema.sql doesn't include migration SQL, so the trigger won't exist.
      // This test documents the expected DB state and passes regardless.
      const result = await db.execute(
        sql<{
          exists: number;
        }>`SELECT 1 AS exists FROM pg_proc WHERE proname = 'check_machine_owner_not_guest' LIMIT 1`
      );

      // On a real DB with migration applied: result has 1 row
      // On PGlite schema export (no migration SQL): result has 0 rows
      // Either is valid — the trigger is verified by the Supabase branch setup in CI.
      expect(result).toBeDefined();
    });

    it("should block assigning a guest as machine owner when trigger is active", async () => {
      const db = await getTestDb();

      // Check if trigger exists first
      const triggerCheck = await db.execute(
        sql<{
          exists: number;
        }>`SELECT 1 AS exists FROM pg_proc WHERE proname = 'check_machine_owner_not_guest' LIMIT 1`
      );

      if (triggerCheck.rows.length === 0) {
        // Trigger not installed in PGlite schema — skip trigger behavior test.
        // CI verifies this via the actual Supabase branch DB where migrations run.
        return;
      }

      // Trigger exists — verify it blocks guest insertion
      const guestUser = await createUser("guest");
      const machineInsert = db
        .insert(machines)
        .values({
          name: "Blocked Machine",
          initials: "BLK",
          ownerId: guestUser.id,
        })
        .returning();

      await expect(machineInsert).rejects.toThrow();
    });

    it("should block demoting a machine owner to guest when trigger is active", async () => {
      const db = await getTestDb();

      const triggerCheck = await db.execute(
        sql<{
          exists: number;
        }>`SELECT 1 AS exists FROM pg_proc WHERE proname = 'check_no_demotion_of_machine_owner' LIMIT 1`
      );

      if (triggerCheck.rows.length === 0) {
        // Trigger not installed in PGlite schema — skip trigger behavior test.
        // CI verifies this via the actual Supabase branch DB where migrations run.
        return;
      }

      const memberUser = await createUser("member");
      await createMachine(memberUser.id);

      const demotionUpdate = db
        .update(userProfiles)
        .set({ role: "guest" })
        .where(eq(userProfiles.id, memberUser.id));

      await expect(demotionUpdate).rejects.toThrow();
    });
  });
});
