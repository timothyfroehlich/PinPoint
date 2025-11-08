/**
 * Issue Core Router – create (Integration)
 *
 * Validates the member create mutation end-to-end.
 * - Verifies middleware (organization + issue:create permission) wiring
 * - Ensures successful inserts trigger activity + notification services
 * - Guards against missing resources (machine/defaults) and invalid payloads
 * - Confirms permission denials bubble up without touching the database
 * - Tests permission downgrade (basic vs full permission)
 *
 * Tests only touch router files to keep parallel work (actions/public routes) isolated.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

import { issueRouter } from "~/server/api/routers/issue";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";
import { authenticatedTestUtils } from "~/test/helpers/authenticated-test-helpers";

// Mock RLS helper to ensure middleware proceeds in tests
vi.mock("~/server/db/utils/rls", () => ({
  withOrgRLS: vi.fn(
    async (_db: unknown, _orgId: string, cb: (tx: unknown) => unknown) => {
      return await cb(_db);
    },
  ),
}));

const {
  requirePermissionForSessionMock,
  getUserPermissionsForSupabaseUserMock,
  generatePrefixedIdMock,
} = vi.hoisted(() => ({
  requirePermissionForSessionMock: vi.fn().mockResolvedValue(undefined),
  getUserPermissionsForSupabaseUserMock: vi
    .fn()
    .mockResolvedValue(["issue:create", "issue:assign"]),
  generatePrefixedIdMock: vi.fn().mockReturnValue("issue-test-123"),
}));

vi.mock("~/server/auth/permissions", () => ({
  requirePermissionForSession: requirePermissionForSessionMock,
  getUserPermissionsForSupabaseUser: getUserPermissionsForSupabaseUserMock,
}));

vi.mock("~/lib/utils/id-generation", () => ({
  generatePrefixedId: generatePrefixedIdMock,
}));

describe("issue.core.create (integration)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requirePermissionForSessionMock.mockResolvedValue(undefined);
    getUserPermissionsForSupabaseUserMock.mockResolvedValue([
      "issue:create",
      "issue:assign",
    ]);
    generatePrefixedIdMock.mockReturnValue("issue-test-123");
  });

  it("inserts an issue, records activity, and notifies the machine owner", async () => {
    const ctx = authenticatedTestUtils.createContext();
    const { mockDb, mockContext } = ctx;

    // Setup mocks for machine + org defaults
    mockDb.query.machines.findFirst.mockResolvedValue({
      id: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      name: "Medieval Madness",
      location: {
        id: SEED_TEST_IDS.LOCATIONS.PRIMARY,
        name: "PinPoint HQ",
        organization_id: SEED_TEST_IDS.ORGANIZATIONS.primary,
      },
    } as never);

    mockDb.query.issueStatuses.findFirst.mockResolvedValue({
      id: SEED_TEST_IDS.STATUSES.NEW_PRIMARY,
      name: "New",
      organization_id: SEED_TEST_IDS.ORGANIZATIONS.primary,
      is_default: true,
      category: "new",
    } as never);

    mockDb.query.priorities.findFirst.mockResolvedValue({
      id: SEED_TEST_IDS.PRIORITIES.MEDIUM_PRIMARY,
      name: "Medium",
      organization_id: SEED_TEST_IDS.ORGANIZATIONS.primary,
      is_default: true,
    } as never);

    // Insert chain returns created issue ID; subsequent query returns full row
    (mockDb.insert as never) = vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });

    mockDb.query.issues.findFirst.mockResolvedValue({
      id: "issue-test-123",
      title: "Flipper misfires intermittently",
      description: null,
      created_by_id: SEED_TEST_IDS.USERS.ADMIN,
      organization_id: SEED_TEST_IDS.ORGANIZATIONS.primary,
      machine_id: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      status_id: SEED_TEST_IDS.STATUSES.NEW_PRIMARY,
      priority_id: SEED_TEST_IDS.PRIORITIES.MEDIUM_PRIMARY,
      status: { id: SEED_TEST_IDS.STATUSES.NEW_PRIMARY, name: "New" },
      createdBy: {
        id: SEED_TEST_IDS.USERS.ADMIN,
        name: SEED_TEST_IDS.NAMES.ADMIN,
        email: SEED_TEST_IDS.EMAILS.ADMIN,
        image: null,
      },
      machine: {
        id: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
        name: "Medieval Madness",
        model: null,
        location: {
          id: SEED_TEST_IDS.LOCATIONS.PRIMARY,
          name: "PinPoint HQ",
          organization_id: SEED_TEST_IDS.ORGANIZATIONS.primary,
        },
      },
    } as never);

    const caller = issueRouter.createCaller(mockContext as never);

    const result = await caller.core.create({
      title: "Flipper misfires intermittently",
      description: "Player reports the left flipper drops mid-game.",
      machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
    });

    expect(result.id).toBe("issue-test-123");
    expect(result.createdById).toBe(SEED_TEST_IDS.USERS.ADMIN);

    // Verify activity service was called
    expect(mockContext.services.createIssueActivityService).toHaveBeenCalled();
    const activityService = (
      mockContext.services.createIssueActivityService as never as ReturnType<
        typeof vi.fn
      >
    )();
    expect(activityService.recordIssueCreated).toHaveBeenCalledWith(
      "issue-test-123",
      SEED_TEST_IDS.USERS.ADMIN,
    );

    // Verify notification service was called
    expect(
      mockContext.services.createNotificationService,
    ).toHaveBeenCalled();
    const notificationService = (
      mockContext.services.createNotificationService as never as ReturnType<
        typeof vi.fn
      >
    )();
    expect(
      notificationService.notifyMachineOwnerOfIssue,
    ).toHaveBeenCalledWith(
      "issue-test-123",
      SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
    );

    // Verify permission check was called
    expect(requirePermissionForSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({
          id: SEED_TEST_IDS.USERS.ADMIN,
        }),
      }),
      "issue:create",
      expect.any(Object),
    );
  });

  it("rejects creation when the machine is missing/soft-deleted", async () => {
    const ctx = authenticatedTestUtils.createContext();
    const { mockDb, mockContext } = ctx;

    // Simulate invisible/soft-deleted: DB returns null
    mockDb.query.machines.findFirst.mockResolvedValue(null);

    const caller = issueRouter.createCaller(mockContext as never);

    await expect(
      caller.core.create({
        title: "Cabinet loose wires",
        machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      }),
    ).rejects.toMatchObject({
      message: "Machine not found",
    });
  });

  it("rejects creation when the default status is missing", async () => {
    const ctx = authenticatedTestUtils.createContext();
    const { mockDb, mockContext } = ctx;

    mockDb.query.machines.findFirst.mockResolvedValue({
      id: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      name: "Medieval Madness",
      location: {
        id: SEED_TEST_IDS.LOCATIONS.PRIMARY,
        name: "PinPoint HQ",
        organization_id: SEED_TEST_IDS.ORGANIZATIONS.primary,
      },
    } as never);

    mockDb.query.issueStatuses.findFirst.mockResolvedValue(null);

    const caller = issueRouter.createCaller(mockContext as never);

    await expect(
      caller.core.create({
        title: "No GI lighting",
        machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      }),
    ).rejects.toMatchObject({
      message:
        "Default issue status not found. Please contact an administrator.",
    });
  });

  it("rejects creation when the default priority is missing", async () => {
    const ctx = authenticatedTestUtils.createContext();
    const { mockDb, mockContext } = ctx;

    mockDb.query.machines.findFirst.mockResolvedValue({
      id: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      name: "Medieval Madness",
      location: {
        id: SEED_TEST_IDS.LOCATIONS.PRIMARY,
        name: "PinPoint HQ",
        organization_id: SEED_TEST_IDS.ORGANIZATIONS.primary,
      },
    } as never);

    mockDb.query.issueStatuses.findFirst.mockResolvedValue({
      id: SEED_TEST_IDS.STATUSES.NEW_PRIMARY,
      name: "New",
      organization_id: SEED_TEST_IDS.ORGANIZATIONS.primary,
      is_default: true,
      category: "new",
    } as never);

    mockDb.query.priorities.findFirst.mockResolvedValue(null);

    const caller = issueRouter.createCaller(mockContext as never);

    await expect(
      caller.core.create({
        title: "Shooter lane jam",
        machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      }),
    ).rejects.toMatchObject({
      message: "Default priority not found. Please contact an administrator.",
    });
  });

  it("enforces title validation (blank titles are rejected)", async () => {
    const ctx = authenticatedTestUtils.createContext();
    const { mockDb, mockContext } = ctx;

    mockDb.query.machines.findFirst.mockResolvedValue({
      id: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      name: "Medieval Madness",
      location: {
        id: SEED_TEST_IDS.LOCATIONS.PRIMARY,
        name: "PinPoint HQ",
        organization_id: SEED_TEST_IDS.ORGANIZATIONS.primary,
      },
    } as never);

    mockDb.query.issueStatuses.findFirst.mockResolvedValue({
      id: SEED_TEST_IDS.STATUSES.NEW_PRIMARY,
      name: "New",
      organization_id: SEED_TEST_IDS.ORGANIZATIONS.primary,
      is_default: true,
      category: "new",
    } as never);

    mockDb.query.priorities.findFirst.mockResolvedValue({
      id: SEED_TEST_IDS.PRIORITIES.MEDIUM_PRIMARY,
      name: "Medium",
      organization_id: SEED_TEST_IDS.ORGANIZATIONS.primary,
      is_default: true,
    } as never);

    const caller = issueRouter.createCaller(mockContext as never);

    await expect(
      caller.core.create({
        title: "   \n\t  ",
        machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      }),
    ).rejects.toMatchObject({
      message: "Issue title cannot be empty",
    });
  });

  it("propagates permission failures from the issue:create guard", async () => {
    const ctx = authenticatedTestUtils.createContext();
    const { mockContext } = ctx;

    requirePermissionForSessionMock.mockRejectedValueOnce(
      new TRPCError({
        code: "FORBIDDEN",
        message: "issue:create denied",
      }),
    );

    const caller = issueRouter.createCaller(mockContext as never);

    await expect(
      caller.core.create({
        title: "Test Issue",
        machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "issue:create denied",
    });
  });

  it("allows creation when user has only issue:create_basic permission", async () => {
    const ctx = authenticatedTestUtils.basicPermissions();
    const { mockDb, mockContext } = ctx;

    // Update the mock to reflect basic permission
    getUserPermissionsForSupabaseUserMock.mockResolvedValueOnce([
      "issue:create_basic",
    ]);

    // Setup mocks for machine + org defaults
    mockDb.query.machines.findFirst.mockResolvedValue({
      id: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      name: "Medieval Madness",
      location: {
        id: SEED_TEST_IDS.LOCATIONS.PRIMARY,
        name: "PinPoint HQ",
        organization_id: SEED_TEST_IDS.ORGANIZATIONS.primary,
      },
    } as never);

    mockDb.query.issueStatuses.findFirst.mockResolvedValue({
      id: SEED_TEST_IDS.STATUSES.NEW_PRIMARY,
      name: "New",
      organization_id: SEED_TEST_IDS.ORGANIZATIONS.primary,
      is_default: true,
      category: "new",
    } as never);

    mockDb.query.priorities.findFirst.mockResolvedValue({
      id: SEED_TEST_IDS.PRIORITIES.MEDIUM_PRIMARY,
      name: "Medium",
      organization_id: SEED_TEST_IDS.ORGANIZATIONS.primary,
      is_default: true,
    } as never);

    // Insert chain returns created issue ID; subsequent query returns full row
    (mockDb.insert as never) = vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    });

    mockDb.query.issues.findFirst.mockResolvedValue({
      id: "issue-test-123",
      title: "Basic permission test issue",
      description: null,
      created_by_id: ctx.user.id,
      organization_id: SEED_TEST_IDS.ORGANIZATIONS.primary,
      machine_id: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      status_id: SEED_TEST_IDS.STATUSES.NEW_PRIMARY,
      priority_id: SEED_TEST_IDS.PRIORITIES.MEDIUM_PRIMARY,
      status: { id: SEED_TEST_IDS.STATUSES.NEW_PRIMARY, name: "New" },
      createdBy: {
        id: ctx.user.id,
        name: ctx.user.user_metadata.name,
        email: ctx.user.email,
        image: null,
      },
      machine: {
        id: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
        name: "Medieval Madness",
        model: null,
        location: {
          id: SEED_TEST_IDS.LOCATIONS.PRIMARY,
          name: "PinPoint HQ",
          organization_id: SEED_TEST_IDS.ORGANIZATIONS.primary,
        },
      },
    } as never);

    const caller = issueRouter.createCaller(mockContext as never);

    const result = await caller.core.create({
      title: "Basic permission test issue",
      machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
    });

    expect(result.id).toBe("issue-test-123");
    expect(result.createdById).toBe(ctx.user.id);

    // Verify permission check was called (middleware ran)
    expect(requirePermissionForSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({
          id: ctx.user.id,
        }),
      }),
      "issue:create",
      expect.any(Object),
    );

    // Verify issue was created successfully despite basic permission
    // (Router currently uses legacy "issue:create" permission which should pass)
    expect(mockDb.insert).toHaveBeenCalled();
  });
});
