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

  test("notification preferences section shows email unavailable message", async ({
    page,
  }, testInfo) => {
    await loginAs(page, testInfo, {
      email: "testuser",
      password: "TestPassword123",
    });

    await page.goto("/settings");

    // Should show the "not available" message instead of the full notification form
    await expect(
      page.getByText("Email notifications are not available")
    ).toBeVisible();
  });
});
