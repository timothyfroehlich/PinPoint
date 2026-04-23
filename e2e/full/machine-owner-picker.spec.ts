/**
 * E2E Tests: Machine Owner Picker UX (PP-6oi)
 *
 * Verifies:
 * 1. Default state hides guests and invited users
 * 2. "Show guests and invited users" checkbox reveals them
 * 3. Typed search bypasses the filter
 * 4. ASSIGNEE_NOT_MEMBER promote dialog opens when a guest is selected
 * 5. Confirm promote: machine created, guest promoted to member
 */

import { test, expect, type Page } from "@playwright/test";
import { cleanupTestEntities } from "../support/cleanup.js";
import { STORAGE_STATE } from "../support/auth-state.js";

const testMachines = new Set<string>();
const testEmails = new Set<string>();

/** Open the owner picker popover. */
async function openOwnerPicker(page: Page) {
  await page.getByTestId("owner-select").click();
  // Wait for the popover content to be visible (checkbox is a reliable anchor)
  await expect(page.getByLabel(/Show guests and invited users/i)).toBeVisible();
}

test.describe("Machine Owner Picker UX (PP-6oi)", () => {
  test.use({ storageState: STORAGE_STATE.admin });

  test.afterEach(async ({ request }) => {
    if (testMachines.size > 0 || testEmails.size > 0) {
      await cleanupTestEntities(request, {
        machineInitials: Array.from(testMachines),
        userEmails: Array.from(testEmails),
      });
      testMachines.clear();
      testEmails.clear();
    }
  });

  test("owner picker hides guests by default and reveals them via checkbox", async ({
    page,
  }) => {
    await page.goto("/m/new");
    await openOwnerPicker(page);

    // Default state: "Guest User" text should NOT appear in the list
    // (it may appear elsewhere but not in the command list)
    const list = page.locator("[data-slot=command-list]");
    await expect(list.getByText("Guest User")).not.toBeVisible();

    // The "(GUEST)" badge should not appear by default
    await expect(list.getByText("(GUEST)")).not.toBeVisible();

    // Click the checkbox to reveal guests and invited users
    const checkbox = page.getByLabel(/Show guests and invited users/i);
    await expect(checkbox).not.toBeChecked();
    await checkbox.click();
    await expect(checkbox).toBeChecked();

    // "Guest User" should now appear under "Guests" section
    await expect(list.getByText("Guest User")).toBeVisible();
    // At least one "(GUEST)" badge is visible — .first() avoids strict-mode
    // violations when preview DBs contain multiple guest users.
    await expect(list.getByText("(GUEST)").first()).toBeVisible();
  });

  test("typed search bypasses the guest filter", async ({ page }) => {
    await page.goto("/m/new");
    await openOwnerPicker(page);

    const list = page.locator("[data-slot=command-list]");

    // Default: checkbox unchecked — Guest User hidden in list
    await expect(list.getByText("Guest User")).not.toBeVisible();

    // Type "Guest" in search — should bypass the filter
    await page.getByPlaceholder("Search users...").fill("Guest");

    // Guest User should appear because search bypasses the filter
    await expect(list.getByText("Guest User")).toBeVisible();
  });

  test("InviteUserDialog has no role field and sendInvite defaults to ON", async ({
    page,
  }) => {
    await page.goto("/m/new");

    // Click "Invite New" button
    await page.getByRole("button", { name: /Invite New/i }).click();

    // Dialog should open
    await expect(
      page.getByRole("heading", { name: /Invite New User/i })
    ).toBeVisible();

    // Role field should NOT be present
    await expect(page.getByLabel(/^Role$/i)).not.toBeVisible();

    // "Send Invitation Email" toggle should default to ON
    const inviteSwitch = page.getByRole("switch", {
      name: /Send invitation email/i,
    });
    await expect(inviteSwitch).toBeVisible();
    await expect(inviteSwitch).toHaveAttribute("aria-checked", "true");

    // Close dialog
    await page.getByRole("button", { name: /Cancel/i }).click();
    await expect(
      page.getByRole("heading", { name: /Invite New User/i })
    ).not.toBeVisible();
  });

  test("promote dialog appears when a guest owner is selected", async ({
    page,
  }) => {
    const testId = Math.random().toString(36).substring(7);
    const machineInitials = `OPK${testId.toUpperCase()}`.substring(0, 5);

    testMachines.add(machineInitials);

    await page.goto("/m/new");

    // Fill required fields
    await page.getByLabel(/Initials/i).fill(machineInitials);
    await page.getByLabel(/Machine Name/i).fill(`Owner Picker Test ${testId}`);

    // Open picker and reveal guests
    await openOwnerPicker(page);
    const checkbox = page.getByLabel(/Show guests and invited users/i);
    await checkbox.click();
    await expect(checkbox).toBeChecked();

    // Select the Guest User from the command list
    const list = page.locator("[data-slot=command-list]");
    await expect(list.getByText("Guest User")).toBeVisible();
    await list.getByText("Guest User").click();

    // Owner trigger should show "Guest User" selected
    await expect(page.getByTestId("owner-select")).toContainText("Guest User");

    // Submit the form
    await page.getByRole("button", { name: /Create Machine/i }).click();

    // Promote dialog should appear
    await expect(
      page.getByRole("heading", { name: /Promote to member and assign/i })
    ).toBeVisible();

    // Dialog should show "(GUEST)" badge
    const promoteDialog = page.getByRole("dialog").filter({
      has: page.getByText("Promote to member and assign"),
    });
    await expect(promoteDialog.getByText("(GUEST)")).toBeVisible();

    // Cancel button should close the dialog
    await promoteDialog.getByRole("button", { name: /Cancel/i }).click();
    await expect(
      page.getByRole("heading", { name: /Promote to member and assign/i })
    ).not.toBeVisible();
  });

  test("promote dialog confirm creates machine and promotes guest to member", async ({
    page,
  }) => {
    const testId = Math.random().toString(36).substring(7);
    const machineInitials = `OPC${testId.toUpperCase()}`.substring(0, 5);

    testMachines.add(machineInitials);

    await page.goto("/m/new");

    // Fill required fields
    await page.getByLabel(/Initials/i).fill(machineInitials);
    await page
      .getByLabel(/Machine Name/i)
      .fill(`Owner Picker Confirm ${testId}`);

    // Open picker and reveal guests
    await openOwnerPicker(page);
    const checkbox = page.getByLabel(/Show guests and invited users/i);
    await checkbox.click();
    await expect(checkbox).toBeChecked();

    // Select Guest User
    const list = page.locator("[data-slot=command-list]");
    await expect(list.getByText("Guest User")).toBeVisible();
    await list.getByText("Guest User").click();

    // Verify selection
    await expect(page.getByTestId("owner-select")).toContainText("Guest User");

    // Submit
    await page.getByRole("button", { name: /Create Machine/i }).click();

    // Promote dialog should appear — confirm it
    await expect(
      page.getByRole("heading", { name: /Promote to member and assign/i })
    ).toBeVisible();
    await page.getByRole("button", { name: /Promote and assign/i }).click();

    // Should redirect to machine detail page
    await expect(page).toHaveURL(new RegExp(`/m/${machineInitials}`), {
      timeout: 15000,
    });
    await expect(
      page.getByRole("heading", { name: `Owner Picker Confirm ${testId}` })
    ).toBeVisible();
  });
});
