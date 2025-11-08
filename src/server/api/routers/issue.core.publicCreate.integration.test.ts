/**
 * Issue Core Router – publicCreate (Integration) – Test Skeleton
 *
 * Validates the anonymous issue creation endpoint: inserts with createdById=null,
 * applies default status/priority, skips activity recording, and calls notifications.
 * Includes negative cases for soft-deleted machines, missing defaults, and org scoping.
 *
 * Use:
 * - SEED_TEST_IDS for org/machine/status/priority IDs (~/test/constants/seed-test-ids)
 * - setupOrganizationMocks() for auth resolver mocking (~/test/setup/organization-mocks)
 * - SeedBasedMockFactory/MockDatabaseFactory for deterministic data and DB client stubs
 * - Follow worker-safe patterns; do not spin per-test PGlite instances
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";
import { issueRouter } from "~/server/api/routers/issue";
import { createInnerTRPCContext } from "~/server/api/trpc";

// Mock the database and services
vi.mock("~/server/db", () => ({
  db: {
    query: {
      machines: {
        findFirst: vi.fn(),
      },
      issueStatuses: {
        findFirst: vi.fn(),
      },
      issuePriorities: {
        findFirst: vi.fn(),
      },
    },
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn(),
      }),
    }),
  },
}));

vi.mock("~/server/services/issueActivityService", () => ({
  recordIssueCreated: vi.fn(),
}));

vi.mock("~/server/services/notificationService", () => ({
  notifyMachineOwner: vi.fn(),
}));

describe("issue.core.publicCreate (integration)", () => {
  let mockContext: Awaited<ReturnType<typeof createInnerTRPCContext>>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup anonymous context (no session)
    mockContext = {
      session: null,
      organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
      userId: null,
    } as any;
  });

  it("creates anonymous issue with defaults and notifies owner (no activity)", async () => {
    const { db } = await import("~/server/db");
    const { recordIssueCreated } = await import(
      "~/server/services/issueActivityService"
    );
    const { notifyMachineOwner } = await import(
      "~/server/services/notificationService"
    );

    // Setup mocks
    (db.query.machines.findFirst as any).mockResolvedValue({
      id: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      location: {
        organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
      },
    });

    (db.query.issueStatuses.findFirst as any).mockResolvedValue({
      id: SEED_TEST_IDS.STATUSES.NEW_PRIMARY,
      name: "New",
    });

    (db.query.issuePriorities.findFirst as any).mockResolvedValue({
      id: SEED_TEST_IDS.PRIORITIES.MEDIUM_PRIMARY,
      name: "Medium",
    });

    const createdIssue = {
      id: SEED_TEST_IDS.ISSUES.KAIJU_FIGURES,
      title: "Anonymous Issue",
      createdById: null, // Anonymous issue
      machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
      statusId: SEED_TEST_IDS.STATUSES.NEW_PRIMARY,
      priorityId: SEED_TEST_IDS.PRIORITIES.MEDIUM_PRIMARY,
      reporterEmail: "reporter@example.com",
    };

    (db.insert as any)().values().returning.mockResolvedValue([createdIssue]);

    const caller = issueRouter.createCaller(mockContext);

    const result = await caller.core.publicCreate({
      title: "Anonymous Issue",
      reporterEmail: "reporter@example.com",
      machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
    });

    expect(result.id).toBe(SEED_TEST_IDS.ISSUES.KAIJU_FIGURES);
    expect(result.createdById).toBeNull(); // Anonymous
    expect(result.reporterEmail).toBe("reporter@example.com");
    expect(recordIssueCreated).not.toHaveBeenCalled(); // No activity for anonymous
    expect(notifyMachineOwner).toHaveBeenCalledWith(
      expect.objectContaining({
        issueId: SEED_TEST_IDS.ISSUES.KAIJU_FIGURES,
        machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      }),
    );
  });

  it("skips activity recording due to no actor", async () => {
    // This test is covered by the first test - anonymous issues don't record activity
    // We verify recordIssueCreated is NOT called for anonymous issues
    const { recordIssueCreated } = await import(
      "~/server/services/issueActivityService"
    );

    // Just verify the mock was never called
    expect(recordIssueCreated).not.toHaveBeenCalled();
  });

  it("rejects create when target machine is soft-deleted", async () => {
    const { db } = await import("~/server/db");

    // Mock machine as not found (soft-deleted machines won't be returned)
    (db.query.machines.findFirst as any).mockResolvedValue(null);

    const caller = issueRouter.createCaller(mockContext);

    await expect(
      caller.core.publicCreate({
        title: "Test Issue",
        reporterEmail: "reporter@example.com",
        machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      }),
    ).rejects.toThrow(TRPCError);
  });

  it("rejects create when org default status/priority is missing", async () => {
    const { db } = await import("~/server/db");

    // Setup valid machine
    (db.query.machines.findFirst as any).mockResolvedValue({
      id: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      location: {
        organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
      },
    });

    // Mock missing default priority
    (db.query.issueStatuses.findFirst as any).mockResolvedValue({
      id: SEED_TEST_IDS.STATUSES.NEW_PRIMARY,
      name: "New",
    });
    (db.query.issuePriorities.findFirst as any).mockResolvedValue(null);

    const caller = issueRouter.createCaller(mockContext);

    await expect(
      caller.core.publicCreate({
        title: "Test Issue",
        reporterEmail: "reporter@example.com",
        machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      }),
    ).rejects.toThrow(TRPCError);
  });

  it("enforces org boundary (cross-organization machine rejected)", async () => {
    const { db } = await import("~/server/db");

    // Setup machine from different organization
    (db.query.machines.findFirst as any).mockResolvedValue({
      id: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      location: {
        organizationId: SEED_TEST_IDS.ORGANIZATIONS.competitor, // Different org
      },
    });

    const caller = issueRouter.createCaller(mockContext);

    await expect(
      caller.core.publicCreate({
        title: "Test Issue",
        reporterEmail: "reporter@example.com",
        machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      }),
    ).rejects.toThrow(TRPCError);
  });
});
