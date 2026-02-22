/**
 * E2E Smoke Test: Machine Creation with Inline Invitation
 *
 * Verifies that an admin can create a machine and invite a new owner
 * from within the creation dialog, and that the new owner is auto-selected.
 */

import { test, expect } from "@playwright/test";
import { ensureLoggedIn } from "../support/actions.js";
import { cleanupTestEntities } from "../support/cleanup.js";
import { TEST_USERS } from "../support/constants.js";

const testMachines = new Set<string>();
const testEmails = new Set<string>();

test.describe("Machine with Inline Invite (Smoke)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }, testInfo) => {
    await ensureLoggedIn(page, testInfo, {
      email: TEST_USERS.admin.email,
      password: TEST_USERS.admin.password,
    });
  });

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

  test("should allow inviting a new user while creating a machine", async ({
    page,
  }) => {
    const testId = Math.random().toString(36).substring(7);
    const machineInitials = `SMK${testId.toUpperCase()}`.substring(0, 5);
    const userEmail = `smoke-invite-${testId}@example.com`;
    const userName = `Smoke User ${testId}`;

    testMachines.add(machineInitials);
    testEmails.add(userEmail);

    await page.route("**/api/opdb/search**", async (route) => {
      const url = new URL(route.request().url());
      const query = url.searchParams.get("q") ?? "";
      if (query.toLowerCase().includes("medieval")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            results: [
              {
                id: "G43W4-MrRpw",
                title: "Medieval Madness",
                manufacturer: "Williams",
                year: 1997,
                label: "Medieval Madness (Williams, 1997)",
              },
            ],
          }),
        });
        return;
      }

      if (query.toLowerCase().includes("attack")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            results: [
              {
                id: "G5K2X-N8vQs",
                title: "Attack from Mars",
                manufacturer: "Bally",
                year: 1995,
                label: "Attack from Mars (Bally, 1995)",
              },
            ],
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ results: [] }),
      });
    });

    await page.goto("/m/new");

    // 1. Fill machine details
    await page.getByLabel(/Initials/i).fill(machineInitials);

    await page.getByTestId("opdb-model-search-input").fill("Medieval");
    await page.getByTestId("opdb-model-result-0").click();
    await expect(page.getByLabel(/Machine Name/i)).toHaveValue(
      "Medieval Madness"
    );

    // 2. Click "+ Invite New"
    await page.getByRole("button", { name: /Invite New/i }).click();

    // 3. Fill Invite Dialog
    await expect(
      page.getByRole("heading", { name: /Invite New User/i })
    ).toBeVisible();
    await page.getByLabel(/First Name/i).fill("Smoke");
    await page.getByLabel(/Last Name/i).fill(`User ${testId}`);
    await page.getByRole("textbox", { name: "Email" }).fill(userEmail);

    // Ensure "Send invitation email" is unchecked for smoke test to avoid Mailpit dep if it's slow
    // (Though it's usually fine, we can toggle it to test the switch too)
    const inviteSwitch = page.getByRole("switch", {
      name: /Send invitation email/i,
    });
    if ((await inviteSwitch.getAttribute("aria-checked")) === "true") {
      await inviteSwitch.click();
    }

    await page
      .getByRole("button", { name: /Invite User/i, includeHidden: false })
      .click();

    // 4. Wait for dialog to close and verify auto-selection
    await expect(page.getByRole("dialog")).not.toBeVisible();

    // Verify the Select component shows the new user
    const ownerSelect = page.getByRole("combobox", { name: /Machine Owner/i });
    await expect(ownerSelect).toContainText(userName);
    await expect(ownerSelect).toContainText("(Invited)");

    // 5. Submit machine creation
    await page.getByLabel(/Initials/i).fill(machineInitials);
    await page.getByRole("button", { name: /Create Machine/i }).click();

    // 6. Verify redirect and owner assignment
    await expect(page).toHaveURL(`/m/${machineInitials}`);
    await expect(
      page.getByRole("heading", { name: "Medieval Madness" })
    ).toBeVisible();

    // 7. Edit machine and change OPDB model
    await page.getByTestId("edit-machine-button").click();
    await page.getByTestId("opdb-model-search-input").fill("Attack");
    await page.getByTestId("opdb-model-result-0").click();
    await expect(page.getByLabel(/Machine Name/i)).toHaveValue(
      "Attack from Mars"
    );
    await page.getByRole("button", { name: /Update Machine/i }).click();

    await expect(
      page.getByRole("heading", { name: "Attack from Mars" })
    ).toBeVisible();
  });
});
