import { test, expect } from "@playwright/test";
import { loginAs, logout } from "../support/actions.js";
import { createTestUser, deleteTestUser } from "../support/supabase-admin.js";

const originalPassword = "TestPassword123";

test.describe("Change Password", () => {
  let changePasswordUserId: string;
  let changePasswordEmail: string;

  test.beforeAll(async () => {
    const ts = Date.now();
    changePasswordEmail = `change_pw_${ts}@example.com`;
    const changeUser = await createTestUser(
      changePasswordEmail,
      originalPassword
    );
    changePasswordUserId = changeUser.id;
  });

  test.afterAll(async () => {
    await deleteTestUser(changePasswordUserId);
  });

  test("user can change password from settings page", async ({
    page,
  }, testInfo) => {
    const newPassword = "NewTestPassword456";

    await loginAs(page, testInfo, {
      email: changePasswordEmail,
      password: originalPassword,
    });

    await page.goto("/settings");

    await expect(
      page.getByRole("heading", { name: "Authentication" })
    ).toBeVisible();

    const form = page.getByTestId("change-password-form");
    await form.getByLabel(/^Current Password\s*\*?$/).fill(originalPassword);
    await form.getByLabel(/^New Password\s*\*?$/).fill(newPassword);
    await form.getByLabel(/^Confirm New Password\s*\*?$/).fill(newPassword);
    await form.getByRole("button", { name: "Change Password" }).click();

    await expect(form.getByRole("button", { name: "Saved!" })).toBeVisible();

    // --- Verify password inputs are cleared after successful save ---
    await expect(page.locator('input[name="currentPassword"]')).toHaveValue("");
    await expect(page.locator('input[name="newPassword"]')).toHaveValue("");
    await expect(page.locator('input[name="confirmNewPassword"]')).toHaveValue(
      ""
    );

    // --- Verify new password works ---
    await logout(page, testInfo);

    await page.goto("/login");
    await page.getByLabel("Email").fill(changePasswordEmail);
    await page.getByLabel(/^Password\s*\*?$/).fill(newPassword);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 10000 });
  });

  // "shows error for wrong current password" deleted (row 14): covered by
  // changePasswordAction unit tests in change-password-action.test.ts
  // (WRONG_PASSWORD case at the action level — class-B, cheapest layer).
});
