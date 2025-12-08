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
    inArray: vi.fn((col, vals) => ({ op: "inArray", col, vals })),
  };
});

describe("getIssues", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch all issues when no filters are provided", async () => {
    await getIssues({});

    expect(db.query.issues.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: undefined,
        orderBy: expect.objectContaining({ op: "desc" }),
      })
    );
  });

  it("should filter by machineInitials", async () => {
    const machineInitials = "MM";
    await getIssues({ machineInitials });

    expect(db.query.issues.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          op: "and",
          args: expect.arrayContaining([
            expect.objectContaining({ op: "eq", val: machineInitials }),
          ]),
        }),
      })
    );
  });

  it("should filter by status", async () => {
    await getIssues({ status: "new" });

    expect(db.query.issues.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          op: "and",
          args: expect.arrayContaining([
            expect.objectContaining({
              op: "inArray",
              vals: ["new"],
            }),
          ]),
        }),
      })
    );
  });

  it("should filter by multiple statuses", async () => {
    await getIssues({ status: ["new", "in_progress"] });

    expect(db.query.issues.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          op: "and",
          args: expect.arrayContaining([
            expect.objectContaining({
              op: "inArray",
              vals: ["new", "in_progress"],
            }),
          ]),
        }),
      })
    );
  });

  it("should ignore invalid status", async () => {
    await getIssues({ status: "invalid_status" });

    expect(db.query.issues.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: undefined,
      })
    );
  });

  it("should filter by severity", async () => {
    await getIssues({ severity: "unplayable" });

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
      machineInitials: "MM",
      status: "new",
    });

    expect(db.query.issues.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          op: "and",
          args: expect.arrayContaining([
            expect.objectContaining({ op: "eq", val: "MM" }),
            expect.objectContaining({ op: "inArray", vals: ["new"] }),
          ]),
        }),
      })
    );
  });
});
