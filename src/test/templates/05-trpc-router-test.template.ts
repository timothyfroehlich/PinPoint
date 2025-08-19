/**
 * TEMPLATE: Archetype 5 - tRPC Router Test
 * 
 * USE FOR: Testing tRPC router procedures with mocked database
 * RLS IMPACT: MASSIVELY SIMPLIFIED - No organizational context complexity
 * AGENT: integration-test-architect
 * 
 * CHARACTERISTICS:
 * - Tests tRPC router procedures and middleware
 * - Uses mocked database for fast, isolated testing
 * - Tests authentication, authorization, and validation
 * - Focuses on API contract and error handling
 * - Tests input validation and response transformation
 */

import { describe, test, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";
import { createVitestMockContext } from "~/test/vitestMockContext";
import { appRouter } from "~/server/api/root";
import type * as DbModule from "~/server/db";

// Mock the database module
vi.mock("~/server/db", async (importOriginal) => {
  const actual = await importOriginal<typeof DbModule>();
  return {
    ...actual,
    db: {
      execute: vi.fn(), // For RLS session context setting
      query: {
        yourTable: {
          findMany: vi.fn(),
          findFirst: vi.fn(),
          findUnique: vi.fn(),
        },
        users: {
          findFirst: vi.fn(),
        },
        organizations: {
          findFirst: vi.fn(),
        },
      },
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn(),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn(),
          }),
        }),
      }),
      delete: vi.fn().mockReturnValue({
        where: vi.fn(),
      }),
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn(),
          }),
        }),
      }),
    },
  };
});

// Get mocked database for type safety
const mockDb = vi.mocked((await import("~/server/db")).db);

describe("YourRouter tRPC Router", () => {
  
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  // =============================================================================
  // AUTHENTICATION AND AUTHORIZATION TESTS
  // =============================================================================
  
  test("protected procedure requires authentication", async () => {
    // ARRANGE: Create context without authentication
    const mockCtx = createVitestMockContext({
      session: null, // No authentication
    });
    
    const caller = appRouter.createCaller(mockCtx);
    
    // ACT & ASSERT: Should throw authentication error
    await expect(
      caller.yourRouter.protectedProcedure({ id: "test-id" })
    ).rejects.toThrow("UNAUTHORIZED");
  });
  
  test("protected procedure works with valid authentication", async () => {
    // ARRANGE: Mock database response
    const mockResource = {
      id: "test-resource-1",
      name: "Test Resource",
      organizationId: "test-org",
      createdById: "test-user",
    };
    
    mockDb.query.yourTable.findFirst.mockResolvedValue(mockResource);
    
    // ARRANGE: Create authenticated context
    const mockCtx = createVitestMockContext({
      user: { 
        id: "test-user", 
        user_metadata: { organizationId: "test-org" } 
      },
    });
    
    const caller = appRouter.createCaller(mockCtx);
    
    // ACT: Call protected procedure
    const result = await caller.yourRouter.protectedProcedure({ id: "test-resource-1" });
    
    // ASSERT: Returns expected result
    expect(result).toEqual(mockResource);
    
    // VERIFY: RLS session context was set
    expect(mockDb.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        sql: expect.stringContaining("SET app.current_organization_id"),
      }),
    );
  });
  
  test("enforces organizational isolation", async () => {
    // ARRANGE: Mock resource from different organization
    mockDb.query.yourTable.findFirst.mockResolvedValue(null); // RLS blocks access
    
    const mockCtx = createVitestMockContext({
      user: { 
        id: "test-user", 
        user_metadata: { organizationId: "user-org" } 
      },
    });
    
    const caller = appRouter.createCaller(mockCtx);
    
    // ACT & ASSERT: Should not find resource from different org
    await expect(
      caller.yourRouter.getById({ id: "other-org-resource" })
    ).rejects.toThrow("NOT_FOUND");
  });
  
  // =============================================================================
  // INPUT VALIDATION TESTS
  // =============================================================================
  
  test("validates input schema correctly", async () => {
    const mockCtx = createVitestMockContext({
      user: { 
        id: "test-user", 
        user_metadata: { organizationId: "test-org" } 
      },
    });
    
    const caller = appRouter.createCaller(mockCtx);
    
    // Test invalid input types
    await expect(
      caller.yourRouter.create({
        name: "", // Invalid: empty string
        description: null, // Invalid: null when string expected
        count: "not-a-number", // Invalid: string when number expected
      } as any)
    ).rejects.toThrow("BAD_REQUEST");
    
    // Test missing required fields
    await expect(
      caller.yourRouter.create({
        // Missing required 'name' field
        description: "Valid description",
      } as any)
    ).rejects.toThrow("BAD_REQUEST");
  });
  
  test("accepts valid input and transforms correctly", async () => {
    // ARRANGE: Mock successful database operation
    const mockCreated = {
      id: "new-resource-1",
      name: "Valid Resource",
      description: "Valid description",
      organizationId: "test-org",
      createdById: "test-user",
      createdAt: new Date(),
    };
    
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([mockCreated]),
      }),
    } as any);
    
    const mockCtx = createVitestMockContext({
      user: { 
        id: "test-user", 
        user_metadata: { organizationId: "test-org" } 
      },
    });
    
    const caller = appRouter.createCaller(mockCtx);
    
    // ACT: Call with valid input
    const result = await caller.yourRouter.create({
      name: "Valid Resource",
      description: "Valid description",
      metadata: { key: "value" }, // Optional field
    });
    
    // ASSERT: Returns transformed result
    expect(result).toEqual(mockCreated);
    
    // VERIFY: Database called with correct data
    expect(mockDb.insert).toHaveBeenCalled();
    const insertCall = mockDb.insert().values as any;
    expect(insertCall).toHaveBeenCalledWith({
      name: "Valid Resource",
      description: "Valid description",
      metadata: { key: "value" },
      organizationId: "test-org", // Automatically added by RLS context
      createdById: "test-user", // Automatically added from auth context
    });
  });
  
  // =============================================================================
  // CRUD OPERATIONS TESTING
  // =============================================================================
  
  test("list procedure returns paginated results", async () => {
    // ARRANGE: Mock database results
    const mockResources = [
      { id: "1", name: "Resource 1", organizationId: "test-org" },
      { id: "2", name: "Resource 2", organizationId: "test-org" },
      { id: "3", name: "Resource 3", organizationId: "test-org" },
    ];
    
    mockDb.query.yourTable.findMany.mockResolvedValue(mockResources);
    
    const mockCtx = createVitestMockContext({
      user: { 
        id: "test-user", 
        user_metadata: { organizationId: "test-org" } 
      },
    });
    
    const caller = appRouter.createCaller(mockCtx);
    
    // ACT: Call list procedure with pagination
    const result = await caller.yourRouter.list({
      page: 1,
      limit: 10,
      sortBy: "name",
      sortOrder: "asc",
    });
    
    // ASSERT: Returns expected structure
    expect(result).toEqual({
      items: mockResources,
      pagination: {
        page: 1,
        limit: 10,
        total: mockResources.length,
        hasMore: false,
      },
    });
    
    // VERIFY: Database called with correct parameters
    expect(mockDb.query.yourTable.findMany).toHaveBeenCalledWith({
      where: expect.any(Object), // RLS where clause
      limit: 10,
      offset: 0,
      orderBy: expect.any(Array),
    });
  });
  
  test("update procedure validates ownership", async () => {
    // ARRANGE: Mock existing resource
    const existingResource = {
      id: "resource-1",
      name: "Original Name",
      organizationId: "test-org",
      createdById: "other-user", // Different user
    };
    
    mockDb.query.yourTable.findFirst.mockResolvedValue(existingResource);
    
    const mockCtx = createVitestMockContext({
      user: { 
        id: "test-user", // Different from creator
        user_metadata: { organizationId: "test-org", role: "member" } 
      },
    });
    
    const caller = appRouter.createCaller(mockCtx);
    
    // ACT & ASSERT: Should check ownership/permissions
    await expect(
      caller.yourRouter.update({
        id: "resource-1",
        name: "Updated Name",
      })
    ).rejects.toThrow("FORBIDDEN");
  });
  
  test("delete procedure works for authorized users", async () => {
    // ARRANGE: Mock existing resource owned by user
    const existingResource = {
      id: "resource-1",
      name: "To Delete",
      organizationId: "test-org",
      createdById: "test-user",
    };
    
    mockDb.query.yourTable.findFirst.mockResolvedValue(existingResource);
    mockDb.delete.mockReturnValue({
      where: vi.fn().mockResolvedValue({ count: 1 }),
    } as any);
    
    const mockCtx = createVitestMockContext({
      user: { 
        id: "test-user", 
        user_metadata: { organizationId: "test-org" } 
      },
    });
    
    const caller = appRouter.createCaller(mockCtx);
    
    // ACT: Delete resource
    const result = await caller.yourRouter.delete({ id: "resource-1" });
    
    // ASSERT: Returns success
    expect(result).toEqual({ success: true });
    
    // VERIFY: Database delete was called
    expect(mockDb.delete).toHaveBeenCalled();
  });
  
  // =============================================================================
  // ERROR HANDLING TESTS
  // =============================================================================
  
  test("handles database errors gracefully", async () => {
    // ARRANGE: Mock database error
    mockDb.query.yourTable.findMany.mockRejectedValue(new Error("Database connection failed"));
    
    const mockCtx = createVitestMockContext({
      user: { 
        id: "test-user", 
        user_metadata: { organizationId: "test-org" } 
      },
    });
    
    const caller = appRouter.createCaller(mockCtx);
    
    // ACT & ASSERT: Should throw internal server error
    await expect(
      caller.yourRouter.list({})
    ).rejects.toThrow("INTERNAL_SERVER_ERROR");
  });
  
  test("handles not found scenarios", async () => {
    // ARRANGE: Mock empty result
    mockDb.query.yourTable.findFirst.mockResolvedValue(null);
    
    const mockCtx = createVitestMockContext({
      user: { 
        id: "test-user", 
        user_metadata: { organizationId: "test-org" } 
      },
    });
    
    const caller = appRouter.createCaller(mockCtx);
    
    // ACT & ASSERT: Should throw not found error
    await expect(
      caller.yourRouter.getById({ id: "nonexistent-id" })
    ).rejects.toThrow("NOT_FOUND");
  });
  
  // =============================================================================
  // MIDDLEWARE TESTING
  // =============================================================================
  
  test("RLS middleware sets correct session context", async () => {
    // ARRANGE: Mock database response
    mockDb.query.yourTable.findMany.mockResolvedValue([]);
    
    const mockCtx = createVitestMockContext({
      user: { 
        id: "test-user", 
        user_metadata: { 
          organizationId: "test-org",
          role: "admin" 
        } 
      },
    });
    
    const caller = appRouter.createCaller(mockCtx);
    
    // ACT: Call any protected procedure
    await caller.yourRouter.list({});
    
    // ASSERT: RLS context was set correctly
    expect(mockDb.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        sql: expect.stringContaining("SET app.current_organization_id = 'test-org'"),
      }),
    );
    
    expect(mockDb.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        sql: expect.stringContaining("SET app.current_user_id = 'test-user'"),
      }),
    );
    
    expect(mockDb.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        sql: expect.stringContaining("SET app.current_user_role = 'admin'"),
      }),
    );
  });
  
  test("rate limiting middleware works correctly", async () => {
    const mockCtx = createVitestMockContext({
      user: { 
        id: "test-user", 
        user_metadata: { organizationId: "test-org" } 
      },
    });
    
    const caller = appRouter.createCaller(mockCtx);
    
    // ACT: Make multiple rapid requests
    const promises = Array.from({ length: 10 }, () =>
      caller.yourRouter.rateLimitedProcedure({})
    );
    
    const results = await Promise.allSettled(promises);
    
    // ASSERT: Some requests should be rate limited
    const successful = results.filter(r => r.status === "fulfilled");
    const rateLimited = results.filter(
      r => r.status === "rejected" && 
      (r.reason as TRPCError).code === "TOO_MANY_REQUESTS"
    );
    
    expect(successful.length).toBeLessThan(10);
    expect(rateLimited.length).toBeGreaterThan(0);
  });
  
  // =============================================================================
  // COMPLEX BUSINESS LOGIC TESTS
  // =============================================================================
  
  test("complex procedure handles multi-step workflow", async () => {
    // ARRANGE: Mock all required database calls
    const mockResource = { id: "resource-1", status: "draft" };
    const mockUpdatedResource = { ...mockResource, status: "published" };
    
    mockDb.query.yourTable.findFirst.mockResolvedValue(mockResource);
    mockDb.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockUpdatedResource]),
        }),
      }),
    } as any);
    
    // Mock notification creation
    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "notification-1" }]),
      }),
    } as any);
    
    const mockCtx = createVitestMockContext({
      user: { 
        id: "test-user", 
        user_metadata: { organizationId: "test-org" } 
      },
    });
    
    const caller = appRouter.createCaller(mockCtx);
    
    // ACT: Call complex workflow procedure
    const result = await caller.yourRouter.publishResource({
      id: "resource-1",
      publishSettings: {
        notifyUsers: true,
        scheduleDate: new Date(),
      },
    });
    
    // ASSERT: Returns workflow result
    expect(result).toEqual({
      resource: mockUpdatedResource,
      notificationSent: true,
      workflowComplete: true,
    });
    
    // VERIFY: All expected database operations occurred
    expect(mockDb.query.yourTable.findFirst).toHaveBeenCalled();
    expect(mockDb.update).toHaveBeenCalled();
    expect(mockDb.insert).toHaveBeenCalledTimes(1); // Notification creation
  });
});

// =============================================================================
// TEMPLATE USAGE INSTRUCTIONS
// =============================================================================

/*
SETUP INSTRUCTIONS:

1. Replace 'YourRouter' and 'yourRouter' with your actual router name
2. Replace 'yourTable' with your actual database table/schema name
3. Update import paths to match your project structure
4. Customize mock database responses for your specific procedures
5. Update authentication context for your user/session structure
6. Remove unused test cases and add router-specific tests

TRPC ROUTER TEST CHARACTERISTICS:
- Tests API endpoints and their contracts
- Uses mocked database for fast, isolated testing
- Tests authentication, authorization, and input validation
- Tests error handling and edge cases
- Tests middleware functionality (RLS, rate limiting, etc.)

WHEN TO USE THIS TEMPLATE:
✅ Testing tRPC router procedures and endpoints
✅ Testing API authentication and authorization
✅ Testing input validation and transformation
✅ Testing error handling and edge cases
✅ Testing middleware integration (RLS, logging, etc.)

WHEN NOT TO USE:
❌ Testing pure functions (use Archetype 1)
❌ Testing service layer logic (use Archetype 2)
❌ Testing database operations directly (use Archetype 3)
❌ Testing React components (use Archetype 4)

BENEFITS OF RLS IN ROUTER TESTING:
✅ Automatic organizational context from user metadata
✅ No manual organizationId parameter injection needed
✅ Simplified test setup - RLS middleware handles scoping
✅ Focus on API contract rather than security implementation

EXAMPLE ROUTERS SUITABLE FOR THIS TEMPLATE:
- issueRouter: CRUD operations for issues
- machineRouter: Machine management endpoints
- userRouter: User profile and settings
- reportRouter: Report generation and data export
- notificationRouter: Notification management
*/