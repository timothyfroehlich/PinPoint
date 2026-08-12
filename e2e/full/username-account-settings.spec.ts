import { test, expect } from "@playwright/test";
import { loginAs } from "../support/actions.js";

test.describe("Username Account Settings", () => {
  // Note: the "username account → no email on file" behavior moved from the
  // old settings profile form to the Authentication section's AccountEmail
  // component and is covered at the unit layer
  // (src/app/(app)/settings/account-email.test.tsx). This file keeps the
  // multi-element notification-form behavior, which is a settings-page journey.

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
