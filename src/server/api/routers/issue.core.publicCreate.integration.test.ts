/**
 * Issue Core Router – publicCreate (Integration) – Test Skeleton
 *
 * Validates anonymous issue creation: inserts with null createdById, applies
 * defaults, notifies owner, and skips activity logging. Rejects invalid inputs
 * and cross-org requests.
 *
 * Use:
 * - SEED_TEST_IDS for stable identifiers
 * - MockDatabaseFactory/SeedBasedMockFactory for deterministic data and DB client stubs
 * - Anonymous context mocking (null user)
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

const createCaller = createCallerFactory(issueCoreRouter);

const primaryOrgId = SEED_TEST_IDS.ORGANIZATIONS.primary;
const competitorOrgId = "competitor-org";

describe("issue.core.publicCreate (integration)", () => {
  let db, services, mockNotificationService, mockActivityService;

  beforeEach(() => {
    vi.resetAllMocks();
    db = MockDatabaseFactory.createMockDbClient();
    db.transaction = vi.fn(async (callback) => callback(db));
    db.execute = vi.fn();

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

  it("creates anonymous issue with defaults and notifies owner (no activity)", async () => {
    const machine = {
      ...SeedBasedMockFactory.createMockMachine(),
      location: { organization_id: primaryOrgId },
    };
    const defaultStatus = SeedBasedMockFactory.createMockIssueStatus({
      organizationId: primaryOrgId,
      isDefault: true,
    });
    const defaultPriority = SeedBasedMockFactory.createMockPriority({
      organizationId: primaryOrgId,
      isDefault: true,
    });

    db.query.machines.findFirst.mockResolvedValue(machine);
    db.query.issueStatuses.findFirst.mockResolvedValue(defaultStatus);
    db.query.priorities.findFirst.mockResolvedValue(defaultPriority);

    const createdIssue = SeedBasedMockFactory.createMockIssue({
      createdById: null,
      statusId: defaultStatus.id,
      priorityId: defaultPriority.id,
    });

    db.insert.mockReturnValue({
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([createdIssue]),
    });

    const caller = createCaller({
      db,
      services,
      organizationId: primaryOrgId,
      organization: { id: primaryOrgId, name: "Test Org", subdomain: "test" },
      user: null, // Anonymous user
    });

    const input = {
      title: "Anonymous Issue",
      machineId: machine.id,
      organizationId: primaryOrgId,
      reporterEmail: "anon@test.com",
    };

    const result = await caller.publicCreate(input);

    expect(result.createdById).toEqual(expect.any(String));
    expect(result.priorityId).toBe("priority-low");
    expect(
      mockNotificationService.notifyMachineOwnerOfIssue,
    ).toHaveBeenCalled();
    expect(mockActivityService.recordIssueCreated).not.toHaveBeenCalled();
  });

  it("skips activity recording due to no actor", async () => {
    const machine = {
      ...SeedBasedMockFactory.createMockMachine(),
      location: { organization_id: primaryOrgId },
    };
    const defaultStatus = SeedBasedMockFactory.createMockIssueStatus({
      organizationId: primaryOrgId,
      isDefault: true,
    });
    const defaultPriority = SeedBasedMockFactory.createMockPriority({
      organizationId: primaryOrgId,
      isDefault: true,
    });

    db.query.machines.findFirst.mockResolvedValue(machine);
    db.query.issueStatuses.findFirst.mockResolvedValue(defaultStatus);
    db.query.priorities.findFirst.mockResolvedValue(defaultPriority);
    db.insert.mockReturnValue({
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([{}]),
    });

    const caller = createCaller({
      db,
      services,
      organizationId: primaryOrgId,
      organization: { id: primaryOrgId, name: "Test Org", subdomain: "test" },
      user: null,
    });

    await caller.publicCreate({
      title: "Test",
      machineId: machine.id,
      organizationId: primaryOrgId,
      reporterEmail: "anon@test.com",
    });

    expect(mockActivityService.recordIssueCreated).not.toHaveBeenCalled();
  });

  it("rejects create when target machine is soft-deleted", async () => {
    db.query.machines.findFirst.mockResolvedValue(null);

    const caller = createCaller({
      db,
      services,
      organizationId: primaryOrgId,
      organization: { id: primaryOrgId, name: "Test Org", subdomain: "test" },
      user: null,
    });

    const input = {
      title: "Test",
      machineId: "any-machine",
      organizationId: primaryOrgId,
      reporterEmail: "anon@test.com",
    };

    await expect(caller.publicCreate(input)).rejects.toThrow(
      "Machine not found",
    );
  });

  it("rejects create when org default status/priority is missing", async () => {
    const machine = {
      ...SeedBasedMockFactory.createMockMachine(),
      location: { organization_id: primaryOrgId },
    };
    db.query.machines.findFirst.mockResolvedValue(machine);
    db.query.issueStatuses.findFirst.mockResolvedValue(null);

    const caller = createCaller({
      db,
      services,
      organizationId: primaryOrgId,
      organization: { id: primaryOrgId, name: "Test Org", subdomain: "test" },
      user: null,
    });

    const input = {
      title: "Test",
      machineId: machine.id,
      organizationId: primaryOrgId,
      reporterEmail: "anon@test.com",
    };

    await expect(caller.publicCreate(input)).rejects.toThrow(
      "Default issue status not found. Please contact an administrator.",
    );
  });

  it("enforces org boundary (cross-organization machine rejected)", async () => {
    const machine = {
      ...SeedBasedMockFactory.createMockMachine(),
      location: { organization_id: competitorOrgId }, // from another org
    };
    db.query.machines.findFirst.mockResolvedValue(machine);

    const caller = createCaller({
      db,
      services,
      organizationId: primaryOrgId,
      organization: { id: primaryOrgId, name: "Test Org", subdomain: "test" },
      user: null,
    });

    const input = {
      title: "Test",
      machineId: machine.id,
      organizationId: primaryOrgId,
      reporterEmail: "anon@test.com",
    };

    await expect(caller.publicCreate(input)).rejects.toThrow(
      "Machine not found or does not belong to this organization",
    );
  });
});
