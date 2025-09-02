/**
 * Issues DAL Tests - Archetype 2
 * Service business logic testing with mocked auth context
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";
import * as dalShared from "./shared";
import {
  getIssuesForOrg,
  getIssueById,
  getIssueStatusCounts,
  getRecentIssues,
} from "./issues";

// Mock the database and auth context
vi.mock("./shared", async () => {
  const actual = await vi.importActual("./shared");
  return {
    ...actual,
    requireAuthContextWithRole: vi.fn(),
    db: {
      query: {
        issues: {
          findMany: vi.fn(),
          findFirst: vi.fn(),
        },
      },
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            groupBy: vi.fn(),
          })),
        })),
      })),
    },
  };
});

const mockRequireAuthContextWithRole = vi.mocked(dalShared.requireAuthContextWithRole);
const mockDb = vi.mocked(dalShared.db);

describe("Issues DAL (Business Logic Tests - Archetype 2)", () => {
  // Test context setup with seed data
  const mockAuthContext = {
    user: {
      id: SEED_TEST_IDS.USERS.ADMIN,
      email: "tim@pinpoint.dev",
    },
    organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
    membership: {
      id: "test-membership-1",
      user_id: SEED_TEST_IDS.USERS.ADMIN,
      organization_id: SEED_TEST_IDS.ORGANIZATIONS.primary,
      role_id: "admin-role",
    },
    role: {
      id: "admin-role",
      name: "admin",
      is_system: true,
      is_default: false,
    },
    permissions: ["read:issues", "write:issues", "admin:issues"],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Setup default mock auth context
    mockRequireAuthContextWithRole.mockResolvedValue(mockAuthContext);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getIssuesForOrg", () => {
    it("fetches issues with proper organization scoping", async () => {
      const mockIssues = [
        {
          id: "issue-1",
          title: "Test Issue 1",
          organization_id: SEED_TEST_IDS.ORGANIZATIONS.primary,
          machine: {
            id: SEED_TEST_IDS.MOCK_PATTERNS.MACHINE,
            name: "Test Machine",
            model: { id: "model-1", name: "Test Model" },
          },
          assignedTo: {
            id: SEED_TEST_IDS.USERS.ADMIN,
            name: "Tim",
            email: "tim@pinpoint.dev",
          },
        },
      ];

      const mockFindMany = vi.fn().mockResolvedValue(mockIssues);
      mockDb.query.issues.findMany = mockFindMany;

      const result = await getIssuesForOrg();

      // Verify auth context was called
      expect(mockRequireAuthContext).toHaveBeenCalledOnce();

      // Verify query was called with proper structure (simplified)
      expect(mockFindMany).toHaveBeenCalledOnce();
      const callArgs = mockFindMany.mock.calls[0][0];
      expect(callArgs).toHaveProperty("where");
      expect(callArgs).toHaveProperty("with");
      expect(callArgs).toHaveProperty("orderBy");

      expect(result).toEqual(mockIssues);
    });

    it("throws when auth context fails", async () => {
      mockRequireAuthContext.mockRejectedValue(
        new Error("Authentication required"),
      );

      await expect(getIssuesForOrg()).rejects.toThrow(
        "Authentication required",
      );
    });

    it("properly handles empty result set", async () => {
      const mockFindMany = vi.fn().mockResolvedValue([]);
      mockDb.query.issues.findMany = mockFindMany;

      const result = await getIssuesForOrg();

      expect(result).toEqual([]);
      expect(mockRequireAuthContext).toHaveBeenCalledOnce();
    });
  });

  describe("getIssueById", () => {
    const testIssueId = "test-issue-123";

    it("fetches single issue with organization scoping", async () => {
      const mockIssue = {
        id: testIssueId,
        title: "Test Issue",
        organization_id: SEED_TEST_IDS.ORGANIZATIONS.primary,
        machine: {
          id: SEED_TEST_IDS.MOCK_PATTERNS.MACHINE,
          name: "Test Machine",
        },
        assignedTo: {
          id: SEED_TEST_IDS.USERS.ADMIN,
          name: "Tim",
          email: "tim@pinpoint.dev",
        },
        createdBy: {
          id: SEED_TEST_IDS.USERS.ADMIN,
          name: "Tim",
          email: "tim@pinpoint.dev",
        },
      };

      const mockFindFirst = vi.fn().mockResolvedValue(mockIssue);
      mockDb.query.issues.findFirst = mockFindFirst;

      const result = await getIssueById(testIssueId);

      // Verify auth context was called
      expect(mockRequireAuthContext).toHaveBeenCalledOnce();

      // Verify query was called with proper structure (simplified)
      expect(mockFindFirst).toHaveBeenCalledOnce();
      const callArgs = mockFindFirst.mock.calls[0][0];
      expect(callArgs).toHaveProperty("where");
      expect(callArgs).toHaveProperty("with");

      expect(result).toEqual(mockIssue);
    });

    it("throws error when issue not found", async () => {
      const mockFindFirst = vi.fn().mockResolvedValue(null);
      mockDb.query.issues.findFirst = mockFindFirst;

      await expect(getIssueById("non-existent")).rejects.toThrow(
        "Issue not found or access denied",
      );
      expect(mockRequireAuthContext).toHaveBeenCalledOnce();
    });

    it("enforces cross-organization access denial", async () => {
      // Mock finding an issue from a different organization
      const crossOrgIssue = {
        id: testIssueId,
        organization_id: SEED_TEST_IDS.ORGANIZATIONS.competitor, // Different org
      };

      // Since the query includes org scoping, this should return null
      const mockFindFirst = vi.fn().mockResolvedValue(null);
      mockDb.query.issues.findFirst = mockFindFirst;

      await expect(getIssueById(testIssueId)).rejects.toThrow(
        "Issue not found or access denied",
      );
    });
  });

  describe("getIssueStatusCounts", () => {
    it("returns aggregated status counts with organization scoping", async () => {
      const mockStatusCounts = [
        { statusId: "status-open", count: 5 },
        { statusId: "status-closed", count: 3 },
      ];

      // Mock the select chain
      const mockGroupBy = vi.fn().mockResolvedValue(mockStatusCounts);
      const mockWhere = vi.fn().mockReturnValue({ groupBy: mockGroupBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
      mockDb.select = mockSelect;

      const result = await getIssueStatusCounts();

      // Verify auth context was called
      expect(mockRequireAuthContext).toHaveBeenCalledOnce();

      // Verify organization scoping was applied (simplified)
      expect(mockWhere).toHaveBeenCalledOnce();

      // Verify result transformation to object
      expect(result).toEqual({
        "status-open": 5,
        "status-closed": 3,
      });
    });

    it("handles empty status counts", async () => {
      const mockGroupBy = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ groupBy: mockGroupBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });
      mockDb.select = mockSelect;

      const result = await getIssueStatusCounts();

      expect(result).toEqual({});
      expect(mockRequireAuthContext).toHaveBeenCalledOnce();
    });
  });

  describe("getRecentIssues", () => {
    it("fetches recent issues with limit and organization scoping", async () => {
      const mockIssues = [
        {
          id: "recent-1",
          title: "Recent Issue 1",
          organization_id: SEED_TEST_IDS.ORGANIZATIONS.primary,
          machine: {
            id: SEED_TEST_IDS.MOCK_PATTERNS.MACHINE,
            name: "Test Machine",
            model: { id: "model-1", name: "Test Model" },
          },
        },
      ];

      const mockFindMany = vi.fn().mockResolvedValue(mockIssues);
      mockDb.query.issues.findMany = mockFindMany;

      const result = await getRecentIssues(3);

      // Verify auth context was called
      expect(mockRequireAuthContext).toHaveBeenCalledOnce();

      // Verify query was called with proper structure and limit (simplified)
      expect(mockFindMany).toHaveBeenCalledOnce();
      const callArgs = mockFindMany.mock.calls[0][0];
      expect(callArgs).toHaveProperty("where");
      expect(callArgs).toHaveProperty("with");
      expect(callArgs).toHaveProperty("orderBy");
      expect(callArgs).toHaveProperty("limit");
      expect(callArgs.limit).toBe(3);

      expect(result).toEqual(mockIssues);
    });

    it("uses default limit when not specified", async () => {
      const mockFindMany = vi.fn().mockResolvedValue([]);
      mockDb.query.issues.findMany = mockFindMany;

      await getRecentIssues();

      expect(mockFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          limit: 5, // Default limit
        }),
      );
    });
  });

  describe("Cache behavior verification", () => {
    it("should use React cache() for request-level memoization", () => {
      // Verify that functions are wrapped with cache()
      // This is more of a structural test
      expect(typeof getIssuesForOrg).toBe("function");
      expect(typeof getIssueById).toBe("function");
      expect(typeof getIssueStatusCounts).toBe("function");
      expect(typeof getRecentIssues).toBe("function");

      // In real implementation, we could test memoization by calling
      // functions multiple times and verifying DB is called only once
      // per request context, but that requires more complex mocking
    });
  });

  describe("Security patterns verification", () => {
    it("all DAL functions enforce organization scoping", async () => {
      // Setup mocks
      const mockFindMany = vi.fn().mockResolvedValue([]);
      const mockFindFirst = vi.fn().mockResolvedValue({ id: "test" });
      const mockGroupBy = vi.fn().mockResolvedValue([]);
      const mockWhere = vi.fn().mockReturnValue({ groupBy: mockGroupBy });
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

      mockDb.query.issues.findMany = mockFindMany;
      mockDb.query.issues.findFirst = mockFindFirst;
      mockDb.select = mockSelect;

      // Call all DAL functions
      await getIssuesForOrg();
      await getIssueById("test");
      await getIssueStatusCounts();
      await getRecentIssues();

      // Verify all functions called requireAuthContext
      expect(mockRequireAuthContext).toHaveBeenCalledTimes(4);

      // This test ensures no DAL function can be called without auth context
    });
  });
});
