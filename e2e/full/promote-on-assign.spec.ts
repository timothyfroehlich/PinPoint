/**
 * E2E Test: Promote-on-Assign Flow
 *
 * Verifies the "Promote and assign" dialog that appears when an admin assigns
 * a guest user as a machine owner. Covers both create and update flows.
 *
 * Also exercises the OwnerSelect search input that bypasses the
 * "Show guests and invited users" filter (a new interactive control with no
 * other E2E coverage — folded in here per Copilot review feedback).
 */

import { test, expect } from "@playwright/test";
import { STORAGE_STATE } from "../support/auth-state.js";
import { cleanupTestEntities } from "../support/cleanup.js";
import {
  createTestUser,
  deleteTestUser,
  getUserRole,
} from "../support/supabase-admin.js";

const testMachines = new Set<string>();
const testEmails = new Set<string>();
const createdUserIds: string[] = [];

test.describe("Promote-on-assign (Create + Update flows)", () => {
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

  test.afterAll(async () => {
    // Backstop: ensure auth users created via supabase-admin are removed even
    // if cleanupTestEntities missed something. Errors are swallowed because
    // some users may have already been deleted via the cleanup endpoint.
    for (const userId of createdUserIds) {
      try {
        await deleteTestUser(userId);
      } catch {
        // already deleted
      }
    }
    createdUserIds.length = 0;
  });

  test("create flow: assigning a guest opens promote dialog and promotes on confirm", async ({
    page,
  }) => {
    const testId = Math.random().toString(36).substring(7);
    const guestEmail = `guest-create-${testId}@example.com`;
    const guestFirstName = "Guest";
    const guestLastName = `Create${testId}`;
    const guestFullName = `${guestFirstName} ${guestLastName}`;
    const machineInitials = `PC${testId.toUpperCase()}`.substring(0, 5);
    const machineName = `Promote Create ${testId}`;

    testEmails.add(guestEmail);
    testMachines.add(machineInitials);

    // Create the guest user directly via Supabase admin so they're a guest
    // BEFORE the test runs — the promote flow then has something to promote.
    // createTestUser leaves them as guest (handle_new_user trigger default).
    const guestUser = await createTestUser(guestEmail, "TestPassword123", {
      firstName: guestFirstName,
      lastName: guestLastName,
    });
    createdUserIds.push(guestUser.id);
    expect(await getUserRole(guestUser.id)).toBe("guest");

    await page.goto("/m/new");

    await page.getByLabel(/Initials/i).fill(machineInitials);
    await page.getByLabel(/Machine Name/i).fill(machineName);

    // Reveal hidden user groups so the guest is selectable in the dropdown
    await page.getByTestId("owner-show-hidden-checkbox").click();

    // Open the owner select and pick the guest user
    const ownerSelect = page.getByTestId("owner-select");
    await ownerSelect.click();
    await page
      .getByRole("option", { name: new RegExp(guestFullName) })
      .click({ force: true });
    await expect(ownerSelect).toContainText(guestFullName);
    await expect(ownerSelect).toContainText("(Guest)");

    // Submit — server returns ASSIGNEE_NOT_MEMBER → promote dialog opens
    await page.getByRole("button", { name: /Create Machine/i }).click();

    const promoteDialog = page.getByRole("dialog", {
      name: /Promote to member and assign/i,
    });
    await expect(promoteDialog).toBeVisible();
    await expect(promoteDialog).toContainText(guestFullName);
    await expect(promoteDialog).toContainText(/(Guest)/);

    // Confirm promotion + assignment (one transaction).
    // Wait for the form re-submit to land via Promise.all to avoid races
    // between the click handler running and Playwright moving on.
    await Promise.all([
      page.waitForURL(`**/m/${machineInitials}`, { timeout: 30_000 }),
      promoteDialog
        .getByRole("button", { name: /Promote and assign/i })
        .click(),
    ]);

    await expect(
      page.getByRole("heading", { name: machineName })
    ).toBeVisible();

    // Verify the user was promoted from guest → member in the database
    expect(await getUserRole(guestUser.id)).toBe("member");
  });

  test("create flow: search bypasses 'show hidden' filter for guests/invited", async ({
    page,
  }) => {
    const testId = Math.random().toString(36).substring(7);
    const guestEmail = `guest-search-${testId}@example.com`;
    const guestFirstName = "Guest";
    const guestLastName = `Search${testId}`;
    const guestFullName = `${guestFirstName} ${guestLastName}`;

    testEmails.add(guestEmail);

    const guestUser = await createTestUser(guestEmail, "TestPassword123", {
      firstName: guestFirstName,
      lastName: guestLastName,
    });
    createdUserIds.push(guestUser.id);
    expect(await getUserRole(guestUser.id)).toBe("guest");

    await page.goto("/m/new");

    // Confirm "Show guests and invited users" is unchecked (default state)
    const showHiddenCheckbox = page.getByTestId("owner-show-hidden-checkbox");
    await expect(showHiddenCheckbox).not.toBeChecked();

    const ownerSelect = page.getByTestId("owner-select");

    // Type the guest's last name into the search input — this bypasses the
    // "show hidden" filter and should surface guests/invited users that match.
    // The checkbox stays unchecked the entire time, proving search bypass works.
    await page.getByTestId("owner-search-input").fill(guestLastName);

    // Open the dropdown — guest should now appear via the search bypass
    await ownerSelect.click();
    await expect(
      page.getByRole("option", { name: new RegExp(guestFullName) })
    ).toBeVisible();

    // Sanity check — checkbox is still unchecked, proving the bypass came
    // from the search input, not from a state change.
    await expect(showHiddenCheckbox).not.toBeChecked();
  });

  test("update flow: assigning a guest opens promote dialog and promotes on confirm", async ({
    page,
  }) => {
    const testId = Math.random().toString(36).substring(7);
    const guestEmail = `guest-update-${testId}@example.com`;
    const guestFirstName = "Guest";
    const guestLastName = `Update${testId}`;
    const guestFullName = `${guestFirstName} ${guestLastName}`;

    // Pre-existing admin-owned machine (admin will reassign to the guest).
    // We can't use createTestMachine because it auto-promotes the owner;
    // instead, we create the guest, then create a machine via the UI as
    // admin (admin is already member+ via storage state setup).
    const adminOwnerMachineInitials = `PU${testId.toUpperCase()}`.substring(
      0,
      5
    );
    const machineName = `Promote Update ${testId}`;

    testEmails.add(guestEmail);
    testMachines.add(adminOwnerMachineInitials);

    const guestUser = await createTestUser(guestEmail, "TestPassword123", {
      firstName: guestFirstName,
      lastName: guestLastName,
    });
    createdUserIds.push(guestUser.id);
    expect(await getUserRole(guestUser.id)).toBe("guest");

    // Create a machine via the UI (admin owns it by default — no promotion)
    await page.goto("/m/new");
    await page.getByLabel(/Initials/i).fill(adminOwnerMachineInitials);
    await page.getByLabel(/Machine Name/i).fill(machineName);
    await page.getByRole("button", { name: /Create Machine/i }).click();
    await expect(page).toHaveURL(`/m/${adminOwnerMachineInitials}`);

    // Open the edit dialog
    await page.getByTestId("edit-machine-button").click();
    await expect(
      page.getByRole("heading", { name: /Edit Machine/i })
    ).toBeVisible();

    // Reveal guests in the owner picker, then select the guest
    await page.getByTestId("owner-show-hidden-checkbox").click();
    const ownerSelect = page.getByTestId("owner-select");
    await ownerSelect.click();
    await page
      .getByRole("option", { name: new RegExp(guestFullName) })
      .click({ force: true });
    await expect(ownerSelect).toContainText(guestFullName);
    await expect(ownerSelect).toContainText("(Guest)");

    // Submit — server returns ASSIGNEE_NOT_MEMBER → promote dialog opens
    await page.getByRole("button", { name: /Update Machine/i }).click();

    const promoteDialog = page.getByRole("dialog", {
      name: /Promote to member and assign/i,
    });
    await expect(promoteDialog).toBeVisible();
    await expect(promoteDialog).toContainText(guestFullName);

    // Confirm promotion + assignment
    await promoteDialog
      .getByRole("button", { name: /Promote and assign/i })
      .click();

    // Edit dialog should close after successful update
    await expect(
      page.getByRole("heading", { name: /Edit Machine/i })
    ).not.toBeVisible({ timeout: 10_000 });

    // Verify the user was promoted from guest → member
    expect(await getUserRole(guestUser.id)).toBe("member");
  });
});
