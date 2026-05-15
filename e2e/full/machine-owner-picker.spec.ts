/**
 * E2E Tests: Machine Owner Picker UX (PP-6oi)
 *
 * Verifies the class-F multi-step user journeys for the promote-and-assign
 * dialog that appears when a guest is selected as machine owner:
 *
 * 1. Promote dialog opens when a guest owner is selected and form is submitted
 * 2. Confirming the promote dialog creates the machine and promotes the guest
 *
 * H-class UI state for the OwnerSelect picker (guest visibility filter,
 * checkbox toggle, typed search) is covered by RTL in
 * `src/components/machines/OwnerSelect.test.tsx` per the 2026-05 audit row #28.
 *
 * The InviteUserDialog form-field checks (no role field, sendInvite default)
 * were also removed from this E2E. Their RTL replacement is gated on audit
 * row #25 (form-resets, P3) — to be created at
 * `src/components/users/InviteUserDialog.test.tsx`.
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

test.describe("Machine Owner Picker — promote-dialog journeys (PP-6oi)", () => {
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

    // Promote dialog should appear — allow extra time for the server action
    // round-trip + React useEffect cycle (observed slower in Firefox).
    await expect(
      page.getByRole("heading", { name: /Promote to member and assign/i })
    ).toBeVisible({ timeout: 15000 });

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

    // Promote dialog should appear — allow extra time for server round-trip.
    await expect(
      page.getByRole("heading", { name: /Promote to member and assign/i })
    ).toBeVisible({ timeout: 15000 });

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
