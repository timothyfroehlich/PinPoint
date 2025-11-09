import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Mock } from "vitest";

vi.mock("server-only", () => ({}));

interface UpdateCall {
  table: unknown;
  values: unknown;
}

function createMockDb() {
  const updateCalls: UpdateCall[] = [];

  const update: Mock = vi.fn((table: unknown) => {
    return {
      set(values: unknown) {
        return {
          where: vi.fn(async () => {
            updateCalls.push({ table, values });
          }),
        };
      },
    };
  });

  const query = {
    issueStatuses: {
      findFirst: vi.fn(),
    },
    priorities: {
      findFirst: vi.fn(),
    },
  };

  const transaction: Mock = vi.fn(
    async (callback: (tx: unknown) => Promise<void>) => {
      await callback({
        update,
        query,
      });
    },
  );

  return {
    update,
    query,
    transaction,
    __reset(): void {
      update.mockClear();
      transaction.mockClear();
      updateCalls.length = 0;
      query.issueStatuses.findFirst.mockReset();
      query.priorities.findFirst.mockReset();
    },
    __getUpdateCalls(): UpdateCall[] {
      return updateCalls;
    },
  };
}

const mockDb = createMockDb();

vi.mock("~/lib/dal/shared", () => ({
  getDb: () => mockDb,
}));

vi.mock("~/server/db/schema", () => ({
  organizations: { table: "organizations" },
  machines: { table: "machines" },
  issueStatuses: { table: "issue_statuses" },
  priorities: { table: "priorities" },
}));

describe("enableAnonymousReportingMutation", () => {
  beforeEach(() => {
    mockDb.__reset();
    vi.resetModules();
  });

  it("throws and leaves state untouched when provided statusId does not exist", async () => {
    mockDb.query.issueStatuses.findFirst.mockResolvedValue(null);
    const { enableAnonymousReportingMutation } = await import(
      "./test-setup-service"
    );

    await expect(
      enableAnonymousReportingMutation({
        machineId: "machine-1",
        organizationId: "org-1",
        statusId: "missing-status",
      }),
    ).rejects.toThrow(/status/i);

    expect(mockDb.__getUpdateCalls()).toHaveLength(0);
  });

  it("throws and leaves state untouched when provided priorityId does not exist", async () => {
    mockDb.query.issueStatuses.findFirst.mockResolvedValue({
      id: "status-1",
      organization_id: "org-1",
    });
    mockDb.query.priorities.findFirst.mockResolvedValue(null);

    const { enableAnonymousReportingMutation } = await import(
      "./test-setup-service"
    );

    await expect(
      enableAnonymousReportingMutation({
        machineId: "machine-1",
        organizationId: "org-1",
        priorityId: "missing-priority",
      }),
    ).rejects.toThrow(/priority/i);

    expect(mockDb.__getUpdateCalls()).toHaveLength(0);
  });
});
