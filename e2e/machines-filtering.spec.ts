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

    // Wait for debounce via URL check (semantic wait)
    await expect(page).toHaveURL(
      new RegExp(`q=${seededMachines.attackFromMars.initials}`)
    );

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
    // Wait for debounce via URL check (semantic wait)
    await expect(page).toHaveURL(/q=Medieval/);

    await expect(
      page.getByText(seededMachines.medievalMadness.name)
    ).toBeVisible();
    await expect(
      page.getByText(seededMachines.attackFromMars.name)
    ).not.toBeVisible();

    // 3. Test Clear Search
    await page.getByRole("button", { name: "Clear All" }).click();
    await expect(page).not.toHaveURL(/q=/);
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

  test("user can filter machines by status", async ({ page }) => {
    await page.goto("/m");
    await expect(page.getByRole("heading", { name: "Machines" })).toBeVisible();

    // Open Status filter dropdown (MultiSelect button containing "Status" text)
    const statusFilter = page
      .getByRole("combobox")
      .filter({ hasText: "Status" });
    await statusFilter.click();

    // Select "Unplayable" status from the dropdown
    await page.getByRole("option", { name: "Unplayable" }).click();

    // Close the dropdown
    await page.keyboard.press("Escape");

    // Wait for URL to update with status filter
    await expect(page).toHaveURL(/status=unplayable/);

    // Eight Ball Deluxe should be visible (it has an unplayable issue)
    await expect(
      page.getByRole("link", { name: /Eight Ball Deluxe/i })
    ).toBeVisible();

    // Machines without unplayable status should not be visible
    await expect(
      page.getByRole("link", { name: /Attack from Mars/i })
    ).not.toBeVisible();
    await expect(
      page.getByRole("link", { name: /Medieval Madness/i })
    ).not.toBeVisible();

    // Verify filter badge appears (shows count)
    await expect(statusFilter.getByText("1")).toBeVisible();
  });

  test("user can filter machines by owner", async ({ page }) => {
    await page.goto("/m");
    await expect(page.getByRole("heading", { name: "Machines" })).toBeVisible();

    // Open Owner filter dropdown
    const ownerFilter = page.getByRole("combobox").filter({ hasText: "Owner" });
    await ownerFilter.click();

    // Select "Member User" as owner
    await page.getByRole("option", { name: "Member User" }).click();

    // Close the dropdown
    await page.keyboard.press("Escape");

    // Wait for URL to update with owner filter
    await expect(page).toHaveURL(/owner=/);

    // Member owns: Slick Chick, Eight Ball Deluxe, Attack from Mars
    await expect(
      page.getByRole("link", { name: /Eight Ball Deluxe/i })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Attack from Mars/i })
    ).toBeVisible();

    // Admin-owned machines should not be visible
    await expect(
      page.getByRole("link", { name: /Medieval Madness/i })
    ).not.toBeVisible();
    await expect(
      page.getByRole("link", { name: /Godzilla/i })
    ).not.toBeVisible();
  });

  test("user can combine multiple filters", async ({ page }) => {
    await page.goto("/m");
    await expect(page.getByRole("heading", { name: "Machines" })).toBeVisible();

    // First apply search filter
    const searchInput = page.getByPlaceholder(
      "Search machines by name or initials..."
    );
    await searchInput.fill("Ball");
    await expect(page).toHaveURL(/q=Ball/);

    // Then apply status filter
    const statusFilter = page
      .getByRole("combobox")
      .filter({ hasText: "Status" });
    await statusFilter.click();
    await page.getByRole("option", { name: "Unplayable" }).click();
    await page.keyboard.press("Escape");

    // Wait for both filters in URL
    await expect(page).toHaveURL(/q=Ball/);
    await expect(page).toHaveURL(/status=unplayable/);

    // Only Eight Ball Deluxe matches both "Ball" search AND "Unplayable" status
    await expect(
      page.getByRole("link", { name: /Eight Ball Deluxe/i })
    ).toBeVisible();

    // Fireball matches "Ball" but isn't unplayable
    await expect(
      page.getByRole("link", { name: /Fireball/i })
    ).not.toBeVisible();
  });

  test("user can clear filters via Clear All button", async ({ page }) => {
    await page.goto("/m");

    // Apply a status filter
    const statusFilter = page
      .getByRole("combobox")
      .filter({ hasText: "Status" });
    await statusFilter.click();
    await page.getByRole("option", { name: "Unplayable" }).click();
    await page.keyboard.press("Escape");

    await expect(page).toHaveURL(/status=unplayable/);

    // Only Eight Ball Deluxe should be visible before clearing
    await expect(
      page.getByRole("link", { name: /Eight Ball Deluxe/i })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Attack from Mars/i })
    ).not.toBeVisible();

    // Click Clear All
    await page.getByRole("button", { name: "Clear All" }).click();

    // URL should no longer have the specific unplayable filter
    await expect(page).not.toHaveURL(/status=unplayable/);

    // All machines should be visible again
    await expect(
      page.getByRole("link", { name: /Attack from Mars/i })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Medieval Madness/i })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Eight Ball Deluxe/i })
    ).toBeVisible();
  });
});
