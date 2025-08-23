import {
  createServiceMockDatabase,
  createAdminServiceMock,
} from "../../test/helpers/service-mock-database";
import { SEED_TEST_IDS } from "../../test/constants/seed-test-ids";

describe("Service Mock Database", () => {
  test("creates mock with organizational scoping", () => {
    const mockDb = createAdminServiceMock();

    expect(mockDb.query.issues.findMany).toBeDefined();
    expect(mockDb.query.machines.findMany).toBeDefined();
    expect(mockDb.insert).toBeDefined();
    expect(mockDb.update).toBeDefined();
    expect(mockDb.delete).toBeDefined();
  });

  test("mock data respects organizational boundaries", async () => {
    const mockDb = createServiceMockDatabase({
      organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
      userId: SEED_TEST_IDS.USERS.ADMIN,
      userRole: "admin",
    });

    const issues = await mockDb.query.issues.findMany({
      where: { organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary },
    });

    expect(issues).toHaveLength(2);
    expect(
      issues.every(
        (issue) => issue.organizationId === SEED_TEST_IDS.ORGANIZATIONS.primary,
      ),
    ).toBe(true);
  });

  test("CRUD operations work correctly", async () => {
    const mockDb = createAdminServiceMock();

    // Test insert
    const insertResult = await mockDb
      .insert("issues")
      .values({
        title: "New Issue",
        machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      })
      .returning();

    expect(insertResult).toHaveLength(1);
    expect(insertResult[0].organizationId).toBe(
      SEED_TEST_IDS.ORGANIZATIONS.primary,
    );

    // Test update
    const updateResult = await mockDb
      .update("issues")
      .set({ title: "Updated Issue" })
      .where({ id: "issue-1" })
      .returning();

    expect(updateResult).toHaveLength(1);
    expect(mockDb.update).toHaveBeenCalled();
  });
});
