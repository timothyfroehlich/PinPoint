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
vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));
vi.mock("~/services/issues", () => ({
  createIssue: vi.fn(),
}));
vi.mock("~/lib/rate-limit", () => ({
  checkAuthenticatedIssueLimit: vi.fn(),
  checkPublicIssueLimit: vi.fn(),
  formatResetTime: vi.fn(),
  getClientIp: vi.fn(),
}));
vi.mock("~/lib/blob/config", () => ({
  BLOB_CONFIG: { maxFiles: 5, maxFileSizeMB: 10 },
}));
vi.mock("~/lib/blob/client", () => ({
  deleteFromBlob: vi.fn(),
}));

import { getRecentIssuesAction, submitPublicIssueAction } from "./actions";
import { db } from "~/server/db";
import {
  AuthSessionMissingError,
  type SupabaseClient,
} from "@supabase/supabase-js";
import {
  checkAuthenticatedIssueLimit,
  checkPublicIssueLimit,
  formatResetTime,
  getClientIp,
  type RateLimitResult,
} from "~/lib/rate-limit";
import { createClient } from "~/lib/supabase/server";

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
// ---------------------------------------------------------------------------
// submitPublicIssueAction — Rate limiting branching
// ---------------------------------------------------------------------------
describe("submitPublicIssueAction — Rate limiting branching", () => {
  const allowedLimitResult: RateLimitResult = {
    success: true,
    limit: 20,
    remaining: 19,
    reset: 0,
  };

  const blockedLimitResult: RateLimitResult = {
    success: false,
    limit: 20,
    remaining: 0,
    reset: 123456789,
  };

  type GetUserResult = Awaited<ReturnType<SupabaseClient["auth"]["getUser"]>>;

  function mockAuth(userId: string | null): void {
    const getUserResult: GetUserResult = userId
      ? {
          data: {
            user: {
              id: userId,
              app_metadata: {},
              user_metadata: {},
              aud: "authenticated",
              created_at: new Date().toISOString(),
            },
          },
          error: null,
        }
      : { data: { user: null }, error: new AuthSessionMissingError() };

    const auth: Pick<SupabaseClient["auth"], "getUser"> = {
      getUser: vi.fn().mockResolvedValue(getUserResult),
    };

    vi.mocked(createClient).mockResolvedValue({
      auth,
    } as SupabaseClient);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getClientIp).mockResolvedValue("192.168.1.50");
    vi.mocked(checkPublicIssueLimit).mockResolvedValue(allowedLimitResult);
    vi.mocked(checkAuthenticatedIssueLimit).mockResolvedValue(
      allowedLimitResult
    );
    vi.mocked(formatResetTime).mockReturnValue("5 minutes");
  });

  it("uses checkAuthenticatedIssueLimit (keyed by user.id) and skips IP check when user is logged in", async () => {
    mockAuth("tech-user-456");

    await submitPublicIssueAction({}, new FormData());

    expect(checkAuthenticatedIssueLimit).toHaveBeenCalledWith("tech-user-456");
    expect(checkPublicIssueLimit).not.toHaveBeenCalled();
  });

  it("uses checkPublicIssueLimit (keyed by IP) when user is anonymous", async () => {
    mockAuth(null);

    await submitPublicIssueAction({}, new FormData());

    expect(checkPublicIssueLimit).toHaveBeenCalledWith("192.168.1.50");
    expect(checkAuthenticatedIssueLimit).not.toHaveBeenCalled();
  });

  it("returns rate limit error when authenticated limit is exceeded", async () => {
    mockAuth("tech-user-456");
    vi.mocked(checkAuthenticatedIssueLimit).mockResolvedValue(
      blockedLimitResult
    );

    const result = await submitPublicIssueAction({}, new FormData());

    expect(result).toEqual({
      error: "Too many submissions. Please try again in 5 minutes.",
    });
  });

  it("returns rate limit error when anonymous limit is exceeded", async () => {
    mockAuth(null);
    vi.mocked(checkPublicIssueLimit).mockResolvedValue(blockedLimitResult);

    const result = await submitPublicIssueAction({}, new FormData());

    expect(result).toEqual({
      error: "Too many submissions. Please try again in 5 minutes.",
    });
  });
});
