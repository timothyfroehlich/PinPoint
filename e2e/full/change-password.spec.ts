import { test, expect } from "@playwright/test";
import { loginAs, logout } from "../support/actions";
import { createTestUser, deleteTestUser } from "../support/supabase-admin.js";

const originalPassword = "TestPassword123";

test.describe("Change Password", () => {
  // Each test gets its own user to avoid shared-password conflicts when
  // tests run in parallel under fullyParallel: true.
  let changePasswordUserId: string;
  let changePasswordEmail: string;
  let wrongPasswordUserId: string;
  let wrongPasswordEmail: string;

  test.beforeAll(async () => {
    const ts = Date.now();
    changePasswordEmail = `change_pw_${ts}@example.com`;
    const changeUser = await createTestUser(
      changePasswordEmail,
      originalPassword
    );
    changePasswordUserId = changeUser.id;

    wrongPasswordEmail = `wrong_pw_${ts}@example.com`;
    const wrongUser = await createTestUser(
      wrongPasswordEmail,
      originalPassword
    );
    wrongPasswordUserId = wrongUser.id;
  });

  test.afterAll(async () => {
    await Promise.all([
      deleteTestUser(changePasswordUserId),
      deleteTestUser(wrongPasswordUserId),
    ]);
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

    await expect(page.getByRole("heading", { name: "Security" })).toBeVisible();

    const form = page.getByTestId("change-password-form");
    await form.getByLabel("Current Password").fill(originalPassword);
    await form.getByLabel("New Password", { exact: true }).fill(newPassword);
    await form.getByLabel("Confirm New Password").fill(newPassword);
    await form.getByRole("button", { name: "Change Password" }).click();

    await expect(form.getByRole("button", { name: "Saved!" })).toBeVisible();

    // --- Verify new password works ---
    await logout(page, testInfo);

    await page.goto("/login");
    await page.getByLabel("Email").fill(changePasswordEmail);
    await page.getByLabel("Password", { exact: true }).fill(newPassword);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 10000 });
  });

  test("shows error for wrong current password", async ({ page }, testInfo) => {
    await loginAs(page, testInfo, {
      email: wrongPasswordEmail,
      password: originalPassword,
    });

    await page.goto("/settings");

    const form = page.getByTestId("change-password-form");
    await form.getByLabel("Current Password").fill("WrongPassword");
    await form
      .getByLabel("New Password", { exact: true })
      .fill("NewPassword123");
    await form.getByLabel("Confirm New Password").fill("NewPassword123");
    await form.getByRole("button", { name: "Change Password" }).click();

    await expect(
      form.getByText("Current password is incorrect.")
    ).toBeVisible();
  });
});
