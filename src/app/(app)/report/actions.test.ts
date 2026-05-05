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
  checkPublicIssueLimit: vi.fn(),
  formatResetTime: vi.fn(),
  getClientIp: vi.fn(),
}));
vi.mock("~/lib/security/turnstile", () => ({
  verifyTurnstileToken: vi.fn(),
}));
vi.mock("~/lib/blob/config", () => ({
  BLOB_CONFIG: { maxFiles: 5, maxFileSizeMB: 10 },
}));
vi.mock("~/lib/blob/client", () => ({
  deleteFromBlob: vi.fn(),
}));

import { getRecentIssuesAction, submitPublicIssueAction } from "./actions";
import { db } from "~/server/db";
import { verifyTurnstileToken } from "~/lib/security/turnstile";
import {
  checkPublicIssueLimit,
  formatResetTime,
  getClientIp,
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
  // Success path
  // ---------------------------------------------------------------------------
  describe("success path", () => {
    it("returns ok with properly serialized rows", async () => {
      const fakeDate = new Date("2025-06-15T12:00:00.000Z");
      vi.mocked(db.query.issues.findMany).mockResolvedValue([
        {
          id: "issue-1",
          issueNumber: 42,
          title: "Stuck flipper",
          status: "new" as const,
          severity: "major" as const,
          priority: "high" as const,
          frequency: "intermittent" as const,
          createdAt: fakeDate,
        },
      ]);

      const result = await getRecentIssuesAction("MM", 5);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0]).toEqual({
          id: "issue-1",
          issueNumber: 42,
          title: "Stuck flipper",
          status: "new",
          severity: "major",
          priority: "high",
          frequency: "intermittent",
          createdAt: "2025-06-15T12:00:00.000Z",
        });
      }
      expect(db.query.issues.findMany).toHaveBeenCalledOnce();
    });

    it("returns ok with empty array when no issues exist", async () => {
      vi.mocked(db.query.issues.findMany).mockResolvedValue([]);

      const result = await getRecentIssuesAction("ABC", 10);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual([]);
      }
    });

    it("returns multiple rows preserving order", async () => {
      const dates = [
        new Date("2025-06-15T12:00:00.000Z"),
        new Date("2025-06-14T12:00:00.000Z"),
      ];
      vi.mocked(db.query.issues.findMany).mockResolvedValue([
        {
          id: "issue-1",
          issueNumber: 10,
          title: "First",
          status: "new" as const,
          severity: "minor" as const,
          priority: "low" as const,
          frequency: "constant" as const,
          createdAt: dates[0],
        },
        {
          id: "issue-2",
          issueNumber: 9,
          title: "Second",
          status: "confirmed" as const,
          severity: "cosmetic" as const,
          priority: "medium" as const,
          frequency: "frequent" as const,
          createdAt: dates[1],
        },
      ]);

      const result = await getRecentIssuesAction("XY", 5);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(2);
        expect(result.value[0]?.createdAt).toBe("2025-06-15T12:00:00.000Z");
        expect(result.value[1]?.createdAt).toBe("2025-06-14T12:00:00.000Z");
      }
    });

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
// submitPublicIssueAction — CAPTCHA branching
//
// These tests focus narrowly on whether verifyTurnstileToken gets called and
// what the action returns on CAPTCHA failure. They short-circuit at form
// validation (empty FormData is rejected by parsePublicIssueForm) rather than
// mocking the full happy path.
// ---------------------------------------------------------------------------
describe("submitPublicIssueAction — CAPTCHA branching", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getClientIp).mockResolvedValue("127.0.0.1");
    vi.mocked(checkPublicIssueLimit).mockResolvedValue({
      success: true,
      reset: 0,
    } as any);
    vi.mocked(formatResetTime).mockReturnValue("0s");
  });

  it("skips verifyTurnstileToken when the user is logged in", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { id: "user-123" } } }),
      },
    } as any);
    vi.mocked(verifyTurnstileToken).mockResolvedValue(true);

    // Empty FormData fails parsePublicIssueForm, returning { error: "..." }
    // BEFORE any further side effects. We don't care about that error — we
    // only care that the CAPTCHA verifier was never called.
    await submitPublicIssueAction({}, new FormData());

    expect(verifyTurnstileToken).not.toHaveBeenCalled();
  });

  it("calls verifyTurnstileToken when the user is anonymous", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as any);
    vi.mocked(verifyTurnstileToken).mockResolvedValue(true);

    await submitPublicIssueAction({}, new FormData());

    expect(verifyTurnstileToken).toHaveBeenCalledOnce();
  });

  it("returns CAPTCHA error when anonymous user fails verification", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as any);
    vi.mocked(verifyTurnstileToken).mockResolvedValue(false);

    const formData = new FormData();
    formData.set("captchaToken", "invalid-token");

    const result = await submitPublicIssueAction({}, formData);

    expect(result).toEqual({
      error: "CAPTCHA verification failed. Please try again.",
    });
  });

  it("reads the token from the captchaToken FormData field", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as any);
    vi.mocked(verifyTurnstileToken).mockResolvedValue(true);

    const formData = new FormData();
    formData.set("captchaToken", "valid-cf-token");

    await submitPublicIssueAction({}, formData);

    expect(verifyTurnstileToken).toHaveBeenCalledWith(
      "valid-cf-token",
      "127.0.0.1"
    );
  });
});
