import { test, expect } from "@playwright/test";
import { loginAs } from "../support/actions";

test.describe("Username Account Settings", () => {
  test("settings page shows 'no email on file' for username accounts", async ({
    page,
  }, testInfo) => {
    // Login as the username test account
    await loginAs(page, testInfo, {
      email: "testuser",
      password: "TestPassword123",
    });

    await page.goto("/settings");

    const profileForm = page.getByTestId("profile-form");

    // Should NOT show the email input
    await expect(profileForm.getByLabel("Email")).not.toBeVisible();

    // Should show the "no email" message
    await expect(profileForm.getByText("Username account")).toBeVisible();
  });

  test("notification form hides email toggles but keeps in-app controls", async ({
    page,
  }, testInfo) => {
    await loginAs(page, testInfo, {
      email: "testuser",
      password: "TestPassword123",
    });

    await page.goto("/settings");

    // The notification form should still be visible (for in-app controls)
    await expect(
      page.getByTestId("notification-preferences-form")
    ).toBeVisible();

    // Should show the "email not available" message
    await expect(
      page.getByText("Email notifications are not available")
    ).toBeVisible();

    // Email main switch should NOT be visible
    await expect(page.getByLabel("Email Notifications")).not.toBeVisible();

    // In-App main switch SHOULD be visible
    await expect(page.getByLabel("In-App Notifications")).toBeVisible();
  });
});
