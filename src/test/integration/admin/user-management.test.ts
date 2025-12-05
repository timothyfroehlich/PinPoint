import { describe, it, expect, vi, beforeEach } from "vitest";
import { randomUUID } from "node:crypto";
import { userProfiles } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { updateUserRole } from "~/app/(app)/admin/users/actions";
import { createTestUser } from "~/test/helpers/factories";
import { getTestDb, setupTestDb } from "~/test/setup/pglite";

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

    await expect(updateUserRole(adminUser!.id, "guest")).rejects.toThrow(
      "Forbidden: Only admins can change roles"
    );
  });
});
