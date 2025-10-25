/**
 * Issue Actions – createIssueAction (integration)
 *
 * Validates the server action wiring end-to-end (auth resolution, permission
 * checks, default resource lookups, cache revalidation, and background
 * notifications). Each scenario mirrors the acceptance criteria outlined in the
 * issue creation feature spec.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { PERMISSIONS } from "~/server/auth/permissions.constants";
import { SEED_TEST_IDS } from "~/test/constants/seed-test-ids";
import { createIssueAction } from "~/lib/actions/issue-actions";

const {
  revalidatePathMock,
  revalidateTagMock,
  runAfterResponseMock,
  requirePermissionMock,
  issueStatusesFindFirstMock,
  prioritiesFindFirstMock,
  insertMock,
  insertValuesMock,
  generatePrefixedIdMock,
  transformKeysToSnakeCaseMock,
  getRequestAuthContextMock,
  generateIssueCreationNotificationsMock,
} = vi.hoisted(() => {
  const revalidatePathMock = vi.fn();
  const revalidateTagMock = vi.fn();
  const runAfterResponseMock = vi.fn();
  const requirePermissionMock = vi.fn();
  const issueStatusesFindFirstMock = vi.fn();
  const prioritiesFindFirstMock = vi.fn();
  const insertValuesMock = vi.fn();
  const insertMock = vi.fn();
  const generatePrefixedIdMock = vi.fn();
  const transformKeysToSnakeCaseMock = vi.fn();
  const getRequestAuthContextMock = vi.fn();
  const generateIssueCreationNotificationsMock = vi.fn();

  return {
    revalidatePathMock,
    revalidateTagMock,
    runAfterResponseMock,
    requirePermissionMock,
    issueStatusesFindFirstMock,
    prioritiesFindFirstMock,
    insertMock,
    insertValuesMock,
    generatePrefixedIdMock,
    transformKeysToSnakeCaseMock,
    getRequestAuthContextMock,
    generateIssueCreationNotificationsMock,
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
  revalidateTag: revalidateTagMock,
}));

vi.mock("~/lib/actions/shared", async () => {
  const actual = await vi.importActual<typeof import("~/lib/actions/shared")>(
    "~/lib/actions/shared",
  );
  return {
    ...actual,
    requirePermission: requirePermissionMock,
    runAfterResponse: runAfterResponseMock,
  };
});

vi.mock("~/lib/dal/shared", () => ({
  db: {
    query: {
      issueStatuses: {
        findFirst: issueStatusesFindFirstMock,
      },
      priorities: {
        findFirst: prioritiesFindFirstMock,
      },
    },
    insert: insertMock,
  },
}));

vi.mock("~/lib/utils/id-generation", () => ({
  generatePrefixedId: generatePrefixedIdMock,
}));

vi.mock("~/lib/utils/case-transformers", () => ({
  transformKeysToSnakeCase: transformKeysToSnakeCaseMock,
}));

vi.mock("~/lib/services/notification-generator", () => ({
  generateIssueCreationNotifications: generateIssueCreationNotificationsMock,
  generateStatusChangeNotifications: vi.fn(),
  generateAssignmentNotifications: vi.fn(),
}));

vi.mock("~/server/auth/context", () => ({
  getRequestAuthContext: getRequestAuthContextMock,
}));

const buildStatusRecord = (organizationId: string) => ({
  id: SEED_TEST_IDS.STATUSES.NEW_PRIMARY,
  organization_id: organizationId,
  is_default: true,
});

const buildPriorityRecord = (organizationId: string) => ({
  id: SEED_TEST_IDS.PRIORITIES.MEDIUM_PRIMARY,
  organization_id: organizationId,
  is_default: true,
});

const buildAuthContext = (organizationId: string) => ({
  kind: "authorized" as const,
  user: {
    id: SEED_TEST_IDS.USERS.ADMIN,
    email: SEED_TEST_IDS.EMAILS.ADMIN,
    name: SEED_TEST_IDS.NAMES.ADMIN,
  },
  org: {
    id: organizationId,
    name: "Test Org",
    subdomain: organizationId,
  },
  membership: {
    id: SEED_TEST_IDS.MEMBERSHIPS.ADMIN_PRIMARY,
    role: {
      id: SEED_TEST_IDS.ROLES.ADMIN_PRIMARY,
      name: "Admin",
    },
    userId: SEED_TEST_IDS.USERS.ADMIN,
    organizationId,
  },
});

const uniqueOrgId = (suffix: string) =>
  `${SEED_TEST_IDS.ORGANIZATIONS.primary}-${suffix}`.replace(/[^a-z0-9-]/gi, "-");

const flushMicrotasks = async () => {
  await Promise.resolve();
};

describe("createIssueAction (integration)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    insertValuesMock.mockReset();
    insertMock.mockReset();
    issueStatusesFindFirstMock.mockReset();
    prioritiesFindFirstMock.mockReset();
    runAfterResponseMock.mockReset();
    requirePermissionMock.mockReset();
    generatePrefixedIdMock.mockReset();
    transformKeysToSnakeCaseMock.mockReset();
    getRequestAuthContextMock.mockReset();
    generateIssueCreationNotificationsMock.mockReset();
    revalidatePathMock.mockReset();
    revalidateTagMock.mockReset();

    insertValuesMock.mockResolvedValue(undefined);
    insertMock.mockImplementation(() => ({ values: insertValuesMock }));
    runAfterResponseMock.mockImplementation((task: () => Promise<void>) => {
      void task();
    });
    requirePermissionMock.mockResolvedValue(undefined);
    generatePrefixedIdMock.mockReturnValue("issue-test-123");
    transformKeysToSnakeCaseMock.mockImplementation((input) => input);
    generateIssueCreationNotificationsMock.mockResolvedValue(undefined);
  });

  it("surfaces field errors when required values are missing", async () => {
    const organizationId = uniqueOrgId("missing-required");
    getRequestAuthContextMock.mockResolvedValue(buildAuthContext(organizationId));

    const formData = new FormData();

    const result = await createIssueAction(null, formData);

    expect(result.success).toBe(false);
  expect(result.fieldErrors?.title?.[0]).toMatch(/required|title|expected string/i);
  expect(result.fieldErrors?.machineId?.[0]).toMatch(/required|machine|expected string/i);
    expect(requirePermissionMock).not.toHaveBeenCalled();
  });

  it("treats whitespace-only titles as invalid input", async () => {
    const organizationId = uniqueOrgId("whitespace");
    getRequestAuthContextMock.mockResolvedValue(buildAuthContext(organizationId));
    issueStatusesFindFirstMock.mockResolvedValueOnce(buildStatusRecord(organizationId));
    prioritiesFindFirstMock.mockResolvedValueOnce(buildPriorityRecord(organizationId));

    const formData = new FormData();
    formData.append("title", "   \n\t  ");
    formData.append("machineId", SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1);

    const result = await createIssueAction(null, formData);

    expect(result.success).toBe(false);
    expect(result.fieldErrors?.title?.[0]).toMatch(/title/i);
  });

  it("creates an issue, revalidates caches, and schedules notifications", async () => {
    const organizationId = uniqueOrgId("success");
    getRequestAuthContextMock.mockResolvedValue(buildAuthContext(organizationId));
    issueStatusesFindFirstMock.mockResolvedValueOnce(buildStatusRecord(organizationId));
    prioritiesFindFirstMock.mockResolvedValueOnce(buildPriorityRecord(organizationId));

    const formData = new FormData();
    formData.append("title", "Flipper misfires intermittently");
    formData.append("description", "Player reports left flipper drops mid-game.");
    formData.append("machineId", SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1);

    const result = await createIssueAction(null, formData);

    expect(result.success).toBe(true);
    expect(result.data.id).toBe("issue-test-123");
    expect(requirePermissionMock).toHaveBeenCalledTimes(1);
    expect(requirePermissionMock).toHaveBeenCalledWith(
      { role_id: SEED_TEST_IDS.ROLES.ADMIN_PRIMARY },
      PERMISSIONS.ISSUE_CREATE_FULL,
      expect.any(Object),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/issues");
    expect(revalidatePathMock).toHaveBeenCalledWith(`/issues/${result.data.id}`);
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard");
    expect(revalidateTagMock).toHaveBeenCalledWith("issues");
    expect(transformKeysToSnakeCaseMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Flipper misfires intermittently",
        organizationId,
        machineId: SEED_TEST_IDS.MACHINES.MEDIEVAL_MADNESS_1,
      }),
    );
    expect(insertValuesMock).toHaveBeenCalled();

    await flushMicrotasks();
    expect(generateIssueCreationNotificationsMock).toHaveBeenCalledWith(
      "issue-test-123",
      expect.objectContaining({
        organizationId,
        actorId: SEED_TEST_IDS.USERS.ADMIN,
      }),
    );
  });

  it("drops assignee data when only basic creation permission is granted", async () => {
    const organizationId = uniqueOrgId("basic-permission");
    const authContext = buildAuthContext(organizationId);
    authContext.membership.role = {
      id: SEED_TEST_IDS.ROLES.MEMBER_PRIMARY,
      name: "Member",
    };
    getRequestAuthContextMock.mockResolvedValue(authContext);

    requirePermissionMock
      .mockRejectedValueOnce(new Error("full access denied"))
      .mockResolvedValueOnce(undefined);

    issueStatusesFindFirstMock.mockResolvedValueOnce(buildStatusRecord(organizationId));
    prioritiesFindFirstMock.mockResolvedValueOnce(buildPriorityRecord(organizationId));

    const formData = new FormData();
    formData.append("title", "Drop target bank failure");
    formData.append("machineId", SEED_TEST_IDS.MACHINES.CACTUS_CANYON_1);
    formData.append("assigneeId", SEED_TEST_IDS.USERS.MEMBER1);

    const result = await createIssueAction(null, formData);

    expect(result.success).toBe(true);
    const insertedPayload = transformKeysToSnakeCaseMock.mock.calls[0]?.[0];
    expect(insertedPayload?.assigneeId).toBeNull();
    expect(requirePermissionMock).toHaveBeenCalledTimes(2);
    expect(requirePermissionMock).toHaveBeenLastCalledWith(
      { role_id: SEED_TEST_IDS.ROLES.MEMBER_PRIMARY },
      PERMISSIONS.ISSUE_CREATE_BASIC,
      expect.any(Object),
    );
  });

  it("returns a configuration error when no status is available", async () => {
    const organizationId = uniqueOrgId("missing-status");
    getRequestAuthContextMock.mockResolvedValue(buildAuthContext(organizationId));

    issueStatusesFindFirstMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    prioritiesFindFirstMock.mockResolvedValueOnce(buildPriorityRecord(organizationId));

    const formData = new FormData();
    formData.append("title", "Score display flickers");
    formData.append("machineId", SEED_TEST_IDS.MACHINES.ULTRAMAN_KAIJU);

    const result = await createIssueAction(null, formData);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no issue statuses configured/i);
    expect(insertValuesMock).not.toHaveBeenCalled();
  });
});
