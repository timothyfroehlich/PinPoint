/**
 * E2E Tests: Account Deletion Reassign Picker (PP-hci)
 *
 * Verifies that the machine reassignment picker on the account-deletion
 * dialog does NOT offer guest users as reassignment targets.
 *
 * Regression: without the fix, guests appeared in the Select because the
 * settings/page.tsx query fetched all userProfiles with no role filter.
 */

import { test, expect } from "@playwright/test";
import { STORAGE_STATE } from "../support/auth-state.js";
import { TEST_USERS } from "../support/constants.js";

test.describe("Account Deletion Reassign Picker (PP-hci)", () => {
  // Admin owns the Godzilla machine (GDZ) in seed data, so the
  // machine reassignment section will be visible when admin opens the dialog.
  test.use({ storageState: STORAGE_STATE.admin });

  test("reassign picker does not show guest users", async ({ page }) => {
    await page.goto("/settings");

    // Open the delete account dialog
    const triggerButton = page.getByTestId("delete-account-trigger");
    await expect(triggerButton).toBeVisible();
    await triggerButton.click();

    // The dialog should be open and show the reassignment section.
    // AlertDialog renders with role "alertdialog" (Radix/shadcn).
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Machine Reassignment Needed")).toBeVisible();

    // Open the reassignment Select
    const reassignSelect = dialog.getByRole("combobox");
    await reassignSelect.click();

    // The listbox (open dropdown) should not contain the guest user's name.
    // Use .toHaveCount(0) rather than .not.toBeVisible() so the assertion
    // fails if the option is present but off-screen in a scrollable list.
    const listbox = page.getByRole("listbox");
    await expect(listbox).toBeVisible();

    await expect(
      listbox.getByRole("option", { name: TEST_USERS.guest.name })
    ).toHaveCount(0);

    // Member, technician, and admin users SHOULD be present
    await expect(
      listbox.getByRole("option", { name: TEST_USERS.member.name })
    ).toBeVisible();
    await expect(
      listbox.getByRole("option", { name: TEST_USERS.technician.name })
    ).toBeVisible();

    // Close the dialog
    await page.keyboard.press("Escape");
    const keepAccountButton = page.getByRole("button", {
      name: "Keep Account",
    });
    if (await keepAccountButton.isVisible()) {
      await keepAccountButton.click();
    }
  });
});
