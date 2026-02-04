import { test, expect } from "@playwright/test";
import { loginAs } from "../support/actions.js";
import { createTestUser, updateUserRole } from "../support/supabase-admin.js";

test.describe("Admin User Management", () => {
  let adminEmail: string;
  let adminId: string;
  let targetEmail: string;

  test.beforeAll(async () => {
    // Create Admin User
    const adminTimestamp = Date.now();
    adminEmail = `admin_${adminTimestamp}@example.com`;
    const adminUser = await createTestUser(adminEmail);
    adminId = adminUser.id;
    await updateUserRole(adminId, "admin");

    // Create Target User
    const targetTimestamp = Date.now();
    targetEmail = `target_${targetTimestamp}@example.com`;
    await createTestUser(targetEmail);
  });

  test("admin can view users and change roles", async ({ page }, testInfo) => {
    // Login as Admin
    await loginAs(page, testInfo, {
      email: adminEmail,
      password: "TestPassword123",
    });

    // Navigate to Admin Users Page
    await page.goto("/admin/users");
    // Verify we are on User Management page
    await expect(
      page.getByRole("heading", { name: "User Management" })
    ).toBeVisible();

    // Verify Target User is listed
    await expect(page.getByText(targetEmail)).toBeVisible();

    // Change Target User Role to Admin
    // Find the row with target email, then find the select within it
    const row = page.getByRole("row").filter({ hasText: targetEmail });
    const selectTrigger = row.getByRole("combobox");

    // Initial role should be Guest (signup default for non-invited users)
    await expect(selectTrigger).toHaveText("Guest");
    await expect(selectTrigger).toBeEnabled();

    // Change to Admin
    await selectTrigger.click();
    await page.getByRole("option", { name: "Admin" }).click();

    // Verify Toast Success
    await expect(page.getByText("Role updated successfully")).toBeVisible();

    // Verify Role Persisted (UI update)
    await expect(selectTrigger).toHaveText("Admin");
  });

  test("admin cannot demote themselves", async ({ page }, testInfo) => {
    // Login as Admin
    await loginAs(page, testInfo, {
      email: adminEmail,
      password: "TestPassword123",
    });

    // Navigate to Admin Users Page
    await page.goto("/admin/users");

    // Find own row
    const row = page.getByRole("row").filter({ hasText: adminEmail });
    const selectTrigger = row.getByRole("combobox");

    // Select should be disabled for self-admin
    await expect(selectTrigger).toBeDisabled();
    await expect(selectTrigger).toHaveText("Admin");
  });

  test("non-admin cannot access admin page", async ({ page }, testInfo) => {
    // Create a member user to test access control be safe.
    const memberEmail = `member_${Date.now()}@example.com`;
    await createTestUser(memberEmail);

    await loginAs(page, testInfo, {
      email: memberEmail,
      password: "TestPassword123",
    });

    // Try to navigate to Admin Page
    await page.goto("/admin/users");

    // Should be redirected to dashboard
    await expect(page).toHaveURL("/dashboard");
    await expect(page.getByTestId("quick-stats")).toBeVisible();
  });
});
