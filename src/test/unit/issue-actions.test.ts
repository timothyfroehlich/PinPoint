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

import { revalidatePath } from "next/cache";
import { createClient } from "~/lib/supabase/server";
import { db } from "~/server/db";

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

    // Setup db mock chain
    const mockValues = vi.fn().mockResolvedValue(undefined);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    vi.mocked(db.insert).mockReturnValue({
      values: mockValues,
    } as unknown as ReturnType<typeof db.insert>);
  });

  it("should successfully add a comment", async () => {
    const formData = new FormData();
    formData.append("issueId", validUuid);
    formData.append("comment", "Test comment");

    const result = await addCommentAction(initialState, formData);

    expect(result.ok).toBe(true);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(db.insert).toHaveBeenCalled();
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
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("should handle database errors gracefully", async () => {
    // Mock db error
    const mockValues = vi.fn().mockRejectedValue(new Error("DB Error"));
    // eslint-disable-next-line @typescript-eslint/unbound-method
    vi.mocked(db.insert).mockReturnValue({
      values: mockValues,
    } as unknown as ReturnType<typeof db.insert>);

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
