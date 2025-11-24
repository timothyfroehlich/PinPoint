/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { getIssues } from "./queries";
import { db } from "~/server/db";
import type * as DrizzleOrm from "drizzle-orm";

// Mock DB
vi.mock("~/server/db", () => ({
  db: {
    query: {
      issues: {
        findMany: vi.fn(),
      },
    },
  },
}));

// Mock Drizzle ORM helpers to make assertions easier
vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof DrizzleOrm>();
  return {
    ...actual,
    eq: vi.fn((col, val) => ({ op: "eq", col, val })),
    and: vi.fn((...args) => ({ op: "and", args })),
    desc: vi.fn((col) => ({ op: "desc", col })),
    isNull: vi.fn((col) => ({ op: "isNull", col })),
  };
});

describe("getIssues", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch all issues when no filters are provided", async () => {
    await getIssues({});

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(db.query.issues.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: undefined,
        orderBy: expect.objectContaining({ op: "desc" }),
      })
    );
  });

  it("should filter by machineId", async () => {
    const machineId = "123";
    await getIssues({ machineId });

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(db.query.issues.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          op: "and",
          args: expect.arrayContaining([
            expect.objectContaining({ op: "eq", val: machineId }),
          ]),
        }),
      })
    );
  });

  it("should filter by status", async () => {
    await getIssues({ status: "new" });

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(db.query.issues.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          op: "and",
          args: expect.arrayContaining([
            expect.objectContaining({ op: "eq", val: "new" }),
          ]),
        }),
      })
    );
  });

  it("should ignore invalid status", async () => {
    await getIssues({ status: "invalid_status" });

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(db.query.issues.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: undefined,
      })
    );
  });

  it("should filter by severity", async () => {
    await getIssues({ severity: "unplayable" });

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(db.query.issues.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          op: "and",
          args: expect.arrayContaining([
            expect.objectContaining({ op: "eq", val: "unplayable" }),
          ]),
        }),
      })
    );
  });

  it("should filter by assignedTo (specific user)", async () => {
    const userId = "user-123";
    await getIssues({ assignedTo: userId });

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(db.query.issues.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          op: "and",
          args: expect.arrayContaining([
            expect.objectContaining({ op: "eq", val: userId }),
          ]),
        }),
      })
    );
  });

  it("should filter by assignedTo (unassigned)", async () => {
    await getIssues({ assignedTo: "unassigned" });

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(db.query.issues.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          op: "and",
          args: expect.arrayContaining([
            expect.objectContaining({ op: "isNull" }),
          ]),
        }),
      })
    );
  });

  it("should combine multiple filters", async () => {
    await getIssues({
      machineId: "m1",
      status: "new",
    });

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(db.query.issues.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          op: "and",
          args: expect.arrayContaining([
            expect.objectContaining({ op: "eq", val: "m1" }),
            expect.objectContaining({ op: "eq", val: "new" }),
          ]),
        }),
      })
    );
  });
});
