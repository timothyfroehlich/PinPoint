import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  addCommentAction,
  updateIssueStatusAction,
  updateIssueConsistencyAction,
} from "~/app/(app)/issues/actions";
import { canUpdateIssue } from "~/lib/permissions";

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

// Mock DB
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
}));

// Mock services
vi.mock("~/services/issues", () => ({
  updateIssueStatus: vi.fn(),
  updateIssueSeverity: vi.fn(),
  updateIssuePriority: vi.fn(),
  updateIssueConsistency: vi.fn(),
  addIssueComment: vi.fn(),
}));

// Mock permissions
vi.mock("~/lib/permissions", () => ({
  canUpdateIssue: vi.fn(),
}));

import { revalidatePath } from "next/cache";
import { createClient } from "~/lib/supabase/server";
import {
  addIssueComment,
  updateIssueStatus,
  updateIssueConsistency,
} from "~/services/issues";
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

    // Setup service mock
    vi.mocked(addIssueComment).mockResolvedValue(undefined as any);

    // Setup DB mock for fetching issue details
    vi.mocked(db.query.issues.findFirst).mockResolvedValue({
      machineInitials: "MM",
      issueNumber: 1,
    } as any);
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
    expect(revalidatePath).toHaveBeenCalledWith("/m/MM/i/1");
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

describe("updateIssueStatusAction", () => {
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
  });

  it("should allow update if authorized", async () => {
    // Mock issue found
    vi.mocked(db.query.issues.findFirst).mockResolvedValue({
      status: "new",
      machineInitials: "MM",
      issueNumber: 1,
      reportedBy: "user-123",
      assignedTo: null,
      machine: { ownerId: "owner-123", name: "Test Machine" },
    } as any);

    // Mock user profile
    vi.mocked(db.query.userProfiles.findFirst).mockResolvedValue({
      role: "member",
    });

    // Mock permission check true
    vi.mocked(canUpdateIssue).mockReturnValue(true);

    // Mock update success
    vi.mocked(updateIssueStatus).mockResolvedValue({
      issueId: validUuid,
      oldStatus: "new",
      newStatus: "in_progress",
    });

    const formData = new FormData();
    formData.append("issueId", validUuid);
    formData.append("status", "in_progress");

    const result = await updateIssueStatusAction(initialState, formData);

    expect(result.ok).toBe(true);
    expect(canUpdateIssue).toHaveBeenCalled();
    expect(updateIssueStatus).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/m/MM/i/1");
    expect(revalidatePath).toHaveBeenCalledWith("/m/MM");
  });

  it("should deny update if unauthorized", async () => {
    // Mock issue found
    vi.mocked(db.query.issues.findFirst).mockResolvedValue({
      status: "new",
      machineInitials: "MM",
      issueNumber: 1,
      reportedBy: "other-user",
      assignedTo: null,
      machine: { ownerId: "owner-123" },
    } as any);

    // Mock user profile
    vi.mocked(db.query.userProfiles.findFirst).mockResolvedValue({
      role: "member",
    });

    // Mock permission check false
    vi.mocked(canUpdateIssue).mockReturnValue(false);

    const formData = new FormData();
    formData.append("issueId", validUuid);
    formData.append("status", "in_progress");

    const result = await updateIssueStatusAction(initialState, formData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("UNAUTHORIZED");
    }
    expect(canUpdateIssue).toHaveBeenCalled();
    expect(updateIssueStatus).not.toHaveBeenCalled();
  });
});

describe("updateIssueConsistencyAction", () => {
  const validUuid = "123e4567-e89b-12d3-a456-426614174000";
  const mockUser = { id: "user-123" };
  const initialState = undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }),
      },
    } as any);
  });

  it("should successfully update consistency", async () => {
    vi.mocked(db.query.issues.findFirst).mockResolvedValue({
      machineInitials: "MM",
      issueNumber: 1,
      reportedBy: mockUser.id,
    } as any);
    vi.mocked(updateIssueConsistency).mockResolvedValue({
      issueId: validUuid,
      oldConsistency: "intermittent",
      newConsistency: "constant",
    });

    const formData = new FormData();
    formData.append("issueId", validUuid);
    formData.append("consistency", "constant");

    const result = await updateIssueConsistencyAction(initialState, formData);

    expect(result.ok).toBe(true);
    expect(updateIssueConsistency).toHaveBeenCalled();
  });
});
