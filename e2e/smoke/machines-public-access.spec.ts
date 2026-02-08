/**
 * Smoke Test: Public Machine Access
 *
 * Tests that unauthenticated users can view the machines list.
 * Verifies the "Add Machine" button is NOT visible to unauthenticated users.
 *
 * This test ensures the public routes for machines are working correctly
 * per the permission model: machines.view is public, machines.create is admin-only.
 */

import { test, expect } from "@playwright/test";
import { seededMachines } from "../support/constants";

test.describe("Machines Public Access", () => {
  test("unauthenticated user can view machines list", async ({ page }) => {
    // Do NOT log in - verify anonymous access
    await page.goto("/m");

    // Verify we're on the machines page (no redirect to login)
    await expect(page).toHaveURL("/m");
    await expect(page.getByRole("heading", { name: "Machines" })).toBeVisible();

    // Verify machines are displayed
    const machineCards = page.getByTestId("machine-card");
    const cardCount = await machineCards.count();
    expect(cardCount).toBeGreaterThan(0);

    // Verify status badges are visible (sanity check for machine list rendering)
    await expect(
      machineCards.first().getByText(/Operational|Needs Service|Unplayable/)
    ).toBeVisible();
  });

  test("unauthenticated user does NOT see Add Machine button", async ({
    page,
  }) => {
    await page.goto("/m");

    // Verify the "Add Machine" button is NOT visible to unauthenticated users
    await expect(
      page.getByRole("link", { name: /Add Machine/i })
    ).not.toBeVisible();

    // Verify no button exists in the page (not just hidden)
    const addButton = page.getByRole("link", { name: /Add Machine/i });
    expect(await addButton.count()).toBe(0);
  });

  test("unauthenticated user can view machine detail page", async ({
    page,
  }) => {
    // Navigate directly to a seeded machine detail page
    await page.goto(`/m/${seededMachines.medievalMadness.initials}`);

    // Verify we can see the machine detail without login redirect
    await expect(page).toHaveURL(
      `/m/${seededMachines.medievalMadness.initials}`
    );
    await expect(
      page.getByRole("heading", { name: seededMachines.medievalMadness.name })
    ).toBeVisible();

    // Verify machine information is displayed
    const machineCards = page.getByTestId("issue-card");
    const issueCount = await machineCards.count();
    expect(issueCount).toBeGreaterThan(0);
  });
});
