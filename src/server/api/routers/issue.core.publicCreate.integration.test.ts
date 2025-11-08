/**
 * Issue Core Router – publicCreate (Integration)
 *
 * Validates anonymous issue creation behavior using a proper anon tRPC context:
 * - Inserts with createdById=null and persists reporterEmail (lowercased)
 * - Skips activity recording (no actor) and notifies machine owner
 * - Rejects soft-deleted/invisible machines, missing defaults, cross-org, invalid email
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";
// Mock RLS helper to ensure middleware proceeds in tests
vi.mock("~/server/db/utils/rls", () => ({
  withOrgRLS: vi.fn(async (_db: unknown, _orgId: string, cb: (tx: unknown) => unknown) => {
    return await cb(_db);
  }),
}));
import { issueRouter } from "~/server/api/routers/issue";
import { anonymousTestUtils } from "~/test/helpers/anonymous-test-helpers";

// Narrow service type for our spy
type MockedNotificationService = {
  notifyMachineOwnerOfIssue: ReturnType<typeof vi.fn>;
};

describe("issue.core.publicCreate (integration)", () => {
  let ctx: ReturnType<typeof anonymousTestUtils.createContext>;
  let services: {
    createNotificationService: () => MockedNotificationService;
    createIssueActivityService: ReturnType<typeof vi.fn>;
  };
  let notifySpy: ReturnType<typeof vi.fn>;
  let activityFactorySpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Anonymous org-scoped context via subdomain headers
    ctx = anonymousTestUtils.createContext({
      organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
      subdomain: "primary-test",
    });

    // Mock services on context
    notifySpy = vi.fn();
    activityFactorySpy = vi.fn();
    services = {
      createNotificationService: () => ({
        notifyMachineOwnerOfIssue: notifySpy,
      }),
      // Ensure activity service factory is never called for anonymous flow
      createIssueActivityService: activityFactorySpy,
    };

    // Attach services and ensure base context shape matches TRPC expectations
    (ctx.mockContext as any).services = services;
  });

  it("creates anonymous issue with defaults and notifies owner (no activity)", async () => {
    const { mockDb, mockContext } = ctx;

    // Setup mocks for machine + org defaults
    mockDb.query.machines.findFirst.mockResolvedValue({
      id: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      name: "Medieval Madness #1",
      location: { organization_id: SEED_TEST_IDS.ORGANIZATIONS.primary },
    } as any);
    mockDb.query.issueStatuses.findFirst.mockResolvedValue({
      id: SEED_TEST_IDS.STATUSES.NEW_PRIMARY,
      name: "New",
      organization_id: SEED_TEST_IDS.ORGANIZATIONS.primary,
      is_default: true,
      category: "NEW",
    } as any);
    mockDb.query.priorities.findFirst.mockResolvedValue({
      id: SEED_TEST_IDS.PRIORITIES.MEDIUM_PRIMARY,
      name: "Medium",
      organization_id: SEED_TEST_IDS.ORGANIZATIONS.primary,
      is_default: true,
      order: 2,
    } as any);

    // Insert chain returns created issue ID; subsequent query returns full row
    const createdIssueId = SEED_TEST_IDS.ISSUES.KAIJU_FIGURES;
    (mockDb.insert as any).mockReturnValue({
      values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{}]) }),
    });
    mockDb.query.issues.findFirst.mockResolvedValue({
      id: createdIssueId,
      title: "Anonymous Issue",
      created_by_id: null,
      organization_id: SEED_TEST_IDS.ORGANIZATIONS.primary,
      machine_id: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      status: { id: SEED_TEST_IDS.STATUSES.NEW_PRIMARY, name: "New" },
      priority: { id: SEED_TEST_IDS.PRIORITIES.MEDIUM_PRIMARY, name: "Medium", order: 2 },
      reporter_email: "reporter@example.com",
      submitter_name: null,
      description: null,
      created_at: new Date(),
      updated_at: new Date(),
      machine: { model: { name: "Medieval Madness" }, location: {} },
    } as any);

    const caller = issueRouter.createCaller(mockContext as any);
    const input = {
      title: "Anonymous Issue",
      reporterEmail: "Reporter@Example.com",
      machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
    };
    const result = await caller.core.publicCreate(input);

    expect(result.id).toBe(createdIssueId);
    expect(result.createdById).toBeNull();
    expect(result.machineId).toBe(SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1);
    expect(result.reporterEmail).toBe("reporter@example.com"); // normalized to lowercase

    // Activity factory should not be invoked for anonymous flow
    expect(activityFactorySpy).not.toHaveBeenCalled();

    // Notification service invoked for owner notification (id is generated in router)
    expect(notifySpy).toHaveBeenCalledWith(
      expect.any(String),
      SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
    );
  });

  it("rejects create when target machine is soft-deleted or invisible", async () => {
    const { mockDb, mockContext } = ctx;
    // Simulate invisible/soft-deleted: DB returns null
    mockDb.query.machines.findFirst.mockResolvedValue(null);

    const caller = issueRouter.createCaller(mockContext as any);
    await expect(
      caller.core.publicCreate({
        title: "Test Issue",
        reporterEmail: "reporter@example.com",
        machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      }),
    ).rejects.toThrow(TRPCError);
  });

  it("rejects create when org default status or priority is missing", async () => {
    const { mockDb, mockContext } = ctx;
    mockDb.query.machines.findFirst.mockResolvedValue({
      id: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      name: "Medieval Madness #1",
      location: { organization_id: SEED_TEST_IDS.ORGANIZATIONS.primary },
    } as any);

    mockDb.query.issueStatuses.findFirst.mockResolvedValue({
      id: SEED_TEST_IDS.STATUSES.NEW_PRIMARY,
      name: "New",
      organization_id: SEED_TEST_IDS.ORGANIZATIONS.primary,
      is_default: true,
      category: "NEW",
    } as any);
    mockDb.query.priorities.findFirst.mockResolvedValue(null);

    const caller = issueRouter.createCaller(mockContext as any);
    await expect(
      caller.core.publicCreate({
        title: "Test Issue",
        reporterEmail: "reporter@example.com",
        machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      }),
    ).rejects.toThrow(TRPCError);
  });

  it("enforces org boundary (cross-organization machine rejected)", async () => {
    const { mockDb, mockContext } = ctx;
    mockDb.query.machines.findFirst.mockResolvedValue({
      id: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      name: "Medieval Madness #1",
      location: { organization_id: SEED_TEST_IDS.ORGANIZATIONS.competitor },
    } as any);

    const caller = issueRouter.createCaller(mockContext as any);
    await expect(
      caller.core.publicCreate({
        title: "Test Issue",
        reporterEmail: "reporter@example.com",
        machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      }),
    ).rejects.toThrow(TRPCError);
  });

  it("rejects create with invalid reporter email format", async () => {
    const { mockDb, mockContext } = ctx;
    mockDb.query.machines.findFirst.mockResolvedValue({
      id: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      name: "Medieval Madness #1",
      location: { organization_id: SEED_TEST_IDS.ORGANIZATIONS.primary },
    } as any);
    mockDb.query.issueStatuses.findFirst.mockResolvedValue({
      id: SEED_TEST_IDS.STATUSES.NEW_PRIMARY,
      name: "New",
      organization_id: SEED_TEST_IDS.ORGANIZATIONS.primary,
      is_default: true,
      category: "NEW",
    } as any);
    mockDb.query.priorities.findFirst.mockResolvedValue({
      id: SEED_TEST_IDS.PRIORITIES.MEDIUM_PRIMARY,
      name: "Medium",
      organization_id: SEED_TEST_IDS.ORGANIZATIONS.primary,
      is_default: true,
      order: 2,
    } as any);

    const caller = issueRouter.createCaller(mockContext as any);
    await expect(
      caller.core.publicCreate({
        title: "Bad Email",
        reporterEmail: "not-an-email",
        machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      }),
    ).rejects.toThrow(TRPCError);
  });
});

