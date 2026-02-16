/**
 * Integration Tests for Machine Text Fields
 *
 * Tests the new text fields (description, tournamentNotes, ownerRequirements, ownerNotes)
 * on the machines table.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { createTestUser, createTestMachine } from "~/test/helpers/factories";
import { machines, userProfiles } from "~/server/db/schema";

describe("Machine Text Fields (PGlite)", () => {
  setupTestDb();

  let testMachine: { id: string; initials: string };
  let testUser: { id: string };

  beforeEach(async () => {
    const db = await getTestDb();

    const [user] = await db
      .insert(userProfiles)
      .values(
        createTestUser({
          id: "00000000-0000-0000-0000-000000000001",
          role: "admin",
        })
      )
      .returning();
    testUser = user;

    const [machine] = await db
      .insert(machines)
      .values(
        createTestMachine({
          initials: "TF",
          name: "Test Fields Machine",
          ownerId: testUser.id,
        })
      )
      .returning();
    testMachine = machine;
  });

  describe("Schema columns", () => {
    it("should create machine with null text fields by default", async () => {
      const db = await getTestDb();

      const machine = await db.query.machines.findFirst({
        where: eq(machines.id, testMachine.id),
      });

      expect(machine).toBeDefined();
      expect(machine?.description).toBeNull();
      expect(machine?.tournamentNotes).toBeNull();
      expect(machine?.ownerRequirements).toBeNull();
      expect(machine?.ownerNotes).toBeNull();
    });

    it("should update description field", async () => {
      const db = await getTestDb();

      await db
        .update(machines)
        .set({ description: "A classic pinball machine from 1979" })
        .where(eq(machines.id, testMachine.id));

      const updated = await db.query.machines.findFirst({
        where: eq(machines.id, testMachine.id),
      });

      expect(updated?.description).toBe("A classic pinball machine from 1979");
    });

    it("should update tournamentNotes field", async () => {
      const db = await getTestDb();

      await db
        .update(machines)
        .set({ tournamentNotes: "Extra ball disabled for tournament play" })
        .where(eq(machines.id, testMachine.id));

      const updated = await db.query.machines.findFirst({
        where: eq(machines.id, testMachine.id),
      });

      expect(updated?.tournamentNotes).toBe(
        "Extra ball disabled for tournament play"
      );
    });

    it("should update ownerRequirements field", async () => {
      const db = await getTestDb();

      await db
        .update(machines)
        .set({ ownerRequirements: "Please use soft plunge only" })
        .where(eq(machines.id, testMachine.id));

      const updated = await db.query.machines.findFirst({
        where: eq(machines.id, testMachine.id),
      });

      expect(updated?.ownerRequirements).toBe("Please use soft plunge only");
    });

    it("should update ownerNotes field", async () => {
      const db = await getTestDb();

      await db
        .update(machines)
        .set({ ownerNotes: "Left flipper coil replaced 2024-01-15" })
        .where(eq(machines.id, testMachine.id));

      const updated = await db.query.machines.findFirst({
        where: eq(machines.id, testMachine.id),
      });

      expect(updated?.ownerNotes).toBe("Left flipper coil replaced 2024-01-15");
    });

    it("should update all text fields simultaneously", async () => {
      const db = await getTestDb();

      await db
        .update(machines)
        .set({
          description: "Desc",
          tournamentNotes: "Tournament",
          ownerRequirements: "Requirements",
          ownerNotes: "Notes",
        })
        .where(eq(machines.id, testMachine.id));

      const updated = await db.query.machines.findFirst({
        where: eq(machines.id, testMachine.id),
      });

      expect(updated?.description).toBe("Desc");
      expect(updated?.tournamentNotes).toBe("Tournament");
      expect(updated?.ownerRequirements).toBe("Requirements");
      expect(updated?.ownerNotes).toBe("Notes");
    });

    it("should allow clearing a text field by setting to null", async () => {
      const db = await getTestDb();

      // First set a value
      await db
        .update(machines)
        .set({ description: "Some description" })
        .where(eq(machines.id, testMachine.id));

      // Then clear it
      await db
        .update(machines)
        .set({ description: null })
        .where(eq(machines.id, testMachine.id));

      const updated = await db.query.machines.findFirst({
        where: eq(machines.id, testMachine.id),
      });

      expect(updated?.description).toBeNull();
    });
  });
});
