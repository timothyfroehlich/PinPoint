import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock DB before importing the action
vi.mock("~/server/db", () => ({
  db: {
    query: {
      issues: {
        findMany: vi.fn(),
      },
    },
  },
}));

// Mock logger
vi.mock("~/lib/logger", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock drizzle-orm operators (used by the action internally)
vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col: unknown, val: unknown) => ({ type: "eq", val })),
  desc: vi.fn((col: unknown) => ({ type: "desc", col })),
}));

// Mock schema tables (referenced in query builder calls)
vi.mock("~/server/db/schema", () => ({
  machines: {},
  userProfiles: {},
  issueImages: {},
  issues: { machineInitials: "machineInitials", createdAt: "createdAt" },
}));

// Stub out other imports the module pulls in but that are irrelevant to this test
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
import { getRecentIssuesAction } from "./actions";
import { db } from "~/server/db";

describe("getRecentIssuesAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Zod validation tests — db should never be called
  // ---------------------------------------------------------------------------
  describe("input validation (Zod)", () => {
    it("rejects empty machineInitials", async () => {
      const result = await getRecentIssuesAction("", 5);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("SERVER");
        expect(result.message).toBe("Invalid input");
      }
      expect(db.query.issues.findMany).not.toHaveBeenCalled();
    });

    it("rejects machineInitials longer than 10 characters", async () => {
      const result = await getRecentIssuesAction("ABCDEFGHIJK", 5);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("SERVER");
        expect(result.message).toBe("Invalid input");
      }
      expect(db.query.issues.findMany).not.toHaveBeenCalled();
    });

    it("rejects machineInitials with invalid characters", async () => {
      const result = await getRecentIssuesAction("AB@CD", 5);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("SERVER");
        expect(result.message).toBe("Invalid input");
      }
      expect(db.query.issues.findMany).not.toHaveBeenCalled();
    });

    it("rejects machineInitials with spaces", async () => {
      const result = await getRecentIssuesAction("AB CD", 5);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("SERVER");
        expect(result.message).toBe("Invalid input");
      }
      expect(db.query.issues.findMany).not.toHaveBeenCalled();
    });

    it("rejects limit of 0", async () => {
      const result = await getRecentIssuesAction("MM", 0);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("SERVER");
        expect(result.message).toBe("Invalid input");
      }
      expect(db.query.issues.findMany).not.toHaveBeenCalled();
    });

    it("rejects limit greater than 20", async () => {
      const result = await getRecentIssuesAction("MM", 21);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("SERVER");
        expect(result.message).toBe("Invalid input");
      }
      expect(db.query.issues.findMany).not.toHaveBeenCalled();
    });

    it("rejects non-integer limit", async () => {
      const result = await getRecentIssuesAction("MM", 2.5);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("SERVER");
        expect(result.message).toBe("Invalid input");
      }
      expect(db.query.issues.findMany).not.toHaveBeenCalled();
    });

    it("rejects negative limit", async () => {
      const result = await getRecentIssuesAction("MM", -1);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("SERVER");
        expect(result.message).toBe("Invalid input");
      }
      expect(db.query.issues.findMany).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Success path (input-acceptance — DB mock is incidental; real DB checks
  // are in src/test/integration/recent-issues.test.ts)
  // ---------------------------------------------------------------------------
  describe("success path", () => {
    it("accepts machineInitials with hyphens", async () => {
      vi.mocked(db.query.issues.findMany).mockResolvedValue([]);

      const result = await getRecentIssuesAction("A-B", 1);

      expect(result.ok).toBe(true);
      expect(db.query.issues.findMany).toHaveBeenCalledOnce();
    });

    it("accepts boundary limit values (1 and 20)", async () => {
      vi.mocked(db.query.issues.findMany).mockResolvedValue([]);

      const result1 = await getRecentIssuesAction("MM", 1);
      expect(result1.ok).toBe(true);

      const result20 = await getRecentIssuesAction("MM", 20);
      expect(result20.ok).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // DB error handling
  // ---------------------------------------------------------------------------
  describe("database error handling", () => {
    it("returns err when db.query throws", async () => {
      vi.mocked(db.query.issues.findMany).mockRejectedValue(
        new Error("Connection refused")
      );

      const result = await getRecentIssuesAction("MM", 5);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("SERVER");
        expect(result.message).toBe("Could not load recent issues");
      }
    });

    it("returns err when db.query throws non-Error", async () => {
      vi.mocked(db.query.issues.findMany).mockRejectedValue("timeout");

      const result = await getRecentIssuesAction("MM", 5);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("SERVER");
        expect(result.message).toBe("Could not load recent issues");
      }
    });
  });
});
