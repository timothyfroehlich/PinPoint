import { test, expect } from "@playwright/test";
import { loginAs, logout } from "../support/actions";

test.describe("Change Password", () => {
  test("user can change password from settings page", async ({
    page,
  }, testInfo) => {
    const originalPassword = "TestPassword123";
    const newPassword = "NewTestPassword456";

    // Login with original password
    await loginAs(page, testInfo, {
      email: "member@test.com",
      password: originalPassword,
    });

    // Navigate to settings
    await page.goto("/settings");

    // Verify the Security section is visible
    await expect(page.getByRole("heading", { name: "Security" })).toBeVisible();

    // Fill in change password form
    const form = page.getByTestId("change-password-form");
    await form.getByLabel("Current Password").fill(originalPassword);
    await form.getByLabel("New Password", { exact: true }).fill(newPassword);
    await form.getByLabel("Confirm New Password").fill(newPassword);

    // Submit
    await form.getByRole("button", { name: "Change Password" }).click();

    // Should show success (Saved! button state)
    await expect(form.getByRole("button", { name: "Saved!" })).toBeVisible();

    // --- Verify new password works ---

    // Logout using the shared helper
    await logout(page);

    // Login with new password
    await page.goto("/login");
    await page.getByLabel("Email").fill("member@test.com");
    await page.getByLabel("Password", { exact: true }).fill(newPassword);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL("/dashboard", { timeout: 10000 });

    // --- Restore original password (cleanup) ---
    await page.goto("/settings");
    const formAgain = page.getByTestId("change-password-form");
    await formAgain.getByLabel("Current Password").fill(newPassword);
    await formAgain
      .getByLabel("New Password", { exact: true })
      .fill(originalPassword);
    await formAgain.getByLabel("Confirm New Password").fill(originalPassword);
    await formAgain.getByRole("button", { name: "Change Password" }).click();
    await expect(
      formAgain.getByRole("button", { name: "Saved!" })
    ).toBeVisible();
  });

  test("shows error for wrong current password", async ({ page }, testInfo) => {
    await loginAs(page, testInfo);

    await page.goto("/settings");

    const form = page.getByTestId("change-password-form");
    await form.getByLabel("Current Password").fill("WrongPassword");
    await form
      .getByLabel("New Password", { exact: true })
      .fill("NewPassword123");
    await form.getByLabel("Confirm New Password").fill("NewPassword123");
    await form.getByRole("button", { name: "Change Password" }).click();

    // Should show error message
    await expect(
      form.getByText("Current password is incorrect.")
    ).toBeVisible();
  });
});
