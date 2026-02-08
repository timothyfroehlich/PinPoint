import { test, expect } from "@playwright/test";
import { Buffer } from "node:buffer";
import { loginAs } from "../support/actions";
import { TEST_USERS } from "../support/constants";
import {
  createTestUser,
  deleteTestUser,
  updateUserAvatar,
} from "../support/supabase-admin";

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

  test("should upload and remove avatar from settings", async ({
    page,
  }, testInfo) => {
    const sanitizedProjectName = testInfo.project.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-");
    const email = `avatar-${sanitizedProjectName}-${Date.now()}@example.com`;
    const password = "TestPassword123";
    const user = await createTestUser(email, password);

    try {
      await updateUserAvatar(
        user.id,
        "https://avatars.githubusercontent.com/u/12345?v=4"
      );

      await loginAs(page, testInfo, { email, password });
      await page.goto("/settings");

      const uploadButton = page.getByRole("button", { name: "Upload Photo" });
      const removeButton = page.getByRole("button", { name: "Remove" });

      await expect(uploadButton).toBeVisible();
      await expect(removeButton).toBeVisible();

      const [fileChooser] = await Promise.all([
        page.waitForEvent("filechooser"),
        uploadButton.click(),
      ]);
      await fileChooser.setFiles({
        name: "not-image.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("not an image"),
      });

      await expect(page.getByText(/Invalid file type/i)).toBeVisible();
      await removeButton.click();
      await expect(page.getByText("Avatar removed.")).toBeVisible({
        timeout: 15000,
      });
      await expect(removeButton).toHaveCount(0);
    } finally {
      await deleteTestUser(user.id).catch(() => undefined);
    }
  });
});
