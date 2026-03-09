import { test, expect } from "@playwright/test";
import { TEST_USERS } from "../support/constants";
import { STORAGE_STATE } from "../support/auth-state";

test.describe("Profile Settings", () => {
  test.use({ storageState: STORAGE_STATE.member });

  // Capture the original member first name once so afterEach can restore it
  let originalFirstName: string | undefined;

  test.afterEach(async ({ page }) => {
    if (originalFirstName === undefined) return;
    await page.goto("/settings");
    const profileForm = page.getByTestId("profile-form");
    const firstNameInput = profileForm.getByLabel("First Name");
    const currentName = await firstNameInput.inputValue();
    if (currentName === originalFirstName) return;
    await firstNameInput.fill(originalFirstName);
    await profileForm.getByRole("button", { name: "Update Profile" }).click();
    await expect(
      profileForm.getByRole("button", { name: "Saved!" })
    ).toBeVisible();
    originalFirstName = undefined;
  });

  test("should display user email in settings", async ({ page }) => {
    await page.goto("/settings");

    const profileForm = page.getByTestId("profile-form");
    const emailInput = profileForm.getByLabel("Email");

    // Verify the email field displays the logged-in user's email
    await expect(emailInput).toHaveValue(TEST_USERS.member.email);
    // Verify it's disabled (read-only)
    await expect(emailInput).toBeDisabled();
  });

  test("should update profile and handle cancel", async ({ page }) => {
    await page.goto("/settings");

    // 1. Update Profile
    const profileForm = page.getByTestId("profile-form");
    const firstNameInput = profileForm.getByLabel("First Name");
    originalFirstName = await firstNameInput.inputValue();
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

    // Revert is handled by afterEach
  });
});
