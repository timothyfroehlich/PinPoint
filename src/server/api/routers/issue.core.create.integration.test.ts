/**
 * Issue Core Router – create (Integration) – Test Skeleton
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

describe("issue.core.create (integration)", () => {
  let mockContext: Awaited<ReturnType<typeof createInnerTRPCContext>>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup authenticated context
    mockContext = {
      session: {
        user: {
          id: SEED_TEST_IDS.USERS.ADMIN,
          email: SEED_TEST_IDS.EMAILS.ADMIN,
        },
      },
      organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
      userId: SEED_TEST_IDS.USERS.ADMIN,
    } as any;
  });

  it("creates member issue with defaults, activity recorded, and notification sent", async () => {
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
      title: "Test Issue",
      createdById: SEED_TEST_IDS.USERS.ADMIN,
      machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
      statusId: SEED_TEST_IDS.STATUSES.NEW_PRIMARY,
      priorityId: SEED_TEST_IDS.PRIORITIES.MEDIUM_PRIMARY,
    };

    (db.insert as any)().values().returning.mockResolvedValue([createdIssue]);

    const caller = issueRouter.createCaller(mockContext);

    const result = await caller.core.create({
      title: "Test Issue",
      description: "Test description",
      machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
    });

    expect(result.id).toBe(SEED_TEST_IDS.ISSUES.KAIJU_FIGURES);
    expect(result.createdById).toBe(SEED_TEST_IDS.USERS.ADMIN);
    expect(recordIssueCreated).toHaveBeenCalledWith(
      expect.objectContaining({
        issueId: SEED_TEST_IDS.ISSUES.KAIJU_FIGURES,
        userId: SEED_TEST_IDS.USERS.ADMIN,
      }),
    );
    expect(notifyMachineOwner).toHaveBeenCalledWith(
      expect.objectContaining({
        issueId: SEED_TEST_IDS.ISSUES.KAIJU_FIGURES,
        machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      }),
    );
  });

  it("rejects create when target machine is soft-deleted", async () => {
    const { db } = await import("~/server/db");

    // Mock machine as not found (soft-deleted machines won't be returned)
    (db.query.machines.findFirst as any).mockResolvedValue(null);

    const caller = issueRouter.createCaller(mockContext);

    await expect(
      caller.core.create({
        title: "Test Issue",
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

    // Mock missing default status
    (db.query.issueStatuses.findFirst as any).mockResolvedValue(null);
    (db.query.issuePriorities.findFirst as any).mockResolvedValue({
      id: SEED_TEST_IDS.PRIORITIES.MEDIUM_PRIMARY,
      name: "Medium",
    });

    const caller = issueRouter.createCaller(mockContext);

    await expect(
      caller.core.create({
        title: "Test Issue",
        machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      }),
    ).rejects.toThrow(TRPCError);
  });

  it("validates required fields and surfaces field errors", async () => {
    const caller = issueRouter.createCaller(mockContext);

    await expect(
      caller.core.create({
        title: "", // Invalid empty title
        machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      }),
    ).rejects.toThrow(TRPCError);

    await expect(
      caller.core.create({
        title: "Valid title",
        machineId: "", // Invalid empty machine ID
      }),
    ).rejects.toThrow(TRPCError);
  });

  it("denies create without appropriate permission (issue:create)", async () => {
    // Mock context without proper permissions
    const unauthorizedContext = {
      ...mockContext,
      session: null, // No session
    } as any;

    const caller = issueRouter.createCaller(unauthorizedContext);

    await expect(
      caller.core.create({
        title: "Test Issue",
        machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      }),
    ).rejects.toThrow(TRPCError);
  });
});
