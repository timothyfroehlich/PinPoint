import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";
import { createConstraintValidTestData } from "~/test/helpers/constraint-valid-data";
import {
  organizations,
  machines,
  issues,
  users,
  locations,
  models,
} from "~/server/db/schema";
import { eq, and, sql } from "drizzle-orm";

describe("Schema Constraints Validation", () => {
  test("validates not-null constraints", async ({ workerDb }) => {
    await withIsolatedTest(workerDb, async (db) => {
      await createConstraintValidTestData(db);
      // Should fail - modelId is missing
      await expect(
        db.insert(machines).values({
          id: "test-machine-not-null",
          name: "Incomplete Machine",
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
          locationId: SEED_TEST_IDS.LOCATIONS.MAIN_FLOOR,
        }),
      ).rejects.toThrow(/violates not-null constraint/);
    });
  });

  test("validates foreign key constraints", async ({ workerDb }) => {
    await withIsolatedTest(workerDb, async (db) => {
      await createConstraintValidTestData(db);

      // Should fail - references non-existent organization
      await expect(
        db.insert(machines).values({
          id: "invalid-machine",
          name: "Invalid Machine",
          organizationId: "non-existent-org", // FK violation
          locationId: SEED_TEST_IDS.LOCATIONS.MAIN_FLOOR,
          modelId: SEED_TEST_IDS.MODELS.MEDIEVAL_MADNESS,
        }),
      ).rejects.toThrow(/violates foreign key constraint/);
    });
  });

  test("validates enum constraints", async ({ workerDb }) => {
    await withIsolatedTest(workerDb, async (db) => {
      await createConstraintValidTestData(db);

      // Should fail - invalid status value
      await expect(
        db.insert(issues).values({
          id: "invalid-issue",
          title: "Invalid Issue",
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
          machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
          createdById: SEED_TEST_IDS.USERS.ADMIN,
          statusId: "invalid-status", // Should be: open, in-progress, closed
          priorityId: "invalid-priority", // Should be: low, medium, high
        }),
      ).rejects.toThrow(/invalid input value for enum/);
    });
  });

  test("validates check constraints", async ({ workerDb }) => {
    await withIsolatedTest(workerDb, async (db) => {
      await createConstraintValidTestData(db);

      // Should fail - invalid email format
      await expect(
        db.insert(users).values({
          id: "invalid-user",
          email: "not-an-email", // Should match email pattern
          name: "Invalid User",
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
        }),
      ).rejects.toThrow(/violates check constraint/);
    });
  });

  test("validates unique constraints", async ({ workerDb }) => {
    await withIsolatedTest(workerDb, async (db) => {
      await createConstraintValidTestData(db);

      // Should fail - duplicate email
      await expect(
        db.insert(users).values({
          id: "duplicate-user",
          email: "admin@pinpoint.test", // Already exists in test data
          name: "Duplicate User",
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
        }),
      ).rejects.toThrow(/violates unique constraint/);
    });
  });

  test("validates cascade deletions work correctly", async ({ workerDb }) => {
    await withIsolatedTest(workerDb, async (db) => {
      await createConstraintValidTestData(db);

      // Delete organization should cascade to dependent records
      await db
        .delete(organizations)
        .where(eq(organizations.id, SEED_TEST_IDS.ORGANIZATIONS.primary));

      // Verify cascaded deletions
      const remainingMachines = await db.query.machines.findMany({
        where: eq(machines.organizationId, SEED_TEST_IDS.ORGANIZATIONS.primary),
      });

      const remainingIssues = await db.query.issues.findMany({
        where: eq(issues.organizationId, SEED_TEST_IDS.ORGANIZATIONS.primary),
      });

      expect(remainingMachines).toHaveLength(0);
      expect(remainingIssues).toHaveLength(0);
    });
  });
});
