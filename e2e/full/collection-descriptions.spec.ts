/**
 * E2E Tests: Collection descriptions (PP-wqit.11)
 *
 * Journey for spec collections-and-tags 2.8 and 4.7: the owner writes a
 * description in the Edit dialog, it shows under the header on every tab
 * clamped to three lines with Show more, a View Link visitor sees it too, and
 * clearing it removes it. Validation, normalization and permissions are
 * covered by src/test/integration/collections-actions.test.ts.
 */

import { test, expect, attachHydrationWait } from "../support/fixtures.js";
import { STORAGE_STATE } from "../support/auth-state.js";
import { getTestPrefix } from "../support/test-isolation.js";

// Long enough to run past three lines at the description's 768px max width.
const DESCRIPTION =
  "The machines we put in front of players for the monthly tournament and the Thursday league. " +
  "Everything in this bank should be tournament-ready before each event: fresh rubbers, a level playfield, and tilt set to the league standard. " +
  "Report problems with the Tournament tag so the tournament director sees them first, and tell the director before swapping a machine out of the bank. " +
  "Backups, in order, are the machines listed on the league page. Ask in the league channel if a machine here is missing or out of order.";

test.describe("Collection descriptions (PP-wqit.11)", () => {
  test.use({ storageState: STORAGE_STATE.member });

  test("the owner describes a collection and everyone who can open it sees the description", async ({
    page,
    browser,
  }) => {
    const name = `${getTestPrefix()} Described`;

    // Create the collection (same retry-with-fill pattern as
    // e2e/smoke/collections.spec.ts, PP-2b3r) and give it a machine.
    await page.goto("/c/collections");
    await expect(async () => {
      await page.keyboard.press("Escape");
      await page.getByTestId("create-collection-trigger").click();
      const nameField = page.getByLabel("Name");
      await expect(nameField).toBeVisible({ timeout: 5_000 });
      await nameField.fill(name);
    }).toPass({ timeout: 15_000 });
    await page.getByTestId("create-collection-submit").click();
    await expect(page).toHaveURL(/\/c\/[0-9a-f-]{36}/);
    const collectionUrl = page.url();
    await page.getByTestId("collection-machines-multiselect").click();
    await page.getByPlaceholder("Search machines…").fill("Attack from Mars");
    await page.getByRole("option", { name: /Attack from Mars/ }).click();
    await page.keyboard.press("Escape");
    await page.getByTestId("collection-add-machines").click();
    await expect(
      page.getByRole("link", { name: "Attack from Mars", exact: true })
    ).toBeVisible();

    // No description yet: nothing under the header (4.7).
    await expect(page.getByTestId("collection-description")).toHaveCount(0);

    // Write one in the Edit dialog.
    await page.getByTestId("collection-edit-trigger").click();
    const dialog = page.getByRole("dialog", { name: "Edit collection" });
    const editor = dialog.getByRole("textbox", { name: "Description" });
    await editor.click();
    await page.keyboard.type(DESCRIPTION);
    await dialog.getByTestId("collection-save").click();
    await expect(dialog).toBeHidden();

    // Shown under the header, clamped with Show more.
    const description = page.getByTestId("collection-description");
    await expect(description).toContainText("tournament-ready");
    const showMore = description.getByRole("button", { name: "Show more" });
    await expect(showMore).toBeVisible();
    await showMore.click();
    await expect(
      description.getByRole("button", { name: "Show less" })
    ).toHaveAttribute("aria-expanded", "true");

    // Every tab, not just Overview.
    await page.getByTestId("collection-tab-issues").click();
    await expect(page).toHaveURL(/\/issues$/);
    await expect(page.getByTestId("collection-description")).toContainText(
      "tournament-ready"
    );

    // A View Link visitor sees it too.
    await page.goto(collectionUrl);
    await page.getByTestId("collection-share-trigger").click();
    await page.getByTestId("collection-share-toggle").click();
    const shareUrl = await page
      .getByTestId("collection-share-url")
      .inputValue();
    await page.keyboard.press("Escape");
    const anon = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    });
    try {
      const anonPage = attachHydrationWait(await anon.newPage());
      await anonPage.goto(shareUrl);
      await expect(
        anonPage.getByTestId("collection-description")
      ).toContainText("tournament-ready");
    } finally {
      await anon.close();
    }

    // Clearing the description removes it.
    await page.getByTestId("collection-edit-trigger").click();
    await dialog.getByRole("textbox", { name: "Description" }).click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.press("Backspace");
    await dialog.getByTestId("collection-save").click();
    await expect(dialog).toBeHidden();
    await expect(page.getByTestId("collection-description")).toHaveCount(0);
  });
});
