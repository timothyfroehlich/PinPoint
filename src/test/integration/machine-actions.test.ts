/**
 * Integration Tests: Machine Actions (PGlite)
 *
 * Upgraded from src/test/unit/machine-actions.test.ts per CORE-TEST-004.
 * Exercises createMachineAction, updateMachineAction, updateMachineDescription,
 * and updateMachineOwnerRequirements against worker-scoped PGlite with real
 * PostgreSQL tables, constraints, and queries.
 */

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createMachineAction,
  updateMachineAction,
  updateMachineDescription,
  updateMachineOwnerRequirements,
} from "~/app/(app)/m/actions";
import { plainTextToDoc } from "~/lib/tiptap/types";
import { authUsers, machines, userProfiles } from "~/server/db/schema";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";

vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  return { db: await getTestDb() };
});

const mockGetUser = vi.fn();
vi.mock("~/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ auth: { getUser: mockGetUser } }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("Machine Actions (PGlite Integration)", () => {
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

  let counter = 0;
  async function makeMachine(ownerId?: string): Promise<{
    id: string;
    initials: string;
  }> {
    const db = await getTestDb();
    counter += 1;
    const [machine] = await db
      .insert(machines)
      .values({
        name: "Test Machine",
        initials: `MA${String(counter).padStart(3, "0")}`,
        ownerId: ownerId ?? null,
        presenceStatus: "on_the_floor",
      })
      .returning();
    return machine;
  }

  function mockAuth(userId: string | null): void {
    mockGetUser.mockResolvedValue({
      data: { user: userId ? { id: userId } : null },
    });
  }

  const validDoc = plainTextToDoc("Important machine instructions");

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("updateMachineAction", () => {
    it("should require authentication", async () => {
      mockAuth(null);

      const formData = new FormData();
      formData.append("id", randomUUID());
      formData.append("name", "Updated Name");

      const result = await updateMachineAction(undefined, formData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("UNAUTHORIZED");
      }
    });

    it("should validate input (invalid UUID)", async () => {
      const userId = await makeUser("admin");
      mockAuth(userId);

      const formData = new FormData();
      formData.append("id", "not-a-uuid");
      formData.append("name", "Updated Name");

      const result = await updateMachineAction(undefined, formData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("VALIDATION");
      }
    });

    it("should validate presenceStatus input", async () => {
      const userId = await makeUser("admin");
      const machine = await makeMachine(userId);
      mockAuth(userId);

      const formData = new FormData();
      formData.append("id", machine.id);
      formData.append("name", "Updated Name");
      formData.append("presenceStatus", "invalid_presence");

      const result = await updateMachineAction(undefined, formData);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("VALIDATION");
      }
    });
  });

  describe("updateMachineDescription", () => {
    it("unauthenticated caller → err('UNAUTHORIZED')", async () => {
      mockAuth(null);
      const machineId = randomUUID();

      const result = await updateMachineDescription(machineId, validDoc);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("UNAUTHORIZED");
      }
    });

    it("machine not found → err('NOT_FOUND')", async () => {
      const userId = await makeUser("admin");
      mockAuth(userId);
      const missingId = randomUUID();

      const result = await updateMachineDescription(missingId, validDoc);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("NOT_FOUND");
      }
    });

    it("invalid machineId (not a UUID) → err('VALIDATION')", async () => {
      const userId = await makeUser("admin");
      mockAuth(userId);

      const result = await updateMachineDescription("not-a-uuid", validDoc);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("VALIDATION");
      }
    });

    it("persists valid description to database", async () => {
      const userId = await makeUser("member");
      const machine = await makeMachine(userId);
      mockAuth(userId);

      const result = await updateMachineDescription(machine.id, validDoc);

      expect(result.ok).toBe(true);

      const db = await getTestDb();
      const updated = await db.query.machines.findFirst({
        where: eq(machines.id, machine.id),
      });
      expect(updated?.description).toEqual(validDoc);
    });
  });

  describe("updateMachineOwnerRequirements", () => {
    it("unauthenticated caller → err('UNAUTHORIZED')", async () => {
      mockAuth(null);
      const machineId = randomUUID();

      const result = await updateMachineOwnerRequirements(machineId, validDoc);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("UNAUTHORIZED");
      }
    });

    it("persists valid ownerRequirements to database", async () => {
      const userId = await makeUser("member");
      const machine = await makeMachine(userId);
      mockAuth(userId);

      const result = await updateMachineOwnerRequirements(machine.id, validDoc);

      expect(result.ok).toBe(true);

      const db = await getTestDb();
      const updated = await db.query.machines.findFirst({
        where: eq(machines.id, machine.id),
      });
      expect(updated?.ownerRequirements).toEqual(validDoc);
    });
  });

  describe("createMachineAction", () => {
    it("unauthenticated caller → createMachineAction err('UNAUTHORIZED')", async () => {
      mockAuth(null);

      const fd = new FormData();
      fd.set("name", "Medieval Madness");
      fd.set("initials", "MM");

      const result = await createMachineAction(undefined, fd);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("UNAUTHORIZED");
        expect(result.message).toMatch(/unauthorized/i);
      }
    });

    it("member caller without machines.create permission → createMachineAction err('UNAUTHORIZED')", async () => {
      const memberId = await makeUser("member");
      mockAuth(memberId);

      const fd = new FormData();
      fd.set("name", "Medieval Madness");
      fd.set("initials", "MM");

      const result = await createMachineAction(undefined, fd);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("UNAUTHORIZED");
        expect(result.message).toMatch(/admin or technician/i);
      }
    });
  });
});
