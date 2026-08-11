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
import { createTestUser, deleteTestUser } from "../support/supabase-admin.js";

const testMachines = new Set<string>();

// Each test gets its OWN throwaway guest instead of the seeded guest@test.com.
//
// The promote journey flips a guest to member for real — that is the whole
// point of the flow — so pointing it at a seeded user left a member where the
// next run needed a guest: no promote dialog appeared and both tests failed.
// Demoting the seeded user in teardown would restore it, but not safely: the
// comprehensive job runs this file in three browser projects against one
// database, so one project's demote can land while another still holds a
// guest-owned machine, and migration 0027's `user_profiles_no_demote_owner`
// trigger raises `check_violation` on exactly that. A per-test user mutates
// nothing shared, so there is no restore to get wrong. (PP-168u.)
let guestUserId: string | null = null;
let guestName = "";

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

  test.beforeEach(async () => {
    const testId = Math.random().toString(36).substring(7);
    guestName = `Ownerpick Guest${testId}`;
    // A user created through the auth admin API lands on `guest` by default
    // (the handle_new_user trigger in supabase/seed.sql), which is what these
    // journeys need.
    //
    // `@example.com`, NOT `@test.com`: nothing else can reclaim a leaked
    // auth.users row. `db:fast-reset` deliberately never truncates the auth
    // schema, and `/api/test-data/cleanup` lacks the privilege, so the ONLY
    // sweeper is global-setup's `cleanupInviteSignupUsers`, whose filter is
    // `@example.com`. A run that dies between this hook and the afterEach
    // (worker kill, timeout) would leave a `@test.com` row in auth.users
    // forever, regrowing the unbounded-growth problem PP-ph46 fixed. Seed
    // users are `@test.com` / `@pinpoint.internal`, so this domain also can
    // never collide with one.
    const user = await createTestUser(
      `owner-picker-guest-${testId}@example.com`,
      "TestPassword123",
      { firstName: "Ownerpick", lastName: `Guest${testId}` }
    );
    guestUserId = user.id;
  });

  test.afterEach(async ({ request }) => {
    const userId = guestUserId;
    guestUserId = null;

    // Machines go first: machines.owner_id references user_profiles with no
    // ON DELETE, so a still-owned machine blocks the user delete.
    let machineError: Error | null = null;
    try {
      if (testMachines.size > 0) {
        await cleanupTestEntities(request, {
          machineInitials: Array.from(testMachines),
        });
      }
    } catch (error) {
      machineError = error instanceof Error ? error : new Error(String(error));
    } finally {
      testMachines.clear();
    }

    // The user delete runs even when the machine cleanup failed — skipping it
    // would leak an auth.users row that only global-setup's sweeper can
    // reclaim. But it is NOT allowed to become the reported failure in that
    // case: with the machine still around it raises an FK error that is a
    // symptom of the machine cleanup failing, and letting it propagate (the
    // previous `finally` did) would replace the real error with a misleading
    // one.
    if (userId !== null) {
      try {
        await deleteTestUser(userId);
      } catch (error) {
        if (machineError === null) {
          throw error instanceof Error ? error : new Error(String(error));
        }
      }
    }

    if (machineError !== null) throw machineError;
  });

  test("promote dialog appears when a guest owner is selected", async ({
    page,
  }) => {
    const testId = Math.random().toString(36).substring(7);
    // 6 chars, not 5 — the form's own maxLength. Truncating to 5 left only two
    // random characters (1296 combinations) to keep three browser projects on
    // one database apart, and a collision does not just fail the create: the
    // loser's afterEach deletes machines BY INITIALS, so it would delete the
    // winner's machine mid-test. Three characters is 46656.
    const machineInitials = `OPK${testId.toUpperCase()}`.substring(0, 6);

    testMachines.add(machineInitials);

    await page.goto("/m/new");

    // Fill required fields
    await page.getByLabel(/Initials/i).fill(machineInitials);
    await page.getByLabel(/Machine Name/i).fill(`Owner Picker Test ${testId}`);

    // Open picker and select guest via search (search bypasses the
    // "Show guests" checkbox filter — more robust on mobile viewports).
    await openOwnerPicker(page);
    await selectGuestUserBySearch(page, guestName);

    // Owner trigger should show the throwaway guest as selected
    await expect(page.getByTestId("owner-select")).toContainText(guestName);

    // Submit the form
    await page.getByRole("button", { name: /Create Machine/i }).click();

    // Promote dialog should appear after the server action round-trip +
    // React useEffect cycle. Use the config's own CI-aware `expect.timeout`
    // (30s in CI, 10s locally) instead of a hardcoded value — a fixed 15s
    // override here previously undercut the CI default by half, right where
    // Mobile Safari/Mobile Chrome + parallel-worker contention need the most
    // margin (PP flaky-test report 2026-07-05: this assertion was the #1
    // flakiest test in CI over the prior week, including one run where it
    // failed all 3 attempts — original + 2 retries — at the 15s mark).
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
    // 6 chars — see the sibling test for why 5 was too few.
    const machineInitials = `OPC${testId.toUpperCase()}`.substring(0, 6);

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
    await selectGuestUserBySearch(page, guestName);

    // Verify selection
    await expect(page.getByTestId("owner-select")).toContainText(guestName);

    // Submit
    await page.getByRole("button", { name: /Create Machine/i }).click();

    // Promote dialog should appear after the server action round-trip. Rely
    // on the config's CI-aware `expect.timeout` (see comment on the sibling
    // assertion above) rather than a hardcoded override that undercuts it.
    await expect(
      page.getByRole("heading", { name: /Promote to member and assign/i })
    ).toBeVisible();

    await page.getByRole("button", { name: /Promote and assign/i }).click();

    // Should redirect to machine detail page — same reasoning: let this
    // inherit the global CI-aware expect timeout instead of a hardcoded 15s.
    await expect(page).toHaveURL(new RegExp(`/m/${machineInitials}`));
    await expect(
      page.getByRole("heading", { name: `Owner Picker Confirm ${testId}` })
    ).toBeVisible();
  });
});
