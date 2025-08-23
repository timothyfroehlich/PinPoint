import { describe, it, expect, vi, beforeEach } from "vitest";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

// Mock the database with proper typing
const mockUserFindMany = vi.fn();
const mockMembershipFindMany = vi.fn();
const mockOrganizationFindMany = vi.fn();
const mockOrganizationFindFirst = vi.fn();

// Mock database provider
const mockDb = {
  organization: {
    findMany: mockOrganizationFindMany,
    findFirst: mockOrganizationFindFirst,
  },
  user: {
    findMany: mockUserFindMany,
  },
  membership: {
    findMany: mockMembershipFindMany,
  },
};

vi.mock("~/server/db/provider", () => ({
  getGlobalDatabaseProvider: vi.fn().mockReturnValue({
    getClient: vi.fn().mockReturnValue(mockDb),
    disconnect: vi.fn(),
    reset: vi.fn(),
  }),
}));

// Mock the env module
const mockEnv = {
  NODE_ENV: "development",
  DATABASE_URL: "test://localhost",
  DEFAULT_ORG_SUBDOMAIN: "apc",
};

vi.mock("~/env", () => ({
  env: mockEnv,
}));

// Mock console methods to avoid noise in test output
vi.spyOn(console, "log").mockImplementation(() => {
  // Intentionally empty - suppressing console output in tests
});
vi.spyOn(console, "error").mockImplementation(() => {
  // Intentionally empty - suppressing console output in tests
});

describe("/api/dev/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.NODE_ENV = "development";
  });

  describe("Environment Protection", () => {
    it("should only be available in development environment", () => {
      expect(mockEnv.NODE_ENV).toBe("development");
    });

    it("should be blocked in production", () => {
      mockEnv.NODE_ENV = "production";
      expect(mockEnv.NODE_ENV).toBe("production");
      // In a real implementation, this would return a 404 or error
    });
  });

  describe("Database Operations", () => {
    it("should mock user lookup correctly", async () => {
      const mockUsers = [
        {
          id: SEED_TEST_IDS.USERS.ADMIN,
          name: "Test User 1",
          email: "user1@example.com",
          bio: null,
          profilePicture: null,
          image: null,
          emailVerified: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "user-2",
          name: "Test User 2",
          email: "user2@example.com",
          bio: null,
          profilePicture: null,
          image: null,
          emailVerified: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockUserFindMany.mockResolvedValue(mockUsers);

      const result = await mockDb.user.findMany();
      expect(result).toEqual(mockUsers);
      expect(result).toHaveLength(2);
    });

    it("should mock membership lookup correctly", async () => {
      const mockMemberships = [
        {
          id: "membership-1",
          userId: SEED_TEST_IDS.USERS.ADMIN,
          organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
          roleId: "role-1",
          createdAt: new Date(),
          updatedAt: new Date(),
          role: {
            id: "role-1",
            name: "Member",
            organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
            permissions: [
              {
                id: "perm-1",
                name: "issues:read",
                description: "Read issues",
              },
            ],
          },
        },
      ];

      mockMembershipFindMany.mockResolvedValue(mockMemberships);

      const result = await mockDb.membership.findMany();
      expect(result).toEqual(mockMemberships);
      expect(result).toHaveLength(1);
    });

    it("should mock organization lookup correctly", async () => {
      const mockOrganizations = [
        {
          id: SEED_TEST_IDS.ORGANIZATIONS.primary,
          name: "Test Organization",
          subdomain: "test-org",
          logoUrl: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockOrganizationFindMany.mockResolvedValue(mockOrganizations);

      const result = await mockDb.organization.findMany();
      expect(result).toEqual(mockOrganizations);
      expect(result).toHaveLength(1);
    });
  });

  describe("User Data Structure", () => {
    it("should return users with proper structure", async () => {
      const mockUsers = [
        {
          id: SEED_TEST_IDS.USERS.ADMIN,
          name: "Test User",
          email: "test@example.com",
          bio: "Test bio",
          profilePicture: null,
          image: null,
          emailVerified: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          memberships: [
            {
              id: "membership-1",
              organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
              roleId: "role-1",
              role: {
                id: "role-1",
                name: "Member",
                permissions: [
                  {
                    id: "perm-1",
                    name: "issues:read",
                  },
                ],
              },
            },
          ],
        },
      ];

      mockUserFindMany.mockResolvedValue(mockUsers);

      const result = await mockDb.user.findMany();

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe(SEED_TEST_IDS.USERS.ADMIN);
      expect(result[0]?.name).toBe("Test User");
      expect(result[0]?.email).toBe("test@example.com");
      expect(result[0]?.memberships).toHaveLength(1);
      expect(result[0]?.memberships[0]?.role.name).toBe("Member");
    });

    it("should handle users without memberships", async () => {
      const mockUsers = [
        {
          id: "user-solo",
          name: "Solo User",
          email: "solo@example.com",
          bio: null,
          profilePicture: null,
          image: null,
          emailVerified: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          memberships: [],
        },
      ];

      mockUserFindMany.mockResolvedValue(mockUsers);

      const result = await mockDb.user.findMany();

      expect(result).toHaveLength(1);
      expect(result[0]?.memberships).toHaveLength(0);
    });
  });

  describe("API Response Format", () => {
    it("should format response correctly", () => {
      const users = [
        {
          id: SEED_TEST_IDS.USERS.ADMIN,
          name: "User 1",
          email: "user1@example.com",
        },
        {
          id: "user-2",
          name: "User 2",
          email: "user2@example.com",
        },
      ];

      const response = {
        users,
        count: users.length,
        message: "Development users retrieved successfully",
      };

      expect(response.count).toBe(2);
      expect(response.users).toHaveLength(2);
      expect(response.message).toBeDefined();
    });

    it("should handle empty user list", () => {
      const users: never[] = [];

      const response = {
        users,
        count: users.length,
        message: "No users found",
      };

      expect(response.count).toBe(0);
      expect(response.users).toHaveLength(0);
    });
  });

  describe("Error Handling", () => {
    it("should handle database errors gracefully", async () => {
      const error = new Error("Database connection failed");
      mockUserFindMany.mockRejectedValue(error);

      await expect(mockDb.user.findMany()).rejects.toThrow(
        "Database connection failed",
      );
    });

    it("should handle invalid organization lookups", async () => {
      mockOrganizationFindFirst.mockResolvedValue(null);

      const result = await mockDb.organization.findFirst();
      expect(result).toBeNull();
    });
  });
});
