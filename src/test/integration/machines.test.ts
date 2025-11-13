/**
 * Integration Test: Machine CRUD Operations
 *
 * Tests machine queries, mutations, and status derivation with PGlite.
 * Verifies that machine status is correctly derived from associated issues.
 */

import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { machines, issues } from "~/server/db/schema";
import { createTestMachine, createTestIssue } from "~/test/helpers/factories";
import { deriveMachineStatus } from "~/lib/machines/status";
import { createMachineSchema } from "~/app/(app)/machines/schemas";

describe("Machine CRUD Operations (PGlite)", () => {
  // Set up worker-scoped PGlite and auto-cleanup after each test
  setupTestDb();

  describe("Machine Creation", () => {
    it("should create a machine with valid name", async () => {
      const db = await getTestDb();
      const testMachine = createTestMachine({ name: "Medieval Madness" });

      const [machine] = await db
        .insert(machines)
        .values(testMachine)
        .returning();

      expect(machine).toBeDefined();
      expect(machine.name).toBe("Medieval Madness");
      expect(machine.id).toBeDefined();
      expect(machine.createdAt).toBeDefined();
    });

    it("should validate machine name with schema", () => {
      // Valid name
      const validResult = createMachineSchema.safeParse({
        name: "Attack from Mars",
      });
      expect(validResult.success).toBe(true);

      // Empty name should fail
      const emptyResult = createMachineSchema.safeParse({
        name: "",
      });
      expect(emptyResult.success).toBe(false);

      // Missing name should fail
      const missingResult = createMachineSchema.safeParse({});
      expect(missingResult.success).toBe(false);
    });

    it("should trim whitespace from machine name", () => {
      const result = createMachineSchema.safeParse({
        name: "  Twilight Zone  ",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe("Twilight Zone");
      }
    });
  });

  describe("Machine Queries", () => {
    it("should query machine with its issues", async () => {
      const db = await getTestDb();

      // Create machine
      const testMachine = createTestMachine({ name: "The Addams Family" });
      const [machine] = await db
        .insert(machines)
        .values(testMachine)
        .returning();

      // Create issues for the machine
      const issue1 = createTestIssue(machine.id, {
        title: "Broken flipper",
        severity: "unplayable",
        status: "new",
      });
      const issue2 = createTestIssue(machine.id, {
        title: "Missing decal",
        severity: "minor",
        status: "new",
      });

      await db.insert(issues).values([issue1, issue2]);

      // Query machine with issues
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const result = await db.query.machines.findFirst({
        where: eq(machines.id, machine.id),
        with: {
          issues: true,
        },
      });

      expect(result).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(result?.name).toBe("The Addams Family");
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(result?.issues).toHaveLength(2);
    });

    it("should list all machines ordered by name", async () => {
      const db = await getTestDb();

      // Create multiple machines
      await db
        .insert(machines)
        .values([
          createTestMachine({ name: "Twilight Zone" }),
          createTestMachine({ name: "Attack from Mars" }),
          createTestMachine({ name: "Medieval Madness" }),
        ]);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const result = await db.query.machines.findMany({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        orderBy: (machines, { desc }) => [desc(machines.name)],
      });

      expect(result).toHaveLength(3);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(result[0].name).toBe("Twilight Zone");
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(result[1].name).toBe("Medieval Madness");
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(result[2].name).toBe("Attack from Mars");
    });
  });

  describe("Machine Status Derivation", () => {
    it("should derive 'operational' status when machine has no open issues", async () => {
      const db = await getTestDb();

      // Create machine
      const testMachine = createTestMachine({ name: "Operational Machine" });
      const [machine] = await db
        .insert(machines)
        .values(testMachine)
        .returning();

      // Create only resolved issues
      await db.insert(issues).values([
        createTestIssue(machine.id, {
          title: "Fixed issue",
          severity: "unplayable",
          status: "resolved",
          resolvedAt: new Date(),
        }),
      ]);

      // Query machine with issues
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const result = await db.query.machines.findFirst({
        where: eq(machines.id, machine.id),
        with: {
          issues: {
            columns: {
              status: true,
              severity: true,
            },
          },
        },
      });

      // Derive status
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
      const status = deriveMachineStatus(result?.issues ?? []);
      expect(status).toBe("operational");
    });

    it("should derive 'needs_service' status when machine has playable/minor issues", async () => {
      const db = await getTestDb();

      // Create machine
      const testMachine = createTestMachine({ name: "Needs Service Machine" });
      const [machine] = await db
        .insert(machines)
        .values(testMachine)
        .returning();

      // Create playable and minor issues
      await db.insert(issues).values([
        createTestIssue(machine.id, {
          title: "Playable issue",
          severity: "playable",
          status: "new",
        }),
        createTestIssue(machine.id, {
          title: "Minor issue",
          severity: "minor",
          status: "in_progress",
        }),
      ]);

      // Query machine with issues
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const result = await db.query.machines.findFirst({
        where: eq(machines.id, machine.id),
        with: {
          issues: {
            columns: {
              status: true,
              severity: true,
            },
          },
        },
      });

      // Derive status
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
      const status = deriveMachineStatus(result?.issues ?? []);
      expect(status).toBe("needs_service");
    });

    it("should derive 'unplayable' status when machine has at least one unplayable issue", async () => {
      const db = await getTestDb();

      // Create machine
      const testMachine = createTestMachine({ name: "Unplayable Machine" });
      const [machine] = await db
        .insert(machines)
        .values(testMachine)
        .returning();

      // Create unplayable issue and other issues
      await db.insert(issues).values([
        createTestIssue(machine.id, {
          title: "Broken flipper",
          severity: "unplayable",
          status: "in_progress",
        }),
        createTestIssue(machine.id, {
          title: "Minor cosmetic issue",
          severity: "minor",
          status: "new",
        }),
      ]);

      // Query machine with issues
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const result = await db.query.machines.findFirst({
        where: eq(machines.id, machine.id),
        with: {
          issues: {
            columns: {
              status: true,
              severity: true,
            },
          },
        },
      });

      // Derive status
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
      const status = deriveMachineStatus(result?.issues ?? []);
      expect(status).toBe("unplayable");
    });

    it("should ignore resolved issues when deriving status", async () => {
      const db = await getTestDb();

      // Create machine
      const testMachine = createTestMachine({
        name: "Machine with resolved unplayable",
      });
      const [machine] = await db
        .insert(machines)
        .values(testMachine)
        .returning();

      // Create resolved unplayable issue and open minor issue
      await db.insert(issues).values([
        createTestIssue(machine.id, {
          title: "Fixed unplayable issue",
          severity: "unplayable",
          status: "resolved",
          resolvedAt: new Date(),
        }),
        createTestIssue(machine.id, {
          title: "Current minor issue",
          severity: "minor",
          status: "new",
        }),
      ]);

      // Query machine with issues
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const result = await db.query.machines.findFirst({
        where: eq(machines.id, machine.id),
        with: {
          issues: {
            columns: {
              status: true,
              severity: true,
            },
          },
        },
      });

      // Derive status - should be needs_service, not unplayable
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
      const status = deriveMachineStatus(result?.issues ?? []);
      expect(status).toBe("needs_service");
    });
  });

  describe("Machine Deletion", () => {
    it("should cascade delete issues when machine is deleted", async () => {
      const db = await getTestDb();

      // Create machine with issues
      const testMachine = createTestMachine();
      const [machine] = await db
        .insert(machines)
        .values(testMachine)
        .returning();

      await db
        .insert(issues)
        .values([
          createTestIssue(machine.id, { title: "Issue 1" }),
          createTestIssue(machine.id, { title: "Issue 2" }),
        ]);

      // Verify issues exist
      const beforeDelete = await db
        .select()
        .from(issues)
        .where(eq(issues.machineId, machine.id));
      expect(beforeDelete).toHaveLength(2);

      // Delete machine
      await db.delete(machines).where(eq(machines.id, machine.id));

      // Verify issues were cascade deleted
      const afterDelete = await db
        .select()
        .from(issues)
        .where(eq(issues.machineId, machine.id));
      expect(afterDelete).toHaveLength(0);
    });
  });
});
