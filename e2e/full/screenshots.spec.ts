import { test, expect } from "@playwright/test";
import { loginAs } from "../support/actions.js";
import { createTestUser, updateUserRole } from "../support/supabase-admin.js";

// Use a relative path for artifacts or default to test-results
const ARTIFACT_DIR = "test-results/screenshots";

test.describe("Admin Screenshots", () => {
  let adminEmail: string;

  test.beforeAll(async () => {
    const adminTimestamp = Date.now();
    adminEmail = `admin_shot_${adminTimestamp}@example.com`;
    const adminUser = await createTestUser(adminEmail);
    await updateUserRole(adminUser.id, "admin");

    // Create a few users to populate the list
    await createTestUser(`user1_${adminTimestamp}@example.com`);
    await createTestUser(`user2_${adminTimestamp}@example.com`);
  });

  test("capture admin page screenshots", async ({ page }) => {
    // Login
    await loginAs(page, { email: adminEmail, password: "TestPassword123" });

    // Navigate
    await page.goto("/admin/users");
    await expect(
      page.getByRole("heading", { name: "User Management" })
    ).toBeVisible();

    // Wait for table content to be fully loaded
    await expect(page.getByRole("row").first()).toBeVisible();

    // Screenshot 1: User List
    await page.screenshot({
      path: `${ARTIFACT_DIR}/admin_users_list.png`,
      fullPage: true,
    });

    // Screenshot 2: Role Dropdown
    // Find a user row (not self)
    const row = page.getByRole("row").filter({ hasText: "user1_" }).first();
    await row.getByRole("combobox").click();

    // Wait for dropdown animation/content
    await expect(page.getByRole("option", { name: "Guest" })).toBeVisible();

    await page.screenshot({ path: `${ARTIFACT_DIR}/role_dropdown.png` });
  });
});
