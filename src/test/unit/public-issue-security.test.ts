import { describe, it, expect, vi, afterEach } from "vitest";
import { submitPublicIssueAction } from "~/app/(app)/report/actions";

// Mock server-only (no-op in test environment)
vi.mock("server-only", () => ({}));

// Mock Next.js server modules
vi.mock("next/headers", () => ({
  headers: vi.fn(),
  cookies: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock logger
vi.mock("~/lib/logger", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock Turnstile CAPTCHA — always pass so tests exercise the logic beyond CAPTCHA
vi.mock("~/lib/security/turnstile", () => ({
  verifyTurnstileToken: vi.fn().mockResolvedValue(true),
}));

// Mock rate limiting
vi.mock("~/lib/rate-limit", () => ({
  checkPublicIssueLimit: vi.fn().mockResolvedValue({ success: true, reset: 0 }),
  getClientIp: vi.fn().mockResolvedValue("127.0.0.1"),
  formatResetTime: vi.fn().mockReturnValue("0s"),
}));

// Mock Supabase — unauthenticated by default (error-sanitization test is for
// the anonymous path; createIssue throws before any user-specific logic).
vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    },
  }),
}));

// Mock DB — error-sanitization test mocks createIssue to throw before the DB
// is queried for permission resolution, so the machine lookup still needs a stub.
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

// Mock observability
vi.mock("~/lib/observability/report-error", () => ({
  reportError: vi.fn(),
  serverActionError: vi.fn(),
}));

// Mock Service — createIssue is mocked to throw a sensitive error
vi.mock("~/services/issues", () => ({
  createIssue: vi.fn(),
}));

import { createIssue } from "~/services/issues";

/**
 * KEEP-unit: error-message sanitization at the action boundary.
 *
 * createIssue is mocked to throw a sensitive DB error; we assert that the
 * action returns a generic client-facing message and never leaks internals.
 * No real DB state is needed — this is purely a boundary sanitization check.
 *
 * The 5 assignedTo permission tests have been RECLASS'd to:
 *   src/test/integration/public-issue-submit.test.ts  (PP-x4li.1.3)
 */
describe("Public Issue Reporting Security", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("should not expose sensitive database error messages to client", async () => {
    // Simulate a sensitive DB error
    const sensitiveError =
      "duplicate key value violates unique constraint 'users_email_key'";
    vi.mocked(createIssue).mockRejectedValue(new Error(sensitiveError));

    const formData = new FormData();
    formData.set("machineId", "00000000-0000-0000-0000-000000000000");
    formData.set("title", "Test Issue");
    formData.set("severity", "minor");
    formData.set("frequency", "intermittent");

    const result = await submitPublicIssueAction({ error: "" }, formData);

    // Verify error is returned
    expect(result).toHaveProperty("error");

    // Error should be a generic, non-sensitive message
    expect(result.error).not.toBe(sensitiveError);
    expect(result.error).not.toContain("duplicate key");
    expect(result.error).toBe("Unable to submit the issue. Please try again.");
  });
});
