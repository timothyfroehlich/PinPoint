import { describe, it, expect, vi, beforeEach } from "vitest";
import { addCommentAction } from "~/app/(app)/issues/actions";

// Mock Next.js modules
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock Supabase client
vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

// Mock DB
vi.mock("~/server/db", () => ({
  db: {
    insert: vi.fn(),
    query: {
      issues: {
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
}));

// Mock services
vi.mock("~/services/issues", () => ({
  addIssueComment: vi.fn(),
  createIssue: vi.fn(),
  updateIssueStatus: vi.fn(),
}));

import { revalidatePath } from "next/cache";
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
    vi.mocked(addIssueComment).mockResolvedValue(undefined);
  });

  it("should successfully add a comment", async () => {
    const formData = new FormData();
    formData.append("issueId", validUuid);
    formData.append("comment", "Test comment");

    const result = await addCommentAction(initialState, formData);

    expect(result.ok).toBe(true);
    expect(addIssueComment).toHaveBeenCalledWith({
      issueId: validUuid,
      content: "Test comment",
      userId: mockUser.id,
    });
    expect(revalidatePath).toHaveBeenCalledWith(`/issues/${validUuid}`);
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

    const formData = new FormData();
    formData.append("issueId", validUuid);
    formData.append("comment", "Test comment");

    const result = await addCommentAction(initialState, formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("SERVER");
    }
  });
});
