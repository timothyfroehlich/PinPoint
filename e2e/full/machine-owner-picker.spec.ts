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
 * were also removed from this E2E. No replacement test exists yet; audit
 * row #25 (form-resets, P3) tracks creating
 * `src/components/users/InviteUserDialog.test.tsx`.
 */

import { test, expect, type Page } from "@playwright/test";
import { cleanupTestEntities } from "../support/cleanup.js";
import { STORAGE_STATE } from "../support/auth-state.js";

const testMachines = new Set<string>();
const testEmails = new Set<string>();

/** Open the owner picker popover and wait for it to be interactive. */
async function openOwnerPicker(page: Page) {
  await page.getByTestId("owner-select").click();
  // Wait for the search input to be visible — it's a reliable sign the
  // popover is fully open and interactive.
  await expect(page.getByPlaceholder("Search users...")).toBeVisible({
    timeout: 5000,
  });
}

/**
 * Select a guest user by name using the search input.
 *
 * Searching bypasses the "Show guests and invited users" checkbox filter
 * (per OwnerSelect: when query is non-empty, all matching users are shown).
 * This is more robust on mobile viewports where the checkbox+list scroll
 * interaction can miss clicks on CommandItem elements.
 *
 * Uses keyboard Enter rather than pointer click to confirm the selection.
 * cmdk's keyboard handler fires the "cmdk-item-select" event on the currently
 * aria-selected item, which is more reliable on mobile touch emulation where
 * Playwright's synthesized pointer events can fail to trigger cmdk's onClick
 * even when the element is correctly targeted (PP-pvbq regression).
 */
async function selectGuestUserBySearch(page: Page, name: string) {
  const searchInput = page.getByPlaceholder("Search users...");
  await searchInput.fill(name);
  const list = page.locator("[data-slot=command-list]");
  const item = list
    .locator("[data-slot=command-item]")
    .filter({ hasText: name });
  await expect(item).toBeVisible({ timeout: 5000 });
  // Wait for cmdk to mark the item as keyboard-selected (aria-selected="true").
  // cmdk auto-selects the first visible item when the search query changes;
  // pressing Enter on the focused search input then fires onSelect on that item.
  await expect(item).toHaveAttribute("aria-selected", "true", {
    timeout: 3000,
  });
  await searchInput.press("Enter");
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

    // Open picker and select guest via search (search bypasses the
    // "Show guests" checkbox filter — more robust on mobile viewports).
    await openOwnerPicker(page);
    await selectGuestUserBySearch(page, "Guest User");

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

    // Open picker and select guest via search (search bypasses the
    // "Show guests" checkbox filter — more robust on mobile viewports).
    await openOwnerPicker(page);
    await selectGuestUserBySearch(page, "Guest User");

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
