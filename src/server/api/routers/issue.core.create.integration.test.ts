/**
 * Issue Core Router – create (Integration) – Test
 *
 * Validates member issue creation: inserts with createdById, applies defaults,
 * records activity, notifies owner; rejects invalid inputs and permission issues.
 *
 * Use:
 * - SEED_TEST_IDS for organizations, users, machines, statuses, priorities
 * - setupOrganizationMocks() to shape { kind: "authorized" } auth context
 * - SeedBasedMockFactory/MockDatabaseFactory to stub DB reads/writes deterministically
 * - Consider MockFormDataFactory when exercising Server Actions adjacent to this flow
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";
import { issueCoreRouter } from "~/server/api/routers/issue.core";
import { createCallerFactory } from "~/server/api/trpc";
import {
  MockDatabaseFactory,
  SeedBasedMockFactory,
} from "~/test/mocks/seed-based-mocks";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";
import { setupOrganizationMocks } from "~/test/setup/organization-mocks";

// Mock permissions
vi.mock("~/server/auth/permissions", () => ({
  requirePermissionForSession: vi.fn(),
  getUserPermissionsForSupabaseUser: vi
    .fn()
    .mockResolvedValue(["issue:create"]),
}));

const createCaller = createCallerFactory(issueCoreRouter);

const primaryOrgId = "test-org-pinpoint";
const adminUser = {
  id: SEED_TEST_IDS.USERS.ADMIN,
  email: "admin@test.com",
  app_metadata: {},
  user_metadata: {},
};

describe("issue.core.create (integration)", () => {
  let db, services, mockNotificationService, mockActivityService;

  beforeEach(() => {
    vi.resetAllMocks();
    db = MockDatabaseFactory.createMockDbClient();
    db.transaction = vi.fn(async (callback) => callback(db));
    db.execute = vi.fn();

    // Mock membership query
    if (!db.query.memberships) {
      db.query.memberships = {};
    }
    const membership = {
      id: SEED_TEST_IDS.MEMBERSHIPS.admin,
      userId: adminUser.id,
      organizationId: primaryOrgId,
      roleId: SEED_TEST_IDS.ROLES.ADMIN,
      user: adminUser,
      role: {
        id: SEED_TEST_IDS.ROLES.ADMIN,
        name: "Admin",
        rolePermissions: [{ permission: { name: "issue:create" } }],
      },
    };
    db.query.memberships.findFirst = vi.fn().mockResolvedValue(membership);

    mockNotificationService = {
      notifyMachineOwnerOfIssue: vi.fn(),
    };
    mockActivityService = {
      recordIssueCreated: vi.fn(),
    };
    services = {
      createNotificationService: vi.fn(() => mockNotificationService),
      createIssueActivityService: vi.fn(() => mockActivityService),
    };
  });

  it("creates member issue with defaults, activity recorded, and notification sent", async () => {
    const { requirePermissionForSession } = await import(
      "~/server/auth/permissions"
    );
    vi.mocked(requirePermissionForSession).mockResolvedValue(undefined);

    const machine = {
      ...SeedBasedMockFactory.createMockMachine(),
      location: { organization_id: primaryOrgId },
    };
    const defaultStatus = {
      id: "status-open-1",
      name: "Open",
      organizationId: primaryOrgId,
      isDefault: true,
    };
    const defaultPriority = {
      id: "priority-medium-1",
      name: "Medium",
      organizationId: primaryOrgId,
      isDefault: true,
    };

    db.query.machines.findFirst.mockResolvedValue(machine);
    db.query.issueStatuses.findFirst.mockResolvedValue(defaultStatus);
    db.query.priorities.findFirst.mockResolvedValue(defaultPriority);

    const createdIssue = {
      id: "issue-id-123",
      title: "Test Issue",
      statusId: defaultStatus.id,
      priorityId: defaultPriority.id,
      createdById: adminUser.id,
      machineId: machine.id,
      organizationId: primaryOrgId,
      issueNumber: 1,
      description: null,
      assignedToId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    db.insert.mockReturnValue({
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([createdIssue]),
    });

    const caller = createCaller({
      db,
      services,
      organizationId: primaryOrgId,
      organization: SeedBasedMockFactory.createMockOrganization(),
      ...setupOrganizationMocks({ kind: "authorized" }),
      user: adminUser,
    });

    const input = {
      title: "Test Issue",
      machineId: machine.id,
      organizationId: primaryOrgId,
    };

    const result = await caller.create(input);

    expect(result.statusId).toBe(defaultStatus.id);
    expect(result.priorityId).toBe(defaultPriority.id);
    expect(result.createdById).toBe(adminUser.id);
    expect(
      mockNotificationService.notifyMachineOwnerOfIssue,
    ).toHaveBeenCalled();
    expect(mockActivityService.recordIssueCreated).toHaveBeenCalled();
  });

  it("rejects create when target machine is soft-deleted", async () => {
    const { requirePermissionForSession } = await import(
      "~/server/auth/permissions"
    );
    vi.mocked(requirePermissionForSession).mockResolvedValue(undefined);

    db.query.machines.findFirst.mockResolvedValue(null);

    const caller = createCaller({
      db,
      services,
      organizationId: primaryOrgId,
      organization: SeedBasedMockFactory.createMockOrganization(),
      ...setupOrganizationMocks({ kind: "authorized" }),
      user: adminUser,
    });

    const input = {
      title: "Test Issue",
      machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      organizationId: primaryOrgId,
    };

    await expect(caller.create(input)).rejects.toThrow(
      new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Machine not found",
      }),
    );
  });

  it("rejects create when org default status/priority is missing", async () => {
    const { requirePermissionForSession } = await import(
      "~/server/auth/permissions"
    );
    vi.mocked(requirePermissionForSession).mockResolvedValue(undefined);

    const machine = {
      ...SeedBasedMockFactory.createMockMachine(),
      location: { organization_id: primaryOrgId },
    };
    db.query.machines.findFirst.mockResolvedValue(machine);
    db.query.issueStatuses.findFirst.mockResolvedValue(null); // Missing status

    const caller = createCaller({
      db,
      services,
      organizationId: primaryOrgId,
      organization: SeedBasedMockFactory.createMockOrganization(),
      ...setupOrganizationMocks({ kind: "authorized" }),
      user: adminUser,
    });

    const input = {
      title: "Test Issue",
      machineId: machine.id,
      organizationId: primaryOrgId,
    };

    await expect(caller.create(input)).rejects.toThrow(
      "Default issue status not found. Please contact an administrator.",
    );
  });

  it("validates required fields and surfaces field errors", async () => {
    const { requirePermissionForSession } = await import(
      "~/server/auth/permissions"
    );
    vi.mocked(requirePermissionForSession).mockResolvedValue(undefined);

    const machine = {
      ...SeedBasedMockFactory.createMockMachine(),
      location: { organization_id: primaryOrgId },
    };
    const defaultStatus = SeedBasedMockFactory.createMockIssueStatus({
      isDefault: true,
    });
    const defaultPriority = SeedBasedMockFactory.createMockPriority({
      isDefault: true,
    });

    db.query.machines.findFirst.mockResolvedValue(machine);
    db.query.issueStatuses.findFirst.mockResolvedValue(defaultStatus);
    db.query.priorities.findFirst.mockResolvedValue(defaultPriority);

    const caller = createCaller({
      db,
      services,
      organizationId: primaryOrgId,
      organization: SeedBasedMockFactory.createMockOrganization(),
      ...setupOrganizationMocks({ kind: "authorized" }),
      user: adminUser,
    });

    const input = {
      title: "", // Invalid title
      machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      organizationId: primaryOrgId,
    };

    await expect(caller.create(input)).rejects.toThrow("Title is required");
  });

  it("denies create without appropriate permission (issue:create)", async () => {
    const { requirePermissionForSession } = await import(
      "~/server/auth/permissions"
    );
    vi.mocked(requirePermissionForSession).mockRejectedValue(
      new TRPCError({ code: "FORBIDDEN" }),
    );

    const caller = createCaller({
      db,
      services,
      organizationId: primaryOrgId,
      organization: SeedBasedMockFactory.createMockOrganization(),
      ...setupOrganizationMocks({ kind: "authorized" }),
      user: adminUser,
    });

    const input = {
      title: "Test Issue",
      machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      organizationId: primaryOrgId,
    };

    await expect(caller.create(input)).rejects.toThrow(
      new TRPCError({ code: "FORBIDDEN" }),
    );
  });
});
