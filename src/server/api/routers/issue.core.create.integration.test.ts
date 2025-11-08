/**
 * Issue Core Router – create (Integration)
 *
 * Validates the member create mutation end-to-end.
 * - Verifies middleware (organization + issue:create permission) wiring
 * - Ensures successful inserts trigger activity + notification services
 * - Guards against missing resources (machine/defaults) and invalid payloads
 * - Confirms permission denials bubble up without touching the database
 *
 * Tests only touch router files to keep parallel work (actions/public routes) isolated.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

import type { SupabaseServerClient } from "~/lib/supabase/server";
import type { PinPointSupabaseUser } from "~/lib/types";
import type { LoggerInterface } from "~/lib/logger";
import { issueRouter } from "~/server/api/routers/issue";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";

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

type MachineRecord = {
  id: string;
  name: string;
  location: {
    id: string;
    name: string;
    organization_id: string;
  };
};

type IssueStatusRecord = {
  id: string;
  name: string;
  organization_id: string;
  is_default: boolean;
  category: string;
};

type PriorityRecord = {
  id: string;
  name: string;
  organization_id: string;
  is_default: boolean;
};

type IssueWithRelationsRecord = {
  id: string;
  title: string;
  description: string | null;
  created_by_id: string;
  organization_id: string;
  machine_id: string;
  status_id: string;
  priority_id: string;
  status: { id: string; name: string };
  createdBy: {
    id: string;
    name: string;
    email: string;
    image: string | null;
  };
  machine: {
    id: string;
    name: string;
    model: { id: string; name: string } | null;
    location: {
      id: string;
      name: string;
      organization_id: string;
    };
  };
};

type MembershipRecord = {
  id: string;
  organization_id: string;
  user_id: string;
  role_id: string;
  role: {
    id: string;
    name: string;
    rolePermissions: Array<{
      permission: { id: string; name: string };
    }>;
  };
};

const buildMachineRecord = (organizationId: string): MachineRecord => ({
  id: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
  name: "Medieval Madness",
  location: {
    id: SEED_TEST_IDS.LOCATIONS.PRIMARY,
    name: "PinPoint HQ",
    organization_id: organizationId,
  },
});

const buildStatusRecord = (organizationId: string): IssueStatusRecord => ({
  id: SEED_TEST_IDS.STATUSES.NEW_PRIMARY,
  name: "New",
  organization_id: organizationId,
  is_default: true,
  category: "new",
});

const buildPriorityRecord = (organizationId: string): PriorityRecord => ({
  id: SEED_TEST_IDS.PRIORITIES.MEDIUM_PRIMARY,
  name: "Medium",
  organization_id: organizationId,
  is_default: true,
});

const buildIssueWithRelationsRecord = ({
  organizationId,
  machine,
  status,
  priority,
}: {
  organizationId: string;
  machine: MachineRecord;
  status: IssueStatusRecord;
  priority: PriorityRecord;
}): IssueWithRelationsRecord => ({
  id: "issue-test-123",
  title: "Flipper misfires intermittently",
  description: null,
  created_by_id: SEED_TEST_IDS.USERS.ADMIN,
  organization_id: organizationId,
  machine_id: machine.id,
  status_id: status.id,
  priority_id: priority.id,
  status: { id: status.id, name: status.name },
  createdBy: {
    id: SEED_TEST_IDS.USERS.ADMIN,
    name: SEED_TEST_IDS.NAMES.ADMIN,
    email: SEED_TEST_IDS.EMAILS.ADMIN,
    image: null,
  },
  machine: {
    id: machine.id,
    name: machine.name,
    model: null,
    location: machine.location,
  },
});

const buildMembershipRecord = (organizationId: string): MembershipRecord => ({
  id: SEED_TEST_IDS.MEMBERSHIPS.ADMIN_PRIMARY,
  organization_id: organizationId,
  user_id: SEED_TEST_IDS.USERS.ADMIN,
  role_id: SEED_TEST_IDS.ROLES.ADMIN_PRIMARY,
  role: {
    id: SEED_TEST_IDS.ROLES.ADMIN_PRIMARY,
    name: "Admin",
    rolePermissions: [
      {
        permission: {
          id: "perm-issue-create",
          name: "issue:create",
        },
      },
    ],
  },
});

const buildSupabaseUser = (): PinPointSupabaseUser =>
  ({
    id: SEED_TEST_IDS.USERS.ADMIN,
    email: SEED_TEST_IDS.EMAILS.ADMIN,
    app_metadata: {
      organizationId: SEED_TEST_IDS.ORGANIZATIONS.primary,
    },
    user_metadata: {
      name: SEED_TEST_IDS.NAMES.ADMIN,
    },
  }) as unknown as PinPointSupabaseUser;

const createLoggerStub = (): LoggerInterface =>
  ({
    child: () => createLoggerStub(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }) as unknown as LoggerInterface;

const createHeadersStub = (): Headers =>
  ({
    get: () => null,
    set: () => {},
    append: () => {},
    delete: () => {},
    has: () => false,
    entries: () => [][Symbol.iterator](),
    keys: () => [][Symbol.iterator](),
    values: () => [][Symbol.iterator](),
    forEach: () => {},
  }) as unknown as Headers;

const createMockDb = () => {
  const machinesFindFirst = vi.fn();
  const issueStatusesFindFirst = vi.fn();
  const prioritiesFindFirst = vi.fn();
  const issuesFindFirst = vi.fn();
  const membershipsFindFirst = vi.fn();

  const query = {
    machines: { findFirst: machinesFindFirst },
    issueStatuses: { findFirst: issueStatusesFindFirst },
    priorities: { findFirst: prioritiesFindFirst },
    issues: { findFirst: issuesFindFirst },
    memberships: { findFirst: membershipsFindFirst },
  };

  const insertValuesMock = vi.fn().mockResolvedValue(undefined);
  const insertMock = vi.fn().mockReturnValue({
    values: insertValuesMock,
  });

  const tx = {
    execute: vi.fn().mockResolvedValue(undefined),
    query,
    insert: insertMock,
  };

  const db = {
    execute: vi.fn().mockResolvedValue(undefined),
    query,
    insert: insertMock,
    transaction: vi.fn(async (callback: (tx: typeof tx) => Promise<unknown>) =>
      callback(tx),
    ),
  };

  return {
    db,
    queryMocks: {
      machinesFindFirst,
      issueStatusesFindFirst,
      prioritiesFindFirst,
      issuesFindFirst,
      membershipsFindFirst,
    },
    insertValuesMock,
  };
};

const createServiceFactoryStub = ({
  recordIssueCreated,
  notifyMachineOwner,
}: {
  recordIssueCreated: ReturnType<typeof vi.fn>;
  notifyMachineOwner: ReturnType<typeof vi.fn>;
}) => {
  const services = {
    createIssueActivityService: () => ({
      recordIssueCreated,
    }),
    createNotificationService: () => ({
      notifyMachineOwnerOfIssue: notifyMachineOwner,
    }),
    withOrganization: () => services,
  };

  return services;
};

const createTestHarness = () => {
  const organizationId = SEED_TEST_IDS.ORGANIZATIONS.primary;
  const dbMocks = createMockDb();
  const machineRecord = buildMachineRecord(organizationId);
  const statusRecord = buildStatusRecord(organizationId);
  const priorityRecord = buildPriorityRecord(organizationId);
  const issueRecord = buildIssueWithRelationsRecord({
    organizationId,
    machine: machineRecord,
    status: statusRecord,
    priority: priorityRecord,
  });

  dbMocks.queryMocks.machinesFindFirst.mockResolvedValue(machineRecord);
  dbMocks.queryMocks.issueStatusesFindFirst.mockResolvedValue(statusRecord);
  dbMocks.queryMocks.prioritiesFindFirst.mockResolvedValue(priorityRecord);
  dbMocks.queryMocks.issuesFindFirst.mockResolvedValue(issueRecord);
  dbMocks.queryMocks.membershipsFindFirst.mockResolvedValue(
    buildMembershipRecord(organizationId),
  );

  const recordIssueCreated = vi.fn().mockResolvedValue(undefined);
  const notifyMachineOwner = vi.fn().mockResolvedValue(undefined);
  const services = createServiceFactoryStub({
    recordIssueCreated,
    notifyMachineOwner,
  });

  const context = {
    db: dbMocks.db,
    supabase: {} as SupabaseServerClient,
    user: buildSupabaseUser(),
    organizationId,
    organization: {
      id: organizationId,
      name: "Test Organization",
      subdomain: "test-org",
    },
    services: services as never,
    headers: createHeadersStub(),
    logger: createLoggerStub(),
  };

  const caller = issueRouter.createCaller(context as never);

  return {
    caller,
    dbMocks,
    recordIssueCreated,
    notifyMachineOwner,
  };
};

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
    const harness = createTestHarness();

    const result = await harness.caller.core.create({
      title: "Flipper misfires intermittently",
      description: "Player reports the left flipper drops mid-game.",
      machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
    });

    expect(result.id).toBe("issue-test-123");
    expect(result.createdById).toBe(SEED_TEST_IDS.USERS.ADMIN);
    expect(harness.recordIssueCreated).toHaveBeenCalledWith(
      "issue-test-123",
      SEED_TEST_IDS.USERS.ADMIN,
    );
    expect(harness.notifyMachineOwner).toHaveBeenCalledWith(
      "issue-test-123",
      SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
    );
    expect(harness.dbMocks.insertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        created_by_id: SEED_TEST_IDS.USERS.ADMIN,
        organization_id: SEED_TEST_IDS.ORGANIZATIONS.primary,
        machine_id: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
        status_id: SEED_TEST_IDS.STATUSES.NEW_PRIMARY,
        priority_id: SEED_TEST_IDS.PRIORITIES.MEDIUM_PRIMARY,
      }),
    );
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
    const harness = createTestHarness();
    harness.dbMocks.queryMocks.machinesFindFirst.mockResolvedValueOnce(null);

    await expect(
      harness.caller.core.create({
        title: "Cabinet loose wires",
        machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      }),
    ).rejects.toMatchObject({
      message: "Machine not found or does not belong to this organization",
    });
    expect(harness.dbMocks.insertValuesMock).not.toHaveBeenCalled();
    expect(harness.recordIssueCreated).not.toHaveBeenCalled();
  });

  it("rejects creation when the default status is missing", async () => {
    const harness = createTestHarness();
    harness.dbMocks.queryMocks.issueStatusesFindFirst.mockResolvedValueOnce(
      null,
    );

    await expect(
      harness.caller.core.create({
        title: "No GI lighting",
        machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      }),
    ).rejects.toMatchObject({
      message:
        "Default issue status not found. Please contact an administrator.",
    });
    expect(harness.dbMocks.insertValuesMock).not.toHaveBeenCalled();
  });

  it("rejects creation when the default priority is missing", async () => {
    const harness = createTestHarness();
    harness.dbMocks.queryMocks.prioritiesFindFirst.mockResolvedValueOnce(null);

    await expect(
      harness.caller.core.create({
        title: "Shooter lane jam",
        machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      }),
    ).rejects.toMatchObject({
      message:
        "Default priority not found. Please contact an administrator.",
    });
    expect(harness.dbMocks.insertValuesMock).not.toHaveBeenCalled();
  });

  it("enforces title validation (blank titles are rejected)", async () => {
    const harness = createTestHarness();

    await expect(
      harness.caller.core.create({
        title: "   \n\t  ",
        machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      }),
    ).rejects.toMatchObject({
      message: "Issue title cannot be empty",
    });
    expect(harness.dbMocks.insertValuesMock).not.toHaveBeenCalled();
  });

  it("propagates permission failures from the issue:create guard", async () => {
    const harness = createTestHarness();
    requirePermissionForSessionMock.mockRejectedValueOnce(
      new TRPCError({
        code: "FORBIDDEN",
        message: "issue:create denied",
      }),
    );

    await expect(
      harness.caller.core.create({
        title: "Test Issue",
        machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "issue:create denied",
    });
    expect(harness.dbMocks.insertValuesMock).not.toHaveBeenCalled();
    expect(harness.recordIssueCreated).not.toHaveBeenCalled();
  });
});
