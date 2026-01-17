import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoist mocks so they can be used in vi.mock factories
const {
  mockGetUser,
  mockFindFirstUserProfiles,
  mockFindFirstAuthUsers,
  mockFindFirstInvitedUsers,
  mockInsertInvitedUsers,
  mockUpdateInvitedUsers,
  mockSendInviteEmail,
  mockRequireSiteUrl,
  mockRevalidatePath
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFindFirstUserProfiles: vi.fn(),
  mockFindFirstAuthUsers: vi.fn(),
  mockFindFirstInvitedUsers: vi.fn(),
  mockInsertInvitedUsers: vi.fn(),
  mockUpdateInvitedUsers: vi.fn(),
  mockSendInviteEmail: vi.fn(),
  mockRequireSiteUrl: vi.fn(),
  mockRevalidatePath: vi.fn(),
}));

// Mock dependencies
vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

vi.mock("~/lib/logger", () => ({
  log: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("~/lib/url", () => ({
  requireSiteUrl: mockRequireSiteUrl,
}));

vi.mock("~/lib/email/invite", () => ({
  sendInviteEmail: mockSendInviteEmail,
}));

// Mock Supabase
vi.mock("~/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: mockGetUser,
    },
  }),
}));

// Mock Drizzle
vi.mock("~/server/db", () => ({
  db: {
    query: {
      userProfiles: {
        findFirst: mockFindFirstUserProfiles,
      },
      authUsers: {
        findFirst: mockFindFirstAuthUsers,
      },
      invitedUsers: {
        findFirst: mockFindFirstInvitedUsers,
      },
    },
    insert: () => ({
      values: () => ({
        returning: mockInsertInvitedUsers,
      }),
    }),
    update: () => ({
      set: () => ({
        where: mockUpdateInvitedUsers,
      }),
    }),
  },
}));

// Import actions after mocks are set up
import { inviteUser, resendInvite } from "./actions";

describe("Admin User Actions Security - Error Handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks for success path
    mockGetUser.mockResolvedValue({
      data: { user: { id: "admin-id" } }
    });

    // User is admin
    mockFindFirstUserProfiles.mockResolvedValue({
      role: "admin",
      name: "Admin User"
    });

    // User to invite doesn't exist
    mockFindFirstAuthUsers.mockResolvedValue(null);
    mockFindFirstInvitedUsers.mockResolvedValue(null);

    // Insert success
    mockInsertInvitedUsers.mockResolvedValue([{ id: "new-user-id" }]);

    // Site URL
    mockRequireSiteUrl.mockReturnValue("http://localhost:3000");
  });

  it("inviteUser should not leak email provider errors", async () => {
    // Simulate email failure with sensitive info
    mockSendInviteEmail.mockResolvedValue({
      success: false,
      error: "Connection refused to 192.168.1.55:25",
    });

    const formData = new FormData();
    formData.append("firstName", "Test");
    formData.append("lastName", "User");
    formData.append("email", "test@example.com");
    formData.append("role", "member");
    formData.append("sendInvite", "true");

    // We expect it to fail, but we need to check the message
    await expect(inviteUser(formData)).rejects.toThrow();

    try {
      await inviteUser(formData);
    } catch (error: any) {
      expect(error.message).not.toContain("192.168.1.55");
      expect(error.message).toBe("Failed to send invitation email");
    }
  });

  it("resendInvite should not leak email provider errors", async () => {
    // Setup existing invited user
    mockFindFirstInvitedUsers.mockResolvedValue({
      id: "invited-id",
      email: "test@example.com",
      firstName: "Test",
    });

    // Simulate email failure with sensitive info
    mockSendInviteEmail.mockResolvedValue({
      success: false,
      error: "Invalid API Key: sk_live_12345",
    });

    await expect(resendInvite("invited-id")).rejects.toThrow();

    try {
      await resendInvite("invited-id");
    } catch (error: any) {
      expect(error.message).not.toContain("sk_live_12345");
      expect(error.message).toBe("Failed to send invitation email");
    }
  });
});
