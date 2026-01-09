import { describe, it, expect, vi, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { unconfirmedUsers, userProfiles } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import {
  updateUserRole,
  inviteUser,
  resendInvite,
} from "~/app/(app)/admin/users/actions";
import { createTestUser } from "~/test/helpers/factories";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";
import { sendInviteEmail } from "~/lib/email/invite";

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
}));

// Mock Supabase Server Client
const mockGetUser = vi.fn();
vi.mock("~/lib/supabase/server", () => ({
  createClient: () =>
    Promise.resolve({
      auth: {
        getUser: mockGetUser,
      },
    }),
}));

// Mock Email Service
vi.mock("~/lib/email/invite", () => ({
  sendInviteEmail: vi.fn(() => Promise.resolve({ success: true })),
}));

// Mock next/headers
vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Map([["host", "localhost:3000"]])),
}));

// Mock the global db to point to our test db from PGlite
vi.mock("~/server/db", async () => {
  const { getTestDb } = await import("~/test/setup/pglite");
  const db = await getTestDb();
  return { db };
});

describe("Admin User Management Integration", () => {
  setupTestDb();

  let adminUser: { id: string; email: string } | undefined;
  let targetUser: { id: string; email: string } | undefined;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Create Admin User
    const adminId = randomUUID();
    const adminEmail = `admin-${Date.now()}@test.com`;

    // Insert into auth.users (raw SQL as it's not in drizzle schema usually, or use sql template)
    await (
      await getTestDb()
    ).execute(
      `INSERT INTO auth.users (id, email) VALUES ('${adminId}', '${adminEmail}')`
    );

    // Profile is auto-created by trigger in production, but PGlite schema might lack the trigger.
    // Manually insert profile.
    const adminProfileData = createTestUser({
      id: adminId,
      email: adminEmail,
      firstName: "Admin",
      lastName: "User",
      role: "admin",
    });

    await (await getTestDb()).insert(userProfiles).values(adminProfileData);

    adminUser = { id: adminId, email: adminEmail };

    // Create Target User
    const targetId = randomUUID();
    const targetEmail = `target-${Date.now()}@test.com`;

    await (
      await getTestDb()
    ).execute(
      `INSERT INTO auth.users (id, email) VALUES ('${targetId}', '${targetEmail}')`
    );

    const targetProfileData = createTestUser({
      id: targetId,
      email: targetEmail,
      firstName: "Target",
      lastName: "User",
      role: "member",
    });

    await (await getTestDb()).insert(userProfiles).values(targetProfileData);

    targetUser = { id: targetId, email: targetEmail };
  });

  it("should allow admin to change user role", async () => {
    // Mock as Admin
    mockGetUser.mockResolvedValue({ data: { user: adminUser! } });

    await updateUserRole(targetUser!.id, "admin");

    const updatedProfile = await (
      await getTestDb()
    ).query.userProfiles.findFirst({
      where: eq(userProfiles.id, targetUser!.id),
    });
    expect(updatedProfile?.role).toBe("admin");
  });

  it("should prevent admin from demoting themselves", async () => {
    // Mock as Admin
    mockGetUser.mockResolvedValue({ data: { user: adminUser! } });

    await expect(updateUserRole(adminUser!.id, "member")).rejects.toThrow(
      "Admins cannot demote themselves"
    );

    const profile = await (
      await getTestDb()
    ).query.userProfiles.findFirst({
      where: eq(userProfiles.id, adminUser!.id),
    });
    expect(profile?.role).toBe("admin");
  });

  it("should prevent non-admin from changing roles", async () => {
    // Reset Target User to Member (it was made admin in first test)
    await (await getTestDb())
      .update(userProfiles)
      .set({ role: "member" })
      .where(eq(userProfiles.id, targetUser!.id));

    // Mock as Target User
    mockGetUser.mockResolvedValue({ data: { user: targetUser! } });

    await expect(updateUserRole(adminUser!.id, "user")).rejects.toThrow(
      "Forbidden: Only admins can perform this action"
    );
  });

  describe("inviteUser", () => {
    it("should allow admin to invite a new user", async () => {
      mockGetUser.mockResolvedValue({ data: { user: adminUser! } });

      const formData = new FormData();
      formData.append("firstName", "Invited");
      formData.append("lastName", "User");
      formData.append("email", "invite@test.com");
      formData.append("role", "member");
      formData.append("sendInvite", "true");

      const result = await inviteUser(formData);
      expect(result.ok).toBe(true);
      expect(result.userId).toBeDefined();

      const ucUser = await (
        await getTestDb()
      ).query.unconfirmedUsers.findFirst({
        where: eq(unconfirmedUsers.email, "invite@test.com"),
      });
      expect(ucUser).toBeDefined();
      expect(ucUser?.role).toBe("member");
      expect(sendInviteEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: "invite@test.com" })
      );
    });

    it("should reject invite for existing active user", async () => {
      mockGetUser.mockResolvedValue({ data: { user: adminUser! } });

      const formData = new FormData();
      formData.append("firstName", "Existing");
      formData.append("lastName", "User");
      formData.append("email", targetUser!.email); // targetUser already exists in beforeEach
      formData.append("role", "member");

      await expect(inviteUser(formData)).rejects.toThrow(
        "A user with this email already exists and is active."
      );
    });

    it("should reject invite for already invited user", async () => {
      mockGetUser.mockResolvedValue({ data: { user: adminUser! } });

      const email = "already-invited@test.com";
      await (await getTestDb()).insert(unconfirmedUsers).values({
        firstName: "Already",
        lastName: "Invited",
        email,
      });

      const formData = new FormData();
      formData.append("firstName", "Invited");
      formData.append("lastName", "Again");
      formData.append("email", email);
      formData.append("role", "member");

      await expect(inviteUser(formData)).rejects.toThrow(
        "This user has already been invited."
      );
    });

    it("should throw error when email sending fails", async () => {
      mockGetUser.mockResolvedValue({ data: { user: adminUser! } });
      vi.mocked(sendInviteEmail).mockResolvedValueOnce({
        success: false,
        error: "SMTP Error",
      });

      const formData = new FormData();
      formData.append("firstName", "Fail");
      formData.append("lastName", "Email");
      formData.append("email", "fail@test.com");
      formData.append("role", "member");
      formData.append("sendInvite", "true");

      await expect(inviteUser(formData)).rejects.toThrow(
        "Failed to send invitation email: SMTP Error"
      );

      // Verify user was still created (or should we rollback? Currently it's not in a transaction with email)
      // The current implementation inserts THEN sends email.
      const ucUser = await (
        await getTestDb()
      ).query.unconfirmedUsers.findFirst({
        where: eq(unconfirmedUsers.email, "fail@test.com"),
      });
      expect(ucUser).toBeDefined();
    });
  });

  describe("resendInvite", () => {
    it("should allow admin to resend an invitation", async () => {
      mockGetUser.mockResolvedValue({ data: { user: adminUser! } });

      const [ucUser] = await (
        await getTestDb()
      )
        .insert(unconfirmedUsers)
        .values({
          firstName: "Resend",
          lastName: "Me",
          email: "resend@test.com",
        })
        .returning();

      const result = await resendInvite(ucUser.id);
      expect(result.ok).toBe(true);
      expect(sendInviteEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: "resend@test.com" })
      );
    });

    it("should throw error when resending fails", async () => {
      mockGetUser.mockResolvedValue({ data: { user: adminUser! } });
      vi.mocked(sendInviteEmail).mockResolvedValueOnce({
        success: false,
        error: "Network Error",
      });

      const [ucUser] = await (
        await getTestDb()
      )
        .insert(unconfirmedUsers)
        .values({
          firstName: "Fail",
          lastName: "Resend",
          email: "fail-resend@test.com",
        })
        .returning();

      await expect(resendInvite(ucUser.id)).rejects.toThrow(
        "Failed to send invitation email: Network Error"
      );
    });
  });
});
