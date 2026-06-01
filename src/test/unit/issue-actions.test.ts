/**
 * Unit Tests — issue Server Actions (PP-x4li.1.3 post-RECLASS)
 *
 * KEEP-unit blocks only. The permission/authorization blocks and the service-
 * delegation block were migrated or superseded in Wave 3 (PP-x4li.1.3):
 *
 * Migrated to src/test/integration/issue-detail-permissions.test.ts:
 *   - updateIssueStatusAction: "should allow update if authorized"
 *   - updateIssueStatusAction: "should deny update if unauthorized"
 *   - updateIssueFrequencyAction: "should successfully update frequency"
 *   (All three now exercise the real checkPermission against PGlite state.)
 *
 * Superseded by existing coverage in src/test/integration/issue-services.test.ts:
 *   - addCommentAction: "should successfully add a comment"
 *   (addIssueComment DB state + notification dispatch is block 7 in that file.)
 *
 * Remaining tests cover the boundaries that belong at the unit layer:
 *   - Auth gate (unauthenticated → UNAUTHORIZED before any DB/service call)
 *   - Zod validation (empty/malformed input → VALIDATION without side effects)
 *   - Service-boundary error handling (service throws → SERVER result)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { addCommentAction } from "~/app/(app)/issues/actions";

// Mock Next.js modules
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    const error = new Error("NEXT_REDIRECT");
    (error as any).digest = `NEXT_REDIRECT;replace;${url};`;
    throw error;
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock Supabase client
vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

// Mock DB (only needed for revalidation path after addIssueComment; never
// reached by the three KEEP-unit blocks below, but kept to satisfy the import)
vi.mock("~/server/db", () => ({
  db: {
    insert: vi.fn(),
    query: {
      issues: {
        findFirst: vi.fn(),
      },
      userProfiles: {
        findFirst: vi.fn(),
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

// Mock notifications
vi.mock("~/lib/notifications", () => ({
  createNotification: vi.fn(),
  getChannels: vi.fn().mockResolvedValue([]),
}));

// Mock services
vi.mock("~/services/issues", () => ({
  updateIssueStatus: vi.fn(),
  updateIssueSeverity: vi.fn(),
  updateIssuePriority: vi.fn(),
  updateIssueFrequency: vi.fn(),
  addIssueComment: vi.fn(),
}));

import { createClient } from "~/lib/supabase/server";
import { addIssueComment } from "~/services/issues";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

describe("addCommentAction", () => {
  const validUuid = "123e4567-e89b-12d3-a456-426614174000";
  const mockUser = { id: "user-123" };
  const initialState = undefined;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default successful auth
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
    } as unknown as SupabaseClient);

    // Setup service mock
    vi.mocked(addIssueComment).mockResolvedValue(undefined as any);
  });

  it("should return an error if not authenticated", async () => {
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as unknown as SupabaseClient);

    const formData = new FormData();
    formData.append("issueId", validUuid);
    formData.append("comment", "Test comment");

    const result = await addCommentAction(initialState, formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("UNAUTHORIZED");
    }
  });

  it("should validate input", async () => {
    const formData = new FormData();
    formData.append("issueId", validUuid);
    formData.append("comment", ""); // Empty comment

    const result = await addCommentAction(initialState, formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("VALIDATION");
    }
    expect(addIssueComment).not.toHaveBeenCalled();
  });

  it("should handle database errors gracefully", async () => {
    // Mock service error
    vi.mocked(addIssueComment).mockRejectedValue(new Error("Service Error"));

    const commentObj = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Test comment" }],
        },
      ],
    };
    const formData = new FormData();
    formData.append("issueId", validUuid);
    formData.append("comment", JSON.stringify(commentObj));

    const result = await addCommentAction(initialState, formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("SERVER");
    }
  });
});
