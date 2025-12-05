import { test, expect } from "@playwright/test";
import { loginAs } from "../support/actions";
import { createTestUser, updateUserRole } from "../support/supabase-admin";

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

  test("admin can view users and change roles", async ({ page }) => {
    // Login as Admin
    await loginAs(page, { email: adminEmail, password: "TestPassword123" });

    // Navigate to Admin Users Page
    await page.goto("/admin/users");
    await expect(
      page.getByRole("heading", { name: "User Management" })
    ).toBeVisible();

    // Verify Target User is listed
    await expect(page.getByText(targetEmail)).toBeVisible();

    // Change Target User Role to Admin
    // Find the row with target email, then find the select within it
    const row = page.getByRole("row").filter({ hasText: targetEmail });
    const selectTrigger = row.getByRole("combobox");

    // Initial role should be Member (default)
    await expect(selectTrigger).toHaveText("Member");
    await expect(selectTrigger).toBeEnabled();

    // Change to Admin
    await selectTrigger.click();
    await page.getByRole("option", { name: "Admin" }).click();

    // Verify Toast Success
    await expect(page.getByText("Role updated successfully")).toBeVisible();

    // Verify Role Persisted (UI update)
    await expect(selectTrigger).toHaveText("Admin");
  });

  test("admin cannot demote themselves", async ({ page }) => {
    // Login as Admin
    await loginAs(page, { email: adminEmail, password: "TestPassword123" });

    // Navigate to Admin Users Page
    await page.goto("/admin/users");

    // Find own row
    const row = page.getByRole("row").filter({ hasText: adminEmail });
    const selectTrigger = row.getByRole("combobox");

    // Select should be disabled for self-admin
    await expect(selectTrigger).toBeDisabled();
    await expect(selectTrigger).toHaveText("Admin");
  });

  test("non-admin cannot access admin page", async ({ page }) => {
    // Login as Target User (who was made admin in previous test? No, tests run in parallel or serial? Default is parallel but beforeAll is shared if in same file?
    // Wait, if I change target user role in first test, it affects second test if they share state.
    // Playwright tests in same file run in parallel by default unless configured otherwise, but beforeAll runs once per worker.
    // If I want isolation, I should create fresh users for each test or use serial mode.
    // I'll use separate users for this test or just use `test.describe.serial`.

    // Actually, let's create a fresh member for this test to be safe.
    const memberEmail = `member_${Date.now()}@example.com`;
    await createTestUser(memberEmail);

    await loginAs(page, { email: memberEmail, password: "TestPassword123" });

    // Try to navigate to Admin Page
    await page.goto("/admin/users");

    // Should be redirected to dashboard
    await expect(page).toHaveURL("/dashboard");
    await expect(
      page.getByRole("heading", { name: "Dashboard" })
    ).toBeVisible();
  });
});
