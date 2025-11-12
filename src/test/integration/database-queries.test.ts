/**
 * Integration Test: Database Queries with PGlite
 *
 * Demonstrates how to write integration tests using worker-scoped PGlite.
 * These tests verify database operations without requiring a real Supabase instance.
 */

import { describe, it, expect } from "vitest";
import { eq } from "drizzle-orm";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { machines, issues, userProfiles } from "~/server/db/schema";
import {
  createTestMachine,
  createTestIssue,
  createTestUser,
} from "~/test/helpers/factories";

describe("Database Queries (PGlite)", () => {
  // Set up worker-scoped PGlite and auto-cleanup after each test
  setupTestDb();

  describe("Machines", () => {
    it("should insert and query a machine", async () => {
      const db = await getTestDb();
      const testMachine = createTestMachine({ name: "Attack from Mars" });

      // Insert
      await db.insert(machines).values(testMachine);

      // Query
      const result = await db.select().from(machines);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Attack from Mars");
    });

    it("should find machine by id", async () => {
      const db = await getTestDb();
      const machineId = crypto.randomUUID();
      const testMachine = createTestMachine({
        id: machineId,
        name: "Medieval Madness",
      });

      await db.insert(machines).values(testMachine);

      const result = await db.query.machines.findFirst({
        where: eq(machines.id, machineId),
      });

      expect(result).toBeDefined();
      expect(result?.name).toBe("Medieval Madness");
    });
  });

  describe("Issues", () => {
    it("should insert issue with machine reference", async () => {
      const db = await getTestDb();

      // Create machine first
      const testMachine = createTestMachine({ name: "Twilight Zone" });
      const [machine] = await db.insert(machines).values(testMachine).returning();

      // Create issue for that machine
      const testIssue = createTestIssue(machine.id, {
        title: "Broken flipper",
        severity: "unplayable",
      });
      await db.insert(issues).values(testIssue);

      // Query with relation
      const result = await db.query.issues.findFirst({
        where: eq(issues.machineId, machine.id),
        with: {
          machine: true,
        },
      });

      expect(result).toBeDefined();
      expect(result?.title).toBe("Broken flipper");
      expect(result?.severity).toBe("unplayable");
      expect(result?.machine.name).toBe("Twilight Zone");
    });

    it("should enforce machine_id NOT NULL constraint", async () => {
      const db = await getTestDb();

      // Attempt to insert issue without machineId (should fail)
      await expect(
        db.insert(issues).values({
          // @ts-expect-error - Testing constraint violation
          machineId: null,
          title: "Test",
          status: "new",
          severity: "minor",
        })
      ).rejects.toThrow();
    });

    it("should cascade delete issues when machine is deleted", async () => {
      const db = await getTestDb();

      // Create machine with issue
      const testMachine = createTestMachine();
      const [machine] = await db.insert(machines).values(testMachine).returning();

      const testIssue = createTestIssue(machine.id);
      await db.insert(issues).values(testIssue);

      // Verify issue exists
      const beforeDelete = await db.select().from(issues);
      expect(beforeDelete).toHaveLength(1);

      // Delete machine
      await db.delete(machines).where(eq(machines.id, machine.id));

      // Verify issue was cascade deleted
      const afterDelete = await db.select().from(issues);
      expect(afterDelete).toHaveLength(0);
    });
  });

  describe("User Profiles", () => {
    it("should insert and query user profile", async () => {
      const db = await getTestDb();
      const testUser = createTestUser({
        name: "John Doe",
        role: "member",
      });

      await db.insert(userProfiles).values(testUser);

      const result = await db.select().from(userProfiles);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("John Doe");
      expect(result[0].role).toBe("member");
    });

    it("should link user to reported issues", async () => {
      const db = await getTestDb();

      // Create user
      const testUser = createTestUser({ name: "Reporter User" });
      const [user] = await db.insert(userProfiles).values(testUser).returning();

      // Create machine
      const testMachine = createTestMachine();
      const [machine] = await db.insert(machines).values(testMachine).returning();

      // Create issue reported by user
      const testIssue = createTestIssue(machine.id, {
        title: "User reported issue",
        reportedBy: user.id,
      });
      await db.insert(issues).values(testIssue);

      // Query with relation
      const result = await db.query.issues.findFirst({
        where: eq(issues.reportedBy, user.id),
        with: {
          reportedByUser: true,
        },
      });

      expect(result).toBeDefined();
      expect(result?.reportedByUser?.name).toBe("Reporter User");
    });
  });
});
