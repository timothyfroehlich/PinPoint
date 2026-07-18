/**
 * E2E: Collection edit sharing via account collaborators (PP-wqit.7).
 *
 * Full journey: the owner (Member User) grants Technician User editor access;
 * the editor sees the collection under "Shared with you" and can edit its
 * machines but not delete/share; the owner revokes; the editor loses access.
 *
 * Two seeded accounts drive this — the owner runs in the file's default
 * `member` storageState; the editor runs in a second `technician` context.
 */

import { test, expect } from "@playwright/test";
import { STORAGE_STATE } from "../support/auth-state.js";
import { getTestPrefix } from "../support/test-isolation.js";

const EDITOR_NAME = "Technician User";

test.describe("Collection edit sharing (PP-wqit.7)", () => {
  test.use({ storageState: STORAGE_STATE.member });

  test("owner grants an editor, editor edits, owner revokes", async ({
    page,
    browser,
  }) => {
    const name = `${getTestPrefix()} EditShare`;

    // --- Owner creates a collection with one machine ----------------------
    await page.goto("/c/collections");
    await page.getByTestId("create-collection-trigger").click();
    await page.getByLabel("Name").fill(name);
    await page.getByTestId("create-collection-submit").click();
    await expect(page).toHaveURL(/\/c\/[0-9a-f-]{36}/);
    const collectionUrl = page.url();

    await page.getByTestId("collection-machines-multiselect").click();
    await page.getByPlaceholder("Search machines…").fill("Slick Chick");
    await page.getByRole("option", { name: /Slick Chick/ }).click();
    await page.keyboard.press("Escape");
    await page.getByTestId("collection-add-machines").click();
    await expect(page.getByTestId("collection-overview-body")).toBeVisible();

    // --- Owner grants Technician User editor access -----------------------
    await page.getByTestId("collection-share-trigger").click();
    await page.getByTestId("collab-add-trigger").click();
    await page.getByPlaceholder("Search members…").fill("Technician");
    await page.getByRole("option", { name: new RegExp(EDITOR_NAME) }).click();
    // The editor now appears in the People-with-access list.
    await expect(page.getByLabel(`Remove ${EDITOR_NAME}`)).toBeVisible();
    await page.keyboard.press("Escape"); // close the Share dialog

    // --- Editor sees it under "Shared with you" and can edit --------------
    const editorCtx = await browser.newContext({
      storageState: STORAGE_STATE.technician,
    });
    try {
      const ed = await editorCtx.newPage();
      await ed.goto("/c/collections");
      await expect(
        ed.getByRole("heading", { name: "Shared with you" })
      ).toBeVisible();
      // Scope every assertion to THIS run's uniquely-named row — parallel
      // workers each create a Member-User-owned "…EditShare" collection, so a
      // global getByText("Shared by Member User") is a strict-mode violation.
      const sharedLink = ed.getByRole("link", { name: new RegExp(name) });
      await expect(sharedLink).toBeVisible();
      await expect(sharedLink).toContainText("Shared by Member User");
      await expect(sharedLink).toContainText("Editor");

      await sharedLink.click();
      await expect(ed).toHaveURL(/\/c\/[0-9a-f-]{36}/);
      // Editor gets the Edit control but NOT Share (owner-only).
      await expect(ed.getByTestId("collection-edit-trigger")).toBeVisible();
      await expect(ed.getByTestId("collection-share-trigger")).toHaveCount(0);

      // Editor adds a machine and saves; no Delete control is present.
      await ed.getByTestId("collection-edit-trigger").click();
      await expect(ed.getByTestId("collection-delete-trigger")).toHaveCount(0);
      await ed.getByTestId("collection-machines-multiselect").click();
      await ed.getByPlaceholder("Search machines…").fill("Fireball");
      await ed.getByRole("option", { name: /Fireball/ }).click();
      await ed.keyboard.press("Escape");
      await ed.getByTestId("collection-save").click();
      const overview = ed.getByTestId("collection-overview-body");
      await expect(overview).toBeVisible();
      await expect(overview.getByText(/Fireball/)).toBeVisible();
    } finally {
      await editorCtx.close();
    }

    // --- Owner revokes access ---------------------------------------------
    await page.goto(collectionUrl);
    await page.getByTestId("collection-share-trigger").click();
    await page.getByLabel(`Remove ${EDITOR_NAME}`).click();
    await expect(page.getByLabel(`Remove ${EDITOR_NAME}`)).toHaveCount(0);
    await page.keyboard.press("Escape");

    // --- Revoked editor can no longer reach it ----------------------------
    const revokedCtx = await browser.newContext({
      storageState: STORAGE_STATE.technician,
    });
    try {
      const rv = await revokedCtx.newPage();
      await rv.goto("/c/collections");
      await expect(
        rv.getByRole("link", { name: new RegExp(name) })
      ).toHaveCount(0);
      // Direct navigation 404s (a uuid is not a capability for a non-collaborator).
      await rv.goto(collectionUrl);
      await expect(rv.getByTestId("collection-overview-body")).toHaveCount(0);
    } finally {
      await revokedCtx.close();
    }
  });
});
