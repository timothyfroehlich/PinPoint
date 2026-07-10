/**
 * Integration Tests for Machine Text Fields
 *
 * Tests the text fields (description, ownerRequirements)
 * on the machines table.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { createTestUser, createTestMachine } from "~/test/helpers/factories";
import { machines, userProfiles } from "~/server/db/schema";
import { plainTextToDoc } from "~/lib/tiptap/types";

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
      expect(machine?.ownerRequirements).toBeNull();
    });

    it("should update description field", async () => {
      const db = await getTestDb();

      await db
        .update(machines)
        .set({
          description: plainTextToDoc("A classic pinball machine from 1979"),
        })
        .where(eq(machines.id, testMachine.id));

      const updated = await db.query.machines.findFirst({
        where: eq(machines.id, testMachine.id),
      });

      expect(updated?.description).toEqual(
        plainTextToDoc("A classic pinball machine from 1979")
      );
    });

    it("should update ownerRequirements field", async () => {
      const db = await getTestDb();

      await db
        .update(machines)
        .set({
          ownerRequirements: plainTextToDoc("Please use soft plunge only"),
        })
        .where(eq(machines.id, testMachine.id));

      const updated = await db.query.machines.findFirst({
        where: eq(machines.id, testMachine.id),
      });

      expect(updated?.ownerRequirements).toEqual(
        plainTextToDoc("Please use soft plunge only")
      );
    });

    it("should update all text fields simultaneously", async () => {
      const db = await getTestDb();

      await db
        .update(machines)
        .set({
          description: plainTextToDoc("Desc"),
          ownerRequirements: plainTextToDoc("Requirements"),
        })
        .where(eq(machines.id, testMachine.id));

      const updated = await db.query.machines.findFirst({
        where: eq(machines.id, testMachine.id),
      });

      expect(updated?.description).toEqual(plainTextToDoc("Desc"));
      expect(updated?.ownerRequirements).toEqual(
        plainTextToDoc("Requirements")
      );
    });

    it("should allow clearing a text field by setting to null", async () => {
      const db = await getTestDb();

      // First set a value
      await db
        .update(machines)
        .set({ description: plainTextToDoc("Some description") })
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
