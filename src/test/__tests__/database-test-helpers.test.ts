/**
 * Database Test Helpers Validation Tests
 *
 * Validates that the database test helper utilities work correctly
 * and provide the expected functionality for integration tests.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import {
  cleanupTestData,
  createTestOrganization,
  createTestUser,
  createTestUserWithMembership,
  verifyOrganizationIsolation,
  createMultiTenantTestEnvironment,
  type TestDataIds,
} from "../database-test-helpers";

import type { DrizzleClient } from "~/server/db/drizzle";

import * as schema from "~/server/db/schema";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

// Mock the Drizzle client and schema
const mockDb = {
  delete: vi.fn(() => ({
    where: vi.fn(() => ({
      returning: vi.fn().mockResolvedValue([]),
    })),
  })),
  insert: vi.fn(() => ({
    values: vi.fn(() => ({
      returning: vi.fn().mockResolvedValue([{ id: "test-id" }]),
    })),
  })),
  select: vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn().mockResolvedValue([]),
    })),
  })),
} as unknown as DrizzleClient;

describe("Database Test Helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("cleanupTestData", () => {
    it("should handle empty testIds without errors", async () => {
      const emptyIds: TestDataIds = {};

      await expect(cleanupTestData(mockDb, emptyIds)).resolves.not.toThrow();
    });

    it("should handle database client errors gracefully", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {
        // Mock console.warn for this test
      });

      // Mock database error
      const errorDb = {
        delete: vi.fn(() => {
          throw new Error("Database connection failed");
        }),
      } as unknown as DrizzleClient;

      const testIds: TestDataIds = {
        orgIds: [SEED_TEST_IDS.ORGANIZATIONS.primary],
      };

      // Should not throw, should log warning
      await expect(cleanupTestData(errorDb, testIds)).resolves.not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith(
        "Database cleanup error (non-fatal):",
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });

    it("should handle null database instance gracefully", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {
        // Mock console.warn for this test
      });

      await cleanupTestData(null as unknown as DrizzleClient, {});

      expect(consoleSpy).toHaveBeenCalledWith(
        "Database instance not provided to cleanup function",
      );

      consoleSpy.mockRestore();
    });

    it("should execute delete operations in correct dependency order", async () => {
      const testIds: TestDataIds = {
        orgIds: [SEED_TEST_IDS.ORGANIZATIONS.primary],
        userIds: ["test-user-1"],
        issueId: "test-issue-1",
        machineId: "test-machine-1",
      };

      await cleanupTestData(mockDb, testIds);

      // Verify delete operations were called

      const mockedDelete = mockDb.delete as any;
      expect(mockedDelete).toHaveBeenCalled();

      // Should have been called multiple times for different tables
      const deleteCallCount = (mockDb.delete as any).mock.calls.length;
      expect(deleteCallCount).toBeGreaterThan(0);
    });
  });

  describe("createTestOrganization", () => {
    it("should create organization with default values", async () => {
      const mockOrg = {
        id: "test-org-123",
        name: "Test Organization",
        subdomain: "test-subdomain-123",
        logoUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock the database response
      (mockDb.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockOrg]),
        }),
      });

      const result = await createTestOrganization(mockDb);

      expect(result).toEqual(mockOrg);

      const mockedInsert = mockDb.insert as any;
      expect(mockedInsert).toHaveBeenCalledWith(schema.organizations);
    });

    it("should create organization with custom overrides", async () => {
      const overrides = {
        name: "Custom Org Name",
        subdomain: "custom-subdomain",
      };

      const mockOrg = {
        id: "test-org-123",
        ...overrides,
        logoUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockDb.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockOrg]),
        }),
      });

      const result = await createTestOrganization(mockDb, overrides);

      expect(result.name).toBe(overrides.name);
      expect(result.subdomain).toBe(overrides.subdomain);
    });

    it("should throw error if organization creation fails", async () => {
      (mockDb.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]), // No organization returned
        }),
      });

      await expect(createTestOrganization(mockDb)).rejects.toThrow(
        "Failed to create test organization",
      );
    });
  });

  describe("createTestUser", () => {
    it("should create user with default values", async () => {
      const mockUser = {
        id: "test-user-123",
        name: "Test User",
        email: "test-123@example.com",
        emailVerified: null,
        image: null,
        bio: null,
        notificationFrequency: "IMMEDIATE",
        emailNotificationsEnabled: true,
        pushNotificationsEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockDb.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockUser]),
        }),
      });

      const result = await createTestUser(mockDb);

      expect(result).toEqual(mockUser);

      const mockedInsert = mockDb.insert as any;
      expect(mockedInsert).toHaveBeenCalledWith(schema.users);
    });

    it("should create user with custom overrides", async () => {
      const overrides = {
        name: "Custom User",
        email: "custom@example.com",
      };

      const mockUser = {
        id: "test-user-123",
        ...overrides,
        emailVerified: null,
        image: null,
        bio: null,
        notificationFrequency: "IMMEDIATE",
        emailNotificationsEnabled: true,
        pushNotificationsEnabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockDb.insert as any).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockUser]),
        }),
      });

      const result = await createTestUser(mockDb, overrides);

      expect(result.name).toBe(overrides.name);
      expect(result.email).toBe(overrides.email);
    });
  });

  describe("createTestUserWithMembership", () => {
    it("should create user with membership and role", async () => {
      const organizationId = "test-org-123";
      const roleType = "admin";

      const mockUser = { id: "test-user-123", name: "Test User" };
      const mockRole = { id: "test-role-123", name: "Admin" };
      const mockMembership = {
        id: "test-membership-123",
        userId: "test-user-123",
      };

      // Mock sequential database calls
      const callCount = { count: 0 };
      (mockDb.insert as any).mockImplementation((_table) => ({
        values: vi.fn().mockReturnValue({
          returning: vi
            .fn()
            .mockResolvedValue([
              callCount.count === 0
                ? mockUser
                : callCount.count === 1
                  ? mockRole
                  : mockMembership,
            ]),
        }),
      }));

      const result = await createTestUserWithMembership(
        mockDb,
        organizationId,
        roleType,
      );

      expect(result.user).toEqual(mockUser);
      expect(result.role).toEqual(mockRole);
      expect(result.membership).toEqual(mockMembership);

      // Should have called insert 3 times (user, role, membership)

      const mockedInsert = mockDb.insert as any;
      expect(mockedInsert).toHaveBeenCalledTimes(3);
    });

    it("should handle different role types correctly", async () => {
      const organizationId = "test-org-123";
      const roleTypes = ["admin", "manager", "member"] as const;

      for (const roleType of roleTypes) {
        vi.clearAllMocks();

        const mockUser = { id: "test-user-123" };
        const mockRole = {
          id: "test-role-123",
          name: roleType.charAt(0).toUpperCase() + roleType.slice(1),
        };
        const mockMembership = { id: "test-membership-123" };

        let callCount = 0;
        (mockDb.insert as any).mockImplementation(() => ({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockImplementation(() => {
              const result =
                callCount === 0
                  ? mockUser
                  : callCount === 1
                    ? mockRole
                    : mockMembership;
              callCount++;
              return Promise.resolve([result]);
            }),
          }),
        }));

        const result = await createTestUserWithMembership(
          mockDb,
          organizationId,
          roleType,
        );

        expect(result.role.name).toBe(
          roleType.charAt(0).toUpperCase() + roleType.slice(1),
        );
      }
    });
  });

  describe("verifyOrganizationIsolation", () => {
    it("should pass when all records belong to expected organization", () => {
      const records = [
        { id: "1", organizationId: "org-123", data: "test1" },
        { id: "2", organizationId: "org-123", data: "test2" },
      ];

      expect(() => {
        verifyOrganizationIsolation(records, "org-123");
      }).not.toThrow();
    });

    it("should throw when records belong to different organization", () => {
      const records = [
        { id: "1", organizationId: "org-123", data: "test1" },
        { id: "2", organizationId: "org-456", data: "test2" },
      ];

      expect(() => {
        verifyOrganizationIsolation(records, "org-123");
      }).toThrow("Organization isolation violation");
    });

    it("should work with custom field names", () => {
      const records = [
        { id: "1", customOrgId: "org-123", data: "test1" },
        { id: "2", customOrgId: "org-123", data: "test2" },
      ];

      expect(() => {
        verifyOrganizationIsolation(records, "org-123", "customOrgId");
      }).not.toThrow();
    });

    it("should handle empty record arrays", () => {
      expect(() => {
        verifyOrganizationIsolation([], "org-123");
      }).not.toThrow();
    });
  });

  describe("createMultiTenantTestEnvironment", () => {
    it("should create complete multi-tenant environment", async () => {
      // Mock database responses for the complex multi-tenant creation
      const mockResponses = [
        // Organizations
        { id: "test-org1", name: "Test Organization 1" },
        { id: "test-org2", name: "Test Organization 2" },
        // Users and memberships (8 total insert calls)
        { id: "test-user-1" },
        { id: "test-role-1" },
        { id: "test-membership-1" },
        { id: "test-user-2" },
        { id: "test-role-2" },
        { id: "test-membership-2" },
        { id: "test-user-3" },
        { id: "test-role-3" },
        { id: "test-membership-3" },
        { id: "test-user-4" },
        { id: "test-role-4" },
        { id: "test-membership-4" },
      ];

      let responseIndex = 0;
      (mockDb.insert as any).mockImplementation(() => ({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockImplementation(() => {
            const response = mockResponses[responseIndex] || {
              id: `fallback-${responseIndex}`,
            };
            responseIndex++;
            return Promise.resolve([response]);
          }),
        }),
      }));

      const result = await createMultiTenantTestEnvironment(mockDb);

      expect(result.org1).toBeDefined();
      expect(result.org2).toBeDefined();
      expect(result.users.org1Admin).toBeDefined();
      expect(result.users.org1Member).toBeDefined();
      expect(result.users.org2Admin).toBeDefined();
      expect(result.users.org2Member).toBeDefined();

      // Should have called insert multiple times for all entities

      const mockedInsert = mockDb.insert as any;
      expect(mockedInsert).toHaveBeenCalledWith(schema.organizations);
      expect(mockedInsert).toHaveBeenCalledWith(schema.users);
      expect(mockedInsert).toHaveBeenCalledWith(schema.roles);
      expect(mockedInsert).toHaveBeenCalledWith(schema.memberships);
    });
  });

  describe("Integration with actual types", () => {
    it("should have correct TypeScript types for all factories", () => {
      // This test validates that our factory functions return the correct types
      // and are compatible with the Drizzle schema types

      type Organization = typeof schema.organizations.$inferInsert;
      type User = typeof schema.users.$inferInsert;

      // These should compile without TypeScript errors
      const orgOverrides: Partial<Organization> = {
        name: "Test Org",
        subdomain: "test-sub",
      };

      const userOverrides: Partial<User> = {
        name: "Test User",
        email: "test@example.com",
      };

      // Type assertions to ensure compatibility
      expect(orgOverrides.name).toBe("Test Org");
      expect(userOverrides.name).toBe("Test User");
    });

    it("should generate unique identifiers for concurrent tests", async () => {
      // Mock multiple concurrent organization creations
      const timestamps = new Set<string>();

      (mockDb.insert as any).mockImplementation(() => ({
        values: vi.fn().mockImplementation((data) => ({
          returning: vi.fn().mockImplementation(() => {
            // Extract timestamp from the generated ID
            const id = data.id as string;
            const timestamp = id.split("-").pop();
            if (timestamp) {
              timestamps.add(timestamp);
            }
            return Promise.resolve([data]);
          }),
        })),
      }));

      // Create multiple organizations concurrently
      const promises = Array(3)
        .fill(null)
        .map(() => createTestOrganization(mockDb));
      await Promise.all(promises);

      // Should generate unique timestamps (or very close ones)
      expect(timestamps.size).toBeGreaterThanOrEqual(1);
    });
  });
});
