import { expect } from "vitest";
import { test } from "vitest";
import {
  withAdminContext,
  withMemberContext,
  verifyRLSContext,
  withFullRLSContext,
  withRLSContext,
} from "../rls-test-context";
import { SEED_TEST_IDS } from "../../constants/seed-test-ids";
import type { TestDatabase } from "../pglite-test-setup";
import { sql } from "drizzle-orm";
import { createTestDatabase } from "../pglite-test-setup";

test("SQL Safety Test - parameterized sql used for session variables", async () => {
  const db = await createTestDatabase();

  // Attempt payload with quotes and special characters to ensure no injection
  const maliciousUserId = "bad'user; DROP TABLE users; --";

  await withRLSContext(
    db,
    maliciousUserId,
    SEED_TEST_IDS.ORGANIZATIONS.primary,
    async (dbContext) => {
      // Verify session variables were set to the literal value (no injection)
      await verifyRLSContext(dbContext, {
        userId: maliciousUserId,
        organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
      });

      // Basic query to ensure DB still intact
      const result = await dbContext.execute(sql`SELECT 1 as ok`);
      const row = result.rows?.[0] as { ok?: number } | undefined;
      expect(row?.ok).toBe(1);
    },
  );
});

test("RLS Context Verification - throws on mismatch", async () => {
  const db = await createTestDatabase();

  await withRLSContext(
    db,
    SEED_TEST_IDS.USERS.ADMIN,
    SEED_TEST_IDS.ORGANIZATIONS.primary,
    async (dbContext) => {
      let didThrow = false;
      try {
        // Intentionally verify wrong expected user
        await verifyRLSContext(dbContext, {
          userId: "not-the-admin",
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
        });
      } catch (err: any) {
        didThrow = true;
        expect(String(err.message)).toContain("Session variable mismatch");
      }

      expect(didThrow).toBe(true);
    },
  );
});

test("Convenience helpers use SEED_TEST_IDS constants", async () => {
  const db = await createTestDatabase();

  // Test admin helper uses correct constants
  await withAdminContext(db, async (dbContext) => {
    await verifyRLSContext(dbContext, {
      userId: SEED_TEST_IDS.USERS.ADMIN,
      organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
      role: "admin",
      email: SEED_TEST_IDS.EMAILS.ADMIN,
    });
  });

  // Test member helper uses correct constants
  await withMemberContext(db, async (dbContext) => {
    await verifyRLSContext(dbContext, {
      userId: SEED_TEST_IDS.USERS.MEMBER1,
      organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
      role: "member",
      email: SEED_TEST_IDS.EMAILS.MEMBER1,
    });
  });
});
