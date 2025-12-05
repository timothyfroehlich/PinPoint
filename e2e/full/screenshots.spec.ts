import { test, expect } from "@playwright/test";
import { loginAs } from "../support/actions";
import { createTestUser, updateUserRole } from "../support/supabase-admin";

const ARTIFACT_DIR =
  "/home/froeht/.gemini/antigravity/brain/48ca0616-c3f4-47ce-bb79-6277d89c967c";

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
    await page.waitForTimeout(1000); // Wait for animations/avatars

    // Screenshot 1: User List
    await page.screenshot({
      path: `${ARTIFACT_DIR}/admin_users_list.png`,
      fullPage: true,
    });

    // Screenshot 2: Role Dropdown
    // Find a user row (not self)
    const row = page.getByRole("row").filter({ hasText: "user1_" }).first();
    await row.getByRole("combobox").click();
    await page.waitForTimeout(500); // Wait for dropdown animation

    await page.screenshot({ path: `${ARTIFACT_DIR}/role_dropdown.png` });
  });
});
