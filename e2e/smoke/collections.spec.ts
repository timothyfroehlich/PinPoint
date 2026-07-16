/**
 * E2E Tests: Personal collections (PP-wqit.1, Wave 0a)
 *
 * Smoke coverage for the private, owner-only collections flow: create a
 * collection from the "My Collections" list, add a machine via the owner
 * multi-select, and confirm the Overview / Issues / Timeline tabs render
 * without 500. Also asserts a freshly-created (empty) collection shows its
 * empty state. "Renders without 500" smoke — deeper behavior is covered by
 * integration tests (collections-actions / collections-user).
 *
 * Fixtures: the seeded member owns Slick Chick (SC) — see the collection-view
 * spec — so it's a stable choice for the add-machine step.
 */

import { test, expect } from "@playwright/test";
import { STORAGE_STATE } from "../support/auth-state.js";
import { getTestPrefix } from "../support/test-isolation.js";

test.describe("Personal collections (PP-wqit.1)", () => {
  test.use({ storageState: STORAGE_STATE.member });

  test("create a collection, add a machine, and browse its tabs", async ({
    page,
  }) => {
    const name = `${getTestPrefix()} Faves`;

    // Reach "My Collections" via the user menu.
    await page.goto("/");
    await page.getByTestId("user-menu-button").click();
    await page.getByTestId("user-menu-my-collections").click();
    await expect(page).toHaveURL(/\/c\/collections$/);

    // Create a collection via the "New collection" modal — redirects to its view.
    await page.getByTestId("create-collection-trigger").click();
    await page.getByLabel("Name").fill(name);
    await page.getByTestId("create-collection-submit").click();
    await expect(page).toHaveURL(/\/c\/collection\//);

    // Fresh collection is empty — the owner sees the inline add-machines picker.
    await expect(
      page.getByText("This collection is empty. Add machines to get started.")
    ).toBeVisible();

    // Add a machine via the inline empty-state picker.
    await page.getByTestId("collection-machines-multiselect").click();
    await page.getByPlaceholder("Search machines…").fill("Slick Chick");
    await page.getByRole("option", { name: /Slick Chick/ }).click();
    await page.keyboard.press("Escape"); // close the multi-select popover
    await page.getByTestId("collection-add-machines").click();

    // Overview now renders the machine table.
    await expect(page.getByTestId("collection-overview-body")).toBeVisible();
    await expect(page.getByTestId("collection-summary")).toBeVisible();

    // Issues and Timeline tabs render without 500.
    await page.getByTestId("collection-tab-issues").click();
    await expect(page).toHaveURL(/\/issues$/);
    await expect(page.getByTestId("collection-summary")).toBeVisible();

    await page.getByTestId("collection-tab-timeline").click();
    await expect(page).toHaveURL(/\/timeline$/);
    await expect(page.getByTestId("collection-summary")).toBeVisible();
  });
});
