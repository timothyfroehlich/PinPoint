import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { submitPublicIssueAction } from "~/app/report/actions";

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

  describe("assignedTo permission handling", () => {
    const validUuid = "00000000-0000-0000-0000-000000000000";
    const assigneeUuid = "11111111-1111-1111-8111-111111111111";

    const createValidFormData = (assignedTo?: string) => {
      const formData = new FormData();
      formData.set("machineId", validUuid);
      formData.set("title", "Test Issue");
      formData.set("severity", "minor");
      formData.set("frequency", "intermittent");
      if (assignedTo !== undefined) {
        formData.set("assignedTo", assignedTo);
      }
      return formData;
    };

    it("member can assign issue to another user", async () => {
      // Setup: authenticated member
      const { createClient } = await import("~/lib/supabase/server");
      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: validUuid } },
          }),
        },
      } as never);

      const { db } = await import("~/server/db");
      // Must mock both machines and userProfiles since clearAllMocks resets them
      vi.mocked(db.query.machines.findFirst).mockResolvedValue({
        initials: "MCH",
      } as never);
      vi.mocked(db.query.userProfiles.findFirst).mockResolvedValue({
        role: "member",
      } as never);

      vi.mocked(createIssue).mockResolvedValue({
        id: "issue-1",
        issueNumber: 1,
      } as never);

      const formData = createValidFormData(assigneeUuid);
      await submitPublicIssueAction({ error: "" }, formData);

      expect(createIssue).toHaveBeenCalledWith(
        expect.objectContaining({ assignedTo: assigneeUuid })
      );
    });

    it("admin can assign issue to another user", async () => {
      const { createClient } = await import("~/lib/supabase/server");
      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: validUuid } },
          }),
        },
      } as never);

      const { db } = await import("~/server/db");
      vi.mocked(db.query.machines.findFirst).mockResolvedValue({
        initials: "MCH",
      } as never);
      vi.mocked(db.query.userProfiles.findFirst).mockResolvedValue({
        role: "admin",
      } as never);

      vi.mocked(createIssue).mockResolvedValue({
        id: "issue-1",
        issueNumber: 1,
      } as never);

      const formData = createValidFormData(assigneeUuid);
      await submitPublicIssueAction({ error: "" }, formData);

      expect(createIssue).toHaveBeenCalledWith(
        expect.objectContaining({ assignedTo: assigneeUuid })
      );
    });

    it("member with empty assignedTo normalizes to null", async () => {
      const { createClient } = await import("~/lib/supabase/server");
      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: validUuid } },
          }),
        },
      } as never);

      const { db } = await import("~/server/db");
      vi.mocked(db.query.machines.findFirst).mockResolvedValue({
        initials: "MCH",
      } as never);
      vi.mocked(db.query.userProfiles.findFirst).mockResolvedValue({
        role: "member",
      } as never);

      vi.mocked(createIssue).mockResolvedValue({
        id: "issue-1",
        issueNumber: 1,
      } as never);

      const formData = createValidFormData(""); // Empty string = Unassigned
      await submitPublicIssueAction({ error: "" }, formData);

      expect(createIssue).toHaveBeenCalledWith(
        expect.objectContaining({ assignedTo: null })
      );
    });

    it("guest assignedTo is stripped (unauthenticated)", async () => {
      // Default mock: user = null (unauthenticated)
      const { createClient } = await import("~/lib/supabase/server");
      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
          }),
        },
      } as never);

      const { db } = await import("~/server/db");
      vi.mocked(db.query.machines.findFirst).mockResolvedValue({
        initials: "MCH",
      } as never);

      vi.mocked(createIssue).mockResolvedValue({
        id: "issue-1",
        issueNumber: 1,
      } as never);

      const formData = createValidFormData(assigneeUuid);
      await submitPublicIssueAction({ error: "" }, formData);

      expect(createIssue).toHaveBeenCalledWith(
        expect.objectContaining({ assignedTo: null })
      );
    });

    it("non-member authenticated user assignedTo is stripped", async () => {
      const { createClient } = await import("~/lib/supabase/server");
      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: validUuid } },
          }),
        },
      } as never);

      const { db } = await import("~/server/db");
      vi.mocked(db.query.machines.findFirst).mockResolvedValue({
        initials: "MCH",
      } as never);
      vi.mocked(db.query.userProfiles.findFirst).mockResolvedValue({
        role: "guest", // Not member or admin
      } as never);

      vi.mocked(createIssue).mockResolvedValue({
        id: "issue-1",
        issueNumber: 1,
      } as never);

      const formData = createValidFormData(assigneeUuid);
      await submitPublicIssueAction({ error: "" }, formData);

      expect(createIssue).toHaveBeenCalledWith(
        expect.objectContaining({ assignedTo: null })
      );
    });
  });
});
