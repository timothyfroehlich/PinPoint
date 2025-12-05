import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  vi,
  beforeEach,
} from "vitest";
import { createClient } from "@supabase/supabase-js";
import { db } from "~/server/db";
import { userProfiles } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { updateUserRole } from "~/app/(app)/admin/users/actions";

// Mock next/cache
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

describe("Admin User Management Integration", () => {
  let adminUser: any;
  let targetUser: any;

  beforeAll(async () => {
    // Create Admin User
    const adminEmail = `admin-${Date.now()}@test.com`;
    const { data: adminData, error: adminError } =
      await adminSupabase.auth.admin.createUser({
        email: adminEmail,
        email_confirm: true,
        user_metadata: { first_name: "Admin", last_name: "User" },
      });
    if (adminError) {
      console.error("Failed to create admin user:", adminError);
      throw new Error(
        `Failed to create admin user: ${JSON.stringify(adminError)}`
      );
    }
    adminUser = adminData.user;

    // Create Target User
    const targetEmail = `target-${Date.now()}@test.com`;
    const { data: targetData, error: targetError } =
      await adminSupabase.auth.admin.createUser({
        email: targetEmail,
        email_confirm: true,
        user_metadata: { first_name: "Target", last_name: "User" },
      });
    if (targetError) {
      console.error("Failed to create target user:", targetError);
      throw new Error(
        `Failed to create target user: ${JSON.stringify(targetError)}`
      );
    }
    targetUser = targetData.user;

    // Ensure profiles exist (auto-created by trigger, but let's wait/verify)
    // In integration tests, triggers should fire.
    // We manually set the admin role for the admin user
    await db
      .update(userProfiles)
      .set({ role: "admin" })
      .where(eq(userProfiles.id, adminUser.id));
  });

  afterAll(async () => {
    if (adminUser) await adminSupabase.auth.admin.deleteUser(adminUser.id);
    if (targetUser) await adminSupabase.auth.admin.deleteUser(targetUser.id);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should allow admin to change user role", async () => {
    // Mock as Admin
    mockGetUser.mockResolvedValue({ data: { user: adminUser } });

    await updateUserRole(targetUser.id, "admin");

    const updatedProfile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, targetUser.id),
    });
    expect(updatedProfile?.role).toBe("admin");
  });

  it("should prevent admin from demoting themselves", async () => {
    // Mock as Admin
    mockGetUser.mockResolvedValue({ data: { user: adminUser } });

    await expect(updateUserRole(adminUser.id, "member")).rejects.toThrow(
      "Admins cannot demote themselves"
    );

    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.id, adminUser.id),
    });
    expect(profile?.role).toBe("admin");
  });

  it("should prevent non-admin from changing roles", async () => {
    // Mock as Target User (who is now admin from previous test, let's reset them first)
    await db
      .update(userProfiles)
      .set({ role: "member" })
      .where(eq(userProfiles.id, targetUser.id));

    mockGetUser.mockResolvedValue({ data: { user: targetUser } });

    await expect(updateUserRole(adminUser.id, "guest")).rejects.toThrow(
      "Forbidden: Only admins can change roles"
    );
  });
});
