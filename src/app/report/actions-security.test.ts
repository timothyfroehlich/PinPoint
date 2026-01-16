import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { submitPublicIssueAction } from "./actions";

// Mock Next.js server modules
vi.mock("next/headers", () => ({
  headers: vi.fn(),
  cookies: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

// Mock logger
vi.mock("~/lib/logger", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock rate limiting
vi.mock("~/lib/rate-limit", () => ({
  checkPublicIssueLimit: vi.fn().mockResolvedValue({ success: true, reset: 0 }),
  getClientIp: vi.fn().mockResolvedValue("127.0.0.1"),
  formatResetTime: vi.fn().mockReturnValue("0s"),
}));

// Mock Supabase
vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    },
  }),
}));

// Mock DB
vi.mock("~/server/db", () => ({
  db: {
    query: {
      machines: {
        findFirst: vi.fn().mockResolvedValue({ initials: "MCH" }),
      },
      userProfiles: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    },
  },
}));

// Mock Service
vi.mock("~/services/issues", () => ({
  createIssue: vi.fn(),
}));

import { createIssue } from "~/services/issues";

describe("Public Issue Reporting Security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("should return generic error message on server error", async () => {
    // Simulate a sensitive DB error
    const sensitiveError = "duplicate key value violates unique constraint 'users_email_key'";
    vi.mocked(createIssue).mockRejectedValue(new Error(sensitiveError));

    const formData = new FormData();
    formData.set("machineId", "00000000-0000-0000-0000-000000000000");
    formData.set("title", "Test Issue");
    formData.set("severity", "minor");
    formData.set("consistency", "intermittent");

    const result = await submitPublicIssueAction({ error: "" }, formData);

    // Verify error is returned
    expect(result).toHaveProperty("error");

    // VERIFY: Error should be generic, not the sensitive one
    // Note: This expectation is designed to fail BEFORE the fix
    if (result.error === sensitiveError) {
        // Test failed (vulnerability confirmed) - we expect this initially
        expect(result.error).toBe("Unable to submit the issue. Please try again.");
    } else {
        // If it's already generic (unexpected), assertion will pass
        expect(result.error).not.toContain("duplicate key");
        expect(result.error).toBe("Unable to submit the issue. Please try again.");
    }
  });
});
