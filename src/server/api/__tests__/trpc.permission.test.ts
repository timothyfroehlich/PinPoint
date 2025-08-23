import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// =================================================================
// MOCK SETUP
// =================================================================

// Mock the environment variables. This is crucial because the code under test
// (trpc.base.ts) imports the real `env` module.
vi.mock("~/env", () => ({
  env: {
    DATABASE_URL: "mock-db-url-for-trpc-permission-test",
    NODE_ENV: "test",
    DEFAULT_ORG_SUBDOMAIN: "default",
  },
}));

// Mock the database schema. This is also crucial as trpc.base.ts imports
// real schema objects, which would pollute the cache for other tests.
vi.mock("~/server/db/schema", () => ({
  organizations: {
    id: "mockOrgId",
    subdomain: "mockOrgSubdomain",
    name: "mockOrgName",
  },
  memberships: {
    id: "mockMembershipId",
    organizationId: "mockOrgId",
    userId: "mockUserId",
  },
}));

// This is the central mock database for this entire test file.
const mockDb = {
  query: {
    memberships: {
      findFirst: vi.fn(),
    },
    organizations: {
      findFirst: vi.fn(),
    },
  },
} as unknown as DrizzleClient;

// Mock the database provider to prevent the real DB from being loaded.
// This is the key to isolating this test file.
vi.mock("~/server/db/provider", () => ({
  getGlobalDatabaseProvider: vi.fn(() => ({
    getClient: () => mockDb,
  })),
}));

// NOW we can import the code to be tested.
// The imports must come AFTER the mocks.
import { createTRPCRouter, organizationProcedure } from "../trpc.base";
import { type DrizzleClient } from "~/server/db/drizzle";
import { TRPCError } from "@trpc/server";

// =================================================================
// TEST SETUP
// =================================================================

const testRouter = createTRPCRouter({
  testRequirePermission: organizationProcedure
    .use(async (opts) => {
      if (!opts.ctx.userPermissions.includes("test:permission")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Missing required permission: test:permission",
        });
      }
      return opts.next();
    })
    .query(() => {
      return { message: "Permission granted" };
    }),
});

const createTestContext = (permissions: string[]) => {
  const membership = {
    id: "test-membership-id",
    organizationId: "test-org",
    userId: "test-user",
    role: {
      id: "test-role",
      name: "Test Role",
      rolePermissions: permissions.map((p) => ({
        permission: { id: `perm-${p}`, name: p },
      })),
    },
  };

  vi.mocked(mockDb.query.memberships.findFirst).mockResolvedValue(membership);

  return {
    db: mockDb,
    user: { id: "test-user" },
    organization: { id: "test-org", name: "Test Org", subdomain: "test" },
    organizationId: "test-org",
    userPermissions: permissions,
    session: { user: { id: "test-user" } },
    membership,
    headers: new Headers(),
    logger: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
      child: vi.fn().mockReturnThis(),
    },
  };
};

// =================================================================
// TESTS
// =================================================================

describe("tRPC Permission Middleware (Fully Mocked)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(async () => {
    vi.resetAllMocks();
    vi.restoreAllMocks();
    await vi.resetModules();
  });

  it("should allow access when user has the required permission", async () => {
    const ctx = createTestContext(["test:permission", "other:permission"]);
    const caller = testRouter.createCaller(ctx as any);
    const result = await caller.testRequirePermission();
    expect(result).toEqual({ message: "Permission granted" });
  });

  it("should deny access when user lacks the required permission", async () => {
    const ctx = createTestContext(["other:permission"]);
    const caller = testRouter.createCaller(ctx as any);
    await expect(caller.testRequirePermission()).rejects.toThrow(
      "Missing required permission: test:permission",
    );
  });

  it("should deny access when user has no permissions", async () => {
    const ctx = createTestContext([]);
    const caller = testRouter.createCaller(ctx as any);
    await expect(caller.testRequirePermission()).rejects.toThrow(TRPCError);
  });

  it("should correctly identify the error code as FORBIDDEN", async () => {
    const ctx = createTestContext([]);
    const caller = testRouter.createCaller(ctx as any);
    try {
      await caller.testRequirePermission();
      expect.fail("Should have thrown a TRPCError");
    } catch (e) {
      expect(e).toBeInstanceOf(TRPCError);
      if (e instanceof TRPCError) {
        expect(e.code).toBe("FORBIDDEN");
      }
    }
  });
});
