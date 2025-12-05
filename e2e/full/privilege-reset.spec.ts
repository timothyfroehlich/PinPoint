import { test, expect } from "@playwright/test";
import { loginAs } from "../support/actions";
import { createTestUser, updateUserRole } from "../support/supabase-admin";

test.describe("Privilege Reset on Account Switch", () => {
  let adminEmail: string;
  let memberEmail: string;

  test.beforeAll(async () => {
    const ts = Date.now();

    // Create Admin
    adminEmail = `admin_switch_${ts}@example.com`;
    const adminUser = await createTestUser(adminEmail);
    await updateUserRole(adminUser.id, "admin");

    // Create Member
    memberEmail = `member_switch_${ts}@example.com`;
    await createTestUser(memberEmail);
  });

  test("should reset privileges when switching from admin to member", async ({
    page,
  }) => {
    // 1. Login as Admin
    await loginAs(page, { email: adminEmail, password: "TestPassword123" });

    // Verify Access to Admin Page
    await page.goto("/admin/users");
    await expect(
      page.getByRole("heading", { name: "User Management" })
    ).toBeVisible();

    // 2. Logout (using UI or clearing cookies? UI is better for full flow)
    // Assuming there is a logout button in sidebar or header
    // Sidebar has "Sign Out"
    await page.getByRole("button", { name: "Sign Out" }).click();

    // Wait for redirect to login or home
    await expect(page).toHaveURL("/"); // or /login?

    // 3. Login as Member
    await loginAs(page, { email: memberEmail, password: "TestPassword123" });

    // 4. Try to access Admin Page
    await page.goto("/admin/users");

    // Verify Redirect to Dashboard (Access Denied)
    await expect(page).toHaveURL("/dashboard");
    await expect(
      page.getByRole("heading", { name: "Dashboard" })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "User Management" })
    ).not.toBeVisible();
  });
});
