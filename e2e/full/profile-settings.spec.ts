import { test, expect } from "@playwright/test";
import { loginAs } from "../support/actions";
import { TEST_USERS } from "../support/constants";

test.describe("Profile Settings", () => {
  test("should display user email in settings", async ({ page }, testInfo) => {
    await loginAs(page, testInfo, TEST_USERS.member);
    await page.goto("/settings");

    const profileForm = page.getByTestId("profile-form");
    const emailInput = profileForm.getByLabel("Email");

    // Verify the email field displays the logged-in user's email
    await expect(emailInput).toHaveValue(TEST_USERS.member.email);
    // Verify it's disabled (read-only)
    await expect(emailInput).toBeDisabled();
  });

  test("should update profile and handle cancel", async ({
    page,
  }, testInfo) => {
    await loginAs(page, testInfo, TEST_USERS.member);
    await page.goto("/settings");

    // 1. Update Profile
    const profileForm = page.getByTestId("profile-form");
    const firstNameInput = profileForm.getByLabel("First Name");
    const originalName = await firstNameInput.inputValue();
    const newName = `Updated ${Date.now()}`;

    await firstNameInput.fill(newName);
    await profileForm.getByRole("button", { name: "Update Profile" }).click();

    // Verify success state
    await expect(
      profileForm.getByRole("button", { name: "Saved!" })
    ).toBeVisible();

    // Verify persistence
    await page.reload();
    await expect(firstNameInput).toHaveValue(newName);

    // 2. Cancel Changes
    await firstNameInput.fill("Cancelled Name");
    await profileForm.getByRole("button", { name: "Cancel" }).click();

    // Verify reset
    await expect(firstNameInput).toHaveValue(newName);

    // Cleanup: Revert name
    await firstNameInput.fill(originalName);
    await profileForm.getByRole("button", { name: "Update Profile" }).click();
    await expect(
      profileForm.getByRole("button", { name: "Saved!" })
    ).toBeVisible();
  });
});
