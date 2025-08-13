/**
 * Admin Router Integration Tests (PGlite)
 *
 * Integration tests for the admin router using PGlite in-memory PostgreSQL database.
 * Tests real database operations for user management, roles, and invitations.
 */

/* eslint-disable @typescript-eslint/unbound-method */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Import test setup and utilities
import type { TRPCContext } from "~/server/api/trpc.base";
import type { ExtendedPrismaClient } from "~/server/db";

import { adminRouter } from "~/server/api/routers/admin";
import {
  createSeededTestDatabase,
  getSeededTestData,
  type TestDatabase,
} from "~/test/helpers/pglite-test-setup";

// Mock external dependencies that aren't database-related
vi.mock("~/lib/utils/id-generation", () => ({
  generateId: vi.fn(() => `test-id-${Date.now()}`),
  generatePrefixedId: vi.fn(
    (prefix: string) => `${prefix}_test_${crypto.randomUUID()}`,
  ),
}));

vi.mock("~/server/auth/permissions", () => ({
  getUserPermissionsForSession: vi
    .fn()
    .mockResolvedValue([
      "user:manage",
      "role:manage",
      "organization:manage",
    ]),
  getUserPermissionsForSupabaseUser: vi
    .fn()
    .mockResolvedValue([
      "user:manage",
      "role:manage",
      "organization:manage",
    ]),
  requirePermissionForSession: vi.fn().mockResolvedValue(undefined),
}));

describe("Admin Router Integration (PGlite)", () => {
  let db: TestDatabase;
  let context: TRPCContext;
  let caller: ReturnType<typeof adminRouter.createCaller>;

  // Test data IDs - queried from actual seeded data
  let testData: {
    organization: string;
    location?: string;
    machine?: string;
    model?: string;
    status?: string;
    priority?: string;
    issue?: string;
    adminRole?: string;
    memberRole?: string;
    user?: string;
  };

  beforeEach(async () => {
    // Create fresh PGlite database with real schema and seed data
    const setup = await createSeededTestDatabase();
    db = setup.db;

    // Query actual seeded IDs instead of using hardcoded ones
    testData = await getSeededTestData(db, setup.organizationId);

    // Create mock Prisma client for tRPC middleware compatibility
    const mockPrismaClient = {
      membership: {
        findFirst: vi.fn().mockResolvedValue({
          id: "test-membership",
          organizationId: testData.organization,
          userId: testData.user || "test-user-1",
          role: {
            id: testData.adminRole,
            name: "Admin",
            permissions: [
              { id: "perm1", name: "user:manage" },
              { id: "perm2", name: "role:manage" },
              { id: "perm3", name: "organization:manage" },
            ],
          },
        }),
      },
    } as unknown as ExtendedPrismaClient;

    // Create test context with real database
    context = {
      user: {
        id: testData.user || "test-user-1",
        email: "test@example.com",
        user_metadata: { name: "Test User" },
        app_metadata: { organization_id: testData.organization, role: "Admin" },
      },
      organization: {
        id: testData.organization,
        name: "Test Organization",
        subdomain: "test-org",
      },
      db: mockPrismaClient,
      drizzle: db,
      supabase: {
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        },
      } as any,
      services: {
        createPinballMapService: vi.fn(),
        createNotificationService: vi.fn(),
        createCollectionService: vi.fn(),
        createIssueActivityService: vi.fn(),
        createCommentCleanupService: vi.fn(),
        createQRCodeService: vi.fn(),
      },
      headers: new Headers(),
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
        trace: vi.fn(),
        child: vi.fn(() => context.logger),
        withRequest: vi.fn(() => context.logger),
        withUser: vi.fn(() => context.logger),
        withOrganization: vi.fn(() => context.logger),
        withContext: vi.fn(() => context.logger),
      },
      userPermissions: [
        "user:manage",
        "role:manage",
        "organization:manage",
      ],
    } as any;

    caller = adminRouter.createCaller(context);
  });

  describe("getUsers", () => {
    it("should return a list of users in the organization", async () => {
      const users = await caller.getUsers();

      // The seed script creates 9 users in the org
      expect(users).toHaveLength(9);

      const devAdmin = users.find((u) => u.name === "Dev Admin");
      expect(devAdmin).toBeDefined();
      expect(devAdmin?.email).toBe("admin@dev.local");
      expect(devAdmin?.role.name).toBe("Admin");

      const userToDelete = users.find((u) => u.name === "User to Delete");
      expect(userToDelete).toBeDefined();
      expect(userToDelete?.email).toBe("delete@me.com");
      expect(userToDelete?.role.name).toBe("Member");
    });
  });

  describe("updateUser", () => {
    it("should update a user's role", async () => {
      const users = await caller.getUsers();
      const devMember = users.find((u) => u.name === "Dev Member");
      expect(devMember).toBeDefined();
      expect(devMember?.role.name).toBe("Member");

      const adminRole = await db.query.roles.findFirst({
        where: (roles, { and, eq }) =>
          and(
            eq(roles.organizationId, testData.organization),
            eq(roles.name, "Admin"),
          ),
      });
      expect(adminRole).toBeDefined();

      if (!devMember || !adminRole) {
        throw new Error("Test data not found");
      }

      const updatedUser = await caller.updateUser({
        userId: devMember.userId,
        roleId: adminRole.id,
      });

      expect(updatedUser).toBeDefined();
      expect(updatedUser.userId).toBe(devMember.userId);
      expect(updatedUser.roleId).toBe(adminRole.id);

      // Verify in database
      const membership = await db.query.memberships.findFirst({
        where: (memberships, { eq }) => eq(memberships.userId, devMember.userId),
      });
      expect(membership?.roleId).toBe(adminRole.id);
    });
  });

  describe("removeUser", () => {
    it("should remove a user from the organization", async () => {
      const userToDeleteId = "user-to-delete";

      // Verify user exists before deletion
      let user = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.id, userToDeleteId),
      });
      expect(user).toBeDefined();

      const result = await caller.removeUser({ userId: userToDeleteId });
      expect(result).toEqual({ success: true });

      // Verify user is deleted from users table and memberships table
      user = await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.id, userToDeleteId),
      });
      expect(user).toBeUndefined();

      const membership = await db.query.memberships.findFirst({
        where: (memberships, { eq }) => eq(memberships.userId, userToDeleteId),
      });
      expect(membership).toBeUndefined();
    });
  });

  describe("Invitations", () => {
    it("should get a list of invited users", async () => {
      const invitedUsers = await caller.getInvitedUsers();
      expect(invitedUsers).toHaveLength(2);

      const inv1 = invitedUsers.find((i) => i.email === "invited.user1@example.com");
      expect(inv1).toBeDefined();
      expect(inv1?.role.name).toBe("Admin");
      expect(inv1?.status).toBe("PENDING");

      const inv2 = invitedUsers.find((i) => i.email === "invited.user2@example.com");
      expect(inv2).toBeDefined();
      expect(inv2?.status).toBe("EXPIRED");
    });

    it("should delete an invited user", async () => {
      const invitationIdToDelete = "inv-1";

      // Verify invitation exists before deletion
      let invitation = await db.query.invitations.findFirst({
        where: (invitations, { eq }) => eq(invitations.id, invitationIdToDelete),
      });
      expect(invitation).toBeDefined();

      const result = await caller.deleteInvitedUser({ invitationId: invitationIdToDelete });
      expect(result).toEqual({ success: true });

      // Verify invitation is deleted
      invitation = await db.query.invitations.findFirst({
        where: (invitations, { eq }) => eq(invitations.id, invitationIdToDelete),
      });
      expect(invitation).toBeUndefined();

      // Verify other invitation still exists
      const otherInvitation = await db.query.invitations.findFirst({
        where: (invitations, { eq }) => eq(invitations.id, "inv-2"),
      });
      expect(otherInvitation).toBeDefined();
    });

    it("should invite a new user", async () => {
      const newEmail = "new.invite@example.com";
      const memberRole = await db.query.roles.findFirst({
        where: (roles, { and, eq }) =>
          and(
            eq(roles.organizationId, testData.organization),
            eq(roles.name, "Member"),
          ),
      });
      expect(memberRole).toBeDefined();

      if (!memberRole) {
        throw new Error("Test data not found");
      }

      const result = await caller.inviteUser({
        email: newEmail,
        roleId: memberRole.id,
      });

      expect(result).toBeDefined();
      expect(result.email).toBe(newEmail);
      expect(result.roleId).toBe(memberRole.id);
      expect(result.organizationId).toBe(testData.organization);

      // Verify in database
      const invitation = await db.query.invitations.findFirst({
        where: (invitations, { eq }) => eq(invitations.email, newEmail),
      });
      expect(invitation).toBeDefined();
      expect(invitation?.roleId).toBe(memberRole.id);
    });
  });
});
