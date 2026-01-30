import { test, expect } from "@playwright/test";
import { ensureLoggedIn } from "./support/actions";
import { seededMachines } from "./support/constants";

test.describe("Machine Filtering and Sorting", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await ensureLoggedIn(page, testInfo);
  });

  test("user can search and filter machines", async ({ page }) => {
    // Navigate to machines page
    await page.goto("/m");
    await expect(page.getByRole("heading", { name: "Machines" })).toBeVisible();

    // 1. Test Search by Initials
    const searchInput = page.getByPlaceholder(
      "Search machines by name or initials..."
    );
    await searchInput.fill(seededMachines.attackFromMars.initials);
    // Wait for debounce
    await page.waitForTimeout(500);

    await expect(
      page.getByText(seededMachines.attackFromMars.name)
    ).toBeVisible();
    await expect(
      page.getByText(seededMachines.medievalMadness.name)
    ).not.toBeVisible();
    await expect(
      page.getByText(seededMachines.addamsFamily.name)
    ).not.toBeVisible();

    // 2. Test Search by Name
    await searchInput.fill("Medieval");
    await page.waitForTimeout(500);

    await expect(
      page.getByText(seededMachines.medievalMadness.name)
    ).toBeVisible();
    await expect(
      page.getByText(seededMachines.attackFromMars.name)
    ).not.toBeVisible();

    // 3. Test Clear Search
    await page.getByRole("button", { name: "Clear All" }).click();
    await expect(
      page.getByText(seededMachines.attackFromMars.name)
    ).toBeVisible();
    await expect(
      page.getByText(seededMachines.medievalMadness.name)
    ).toBeVisible();

    // 4. Test Sorting UI
    await page.getByRole("button", { name: "Name (A-Z)" }).click();
    await expect(
      page.getByRole("menuitem", { name: "Name (Z-A)" })
    ).toBeVisible();
    await expect(
      page.getByRole("menuitem", { name: "Open Issues (Most)" })
    ).toBeVisible();

    // Test selecting a sort option
    await page.getByRole("menuitem", { name: "Open Issues (Most)" }).click();
    await expect(
      page.getByRole("button", { name: "Open Issues (Most)" })
    ).toBeVisible();
  });
});
