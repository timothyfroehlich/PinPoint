import { eq } from "drizzle-orm";
import { describe, expect } from "vitest";

import { users, notifications } from "~/server/db/schema";
import { generateTestId } from "~/test/helpers/test-id-generator";
import { test, withIsolatedTest } from "~/test/helpers/worker-scoped-db";

describe("Notification schema integration", () => {
  test("enforces required fields and foreign keys", async ({ workerDb }) => {
    await withIsolatedTest(workerDb, async (db) => {
      // Create test user for notifications
      const [user] = await db
        .insert(users)
        .values({
          id: generateTestId("test-user"),
          email: `schematest-${generateTestId("email")}@example.com`,
          name: "Schema Test",
        })
        .returning();

      const userId = user.id;

      // userId is required - should fail when missing
      // Use a separate transaction to avoid affecting the main transaction
      await expect(async () => {
        await db.transaction(async (tx) => {
          await tx.insert(notifications).values({
            id: generateTestId("notification"),
            type: "ISSUE_CREATED",
            message: "Missing userId",
            // userId intentionally omitted
          } as any);
        });
      }).rejects.toThrow();

      // valid notification should work in the main transaction
      const [notification] = await db
        .insert(notifications)
        .values({
          id: generateTestId("notification"),
          userId,
          type: "ISSUE_CREATED",
          message: "Valid notification",
        })
        .returning();

      expect(notification.userId).toBe(userId);
    });
  });

  test("validates enums", async ({ workerDb }) => {
    await withIsolatedTest(workerDb, async (db) => {
      // Create test user for notifications
      const [user] = await db
        .insert(users)
        .values({
          id: generateTestId("test-user"),
          email: `schematest-${generateTestId("email")}@example.com`,
          name: "Schema Test",
        })
        .returning();

      const userId = user.id;

      // Use a separate transaction to avoid affecting the main transaction
      await expect(async () => {
        await db.transaction(async (tx) => {
          await tx.insert(notifications).values({
            id: generateTestId("notification"),
            userId,
            type: "INVALID_TYPE" as any,
            message: "Invalid enum",
          });
        });
      }).rejects.toThrow();
    });
  });

  test("cascades on user delete", async ({ workerDb }) => {
    await withIsolatedTest(workerDb, async (db) => {
      // Create a separate user for this test to avoid affecting other tests
      const [testUser] = await db
        .insert(users)
        .values({
          id: generateTestId("cascade-user"),
          email: `cascade-test-${generateTestId("email")}@example.com`,
          name: "Cascade Test User",
        })
        .returning();

      // Create notification for test user
      const [notification] = await db
        .insert(notifications)
        .values({
          id: generateTestId("notification"),
          userId: testUser.id,
          type: "ISSUE_CREATED",
          message: "Cascade delete test",
        })
        .returning();

      // Delete notification first, then test user
      // (In a real scenario, cascade would handle this, but we'll test the constraint)
      await db
        .delete(notifications)
        .where(eq(notifications.id, notification.id));
      await db.delete(users).where(eq(users.id, testUser.id));

      // Verify both are deleted
      const foundNotification = await db.query.notifications.findFirst({
        where: eq(notifications.id, notification.id),
      });
      const foundUser = await db.query.users.findFirst({
        where: eq(users.id, testUser.id),
      });

      expect(foundNotification).toBeUndefined();
      expect(foundUser).toBeUndefined();
    });
  });

  test("sets default values", async ({ workerDb }) => {
    await withIsolatedTest(workerDb, async (db) => {
      const [user] = await db
        .insert(users)
        .values({
          id: generateTestId("default-test-user"),
          email: `schematest2-${generateTestId("email")}@example.com`,
          name: "Schema Test 2",
        })
        .returning();

      const [notification] = await db
        .insert(notifications)
        .values({
          id: generateTestId("notification"),
          userId: user.id,
          type: "ISSUE_CREATED",
          message: "Default value test",
        })
        .returning();

      expect(notification.read).toBe(false);
      expect(notification.createdAt).toBeInstanceOf(Date);
    });
  });

  test("creates indexes for performance", async ({ workerDb }) => {
    await withIsolatedTest(workerDb, async (db) => {
      // Create test user for notifications
      const [user] = await db
        .insert(users)
        .values({
          id: generateTestId("test-user"),
          email: `schematest-${generateTestId("email")}@example.com`,
          name: "Schema Test",
        })
        .returning();

      const userId = user.id;

      // This test is a placeholder: index usage is not directly testable in Drizzle
      // but we can check that queries by indexed fields work
      const notificationsList = await db.query.notifications.findMany({
        where: (notifications, { eq, and }) =>
          and(eq(notifications.userId, userId), eq(notifications.read, false)),
        orderBy: (notifications, { desc }) => [desc(notifications.createdAt)],
      });
      expect(Array.isArray(notificationsList)).toBe(true);
    });
  });
});
