import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  vi,
  beforeEach,
} from "vitest";
import { randomUUID } from "node:crypto";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { updateUserRole } from "~/app/(app)/admin/users/actions";
import { createTestUser } from "~/test/helpers/factories";

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  redirect: vi.fn(), // Add redirect if used
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

describe("Admin User Management Integration", () => {
  let adminUser: { id: string; email: string } | undefined;
  let targetUser: { id: string; email: string } | undefined;

  beforeAll(async () => {
    // Create Admin User
    const adminId = randomUUID();
    const adminEmail = `admin-${Date.now()}@test.com`;

    // Insert into auth.users (raw SQL as it's not in drizzle schema usually, or use sql template)
    await db.execute(
      `INSERT INTO auth.users (id, email) VALUES ('${adminId}', '${adminEmail}')`
    );

    // Profile is auto-created by trigger. Update it with test data.
    const adminProfileData = createTestUser({
      id: adminId,
      firstName: "Admin",
      lastName: "User",
      role: "admin",
    });

    await db
      .update(userProfiles)
      .set(adminProfileData)
      .where(eq(userProfiles.id, adminId));

    adminUser = { id: adminId, email: adminEmail };

    // Create Target User
    const targetId = randomUUID();
    const targetEmail = `target-${Date.now()}@test.com`;

    await db.execute(
      `INSERT INTO auth.users (id, email) VALUES ('${targetId}', '${targetEmail}')`
    );

    const targetProfileData = createTestUser({
      id: targetId,
      firstName: "Target",
      lastName: "User",
      role: "member",
    });

    await db
      .update(userProfiles)
      .set(targetProfileData)
      .where(eq(userProfiles.id, targetId));

    targetUser = { id: targetId, email: targetEmail };
  });

  afterAll(async () => {
    if (adminUser) {
      await db.execute(`DELETE FROM auth.users WHERE id = '${adminUser.id}'`);
      await db.delete(userProfiles).where(eq(userProfiles.id, adminUser.id));
    }
    if (targetUser) {
      await db.execute(`DELETE FROM auth.users WHERE id = '${targetUser.id}'`);
      await db.delete(userProfiles).where(eq(userProfiles.id, targetUser.id));
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should allow admin to change user role", async () => {
    // Mock as Admin
    mockGetUser.mockResolvedValue({ data: { user: adminUser! } });

    await updateUserRole(targetUser!.id, "admin");

    const updatedProfile = await db.query.userProfiles.findFirst({
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

    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, adminUser!.id),
    });
    expect(profile?.role).toBe("admin");
  });

  it("should prevent non-admin from changing roles", async () => {
    // Reset Target User to Member (it was made admin in first test)
    await db
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
