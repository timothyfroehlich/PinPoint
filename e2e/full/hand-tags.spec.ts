/**
 * E2E: hand-applied tags managed from the tag pages (PP-wqit.3, spec
 * collections-and-tags §11).
 *
 * The journey crosses four page renders — tag browse, tag type page, tag page,
 * machine Info tab — so it belongs here rather than in an integration test.
 * Action wiring, permissions, and exclusivity rules are covered in
 * src/test/integration/tag-actions.test.ts and hand-tags.test.ts.
 *
 * Isolation: the tag type, its tag, and the machine are created per run and
 * removed in afterAll; the read-only checks use seeded tags and never mutate
 * them.
 */

import { test, expect } from "../support/fixtures.js";
import { assertNoA11yViolations } from "../support/actions.js";
import { STORAGE_STATE } from "../support/auth-state.js";
import { TEST_USERS } from "../support/constants.js";
import {
  createTestMachine,
  deleteTestMachine,
  deleteTestTagType,
  getProfileIdByEmail,
} from "../support/supabase-admin.js";
import { getTestPrefix } from "../support/test-isolation.js";

test.describe("Hand-applied tags", () => {
  test.describe("technician", () => {
    test.use({ storageState: STORAGE_STATE.technician });

    // Names are capped at 20 characters; the prefix is ~7.
    const typeName = `Zone ${getTestPrefix()}`;
    const tagName = `Bay ${getTestPrefix()}`;
    let machine: { id: string; initials: string; name: string } | null = null;

    test.beforeAll(async () => {
      const ownerId = await getProfileIdByEmail(TEST_USERS.admin.email);
      machine = await createTestMachine(ownerId);
    });

    test.afterAll(async () => {
      await deleteTestTagType(typeName).catch(() => undefined);
      if (machine) await deleteTestMachine(machine.id).catch(() => undefined);
    });

    test("creates an exclusive tag type and tag, tags a machine, deletes the type", async ({
      page,
    }) => {
      if (!machine) throw new Error("Test machine was not created");
      const { initials, name: machineName } = machine;

      // --- Tag browse: Add tag type (exclusive) ---------------------------
      await page.goto("/c/tags");
      await expect(
        page.getByRole("heading", { level: 1, name: "Tags" })
      ).toBeVisible();
      await page.getByRole("button", { name: "Add tag type" }).click();
      const typeDialog = page.getByRole("dialog", { name: "Add tag type" });
      await expect(typeDialog).toBeVisible();
      await assertNoA11yViolations(page);
      await typeDialog.getByLabel("Name").fill(typeName);
      await typeDialog.getByLabel("One per machine").check();
      await typeDialog.getByRole("button", { name: "Add tag type" }).click();
      await expect(typeDialog).toBeHidden();

      // The new type's card links to its page.
      const typeLink = page.getByRole("link", { name: typeName, exact: true });
      await expect(typeLink).toBeVisible();
      await typeLink.click();
      await expect(
        page.getByRole("heading", { level: 1, name: typeName })
      ).toBeVisible();
      await expect(page.getByText("One per machine").first()).toBeVisible();

      // --- Tag type page: Add tag ------------------------------------------
      await page.getByRole("button", { name: "Add tag" }).click();
      const tagDialog = page.getByRole("dialog", {
        name: `Add tag to ${typeName}`,
      });
      await tagDialog.getByLabel("Name").fill(tagName);
      await tagDialog.getByRole("button", { name: "Add tag" }).click();
      await expect(tagDialog).toBeHidden();

      const tagLink = page.getByRole("link", { name: new RegExp(tagName) });
      await expect(tagLink).toContainText("No machines");
      await tagLink.click();

      // --- Tag page: Edit machines -----------------------------------------
      await expect(
        page.getByRole("heading", { level: 1, name: tagName })
      ).toBeVisible();
      await page.getByRole("button", { name: "Edit machines" }).click();
      const machinesDialog = page.getByRole("dialog", {
        name: `Machines in ${tagName}`,
      });
      await machinesDialog.getByLabel("Find a machine").fill(initials);
      await machinesDialog
        .getByRole("checkbox", { name: new RegExp(machineName) })
        .check();
      await expect(machinesDialog.getByText("Adds 1 machine")).toBeVisible();
      await machinesDialog
        .getByRole("button", { name: "Add 1 machine" })
        .click();
      await expect(machinesDialog).toBeHidden();

      const machineLink = page
        .getByRole("link", { name: new RegExp(machineName) })
        .first();
      await expect(machineLink).toBeVisible();
      const tagPageUrl = new URL(page.url()).pathname;

      // --- Machine Info tab: the tag links back to its page ----------------
      await page.goto(`/m/${initials}`);
      const tagsCard = page.getByTestId("machine-tags");
      const infoTagLink = tagsCard.getByRole("link", {
        name: tagName,
        exact: true,
      });
      await expect(infoTagLink).toHaveAttribute("href", tagPageUrl);

      // --- Delete the tag type from its page -------------------------------
      // The tag lives at /c/tags/<type-slug>/<tag-slug>.
      await page.goto(tagPageUrl.slice(0, tagPageUrl.lastIndexOf("/")));
      await expect(
        page.getByRole("heading", { level: 1, name: typeName })
      ).toBeVisible();
      await page.getByRole("button", { name: "Tag type actions" }).click();
      await page.getByRole("menuitem", { name: "Delete tag type…" }).click();
      const confirm = page.getByRole("alertdialog", {
        name: `Delete ${typeName}?`,
      });
      await confirm.getByRole("button", { name: "Delete tag type" }).click();

      await expect(page).toHaveURL(/\/c\/tags$/);
      await expect(
        page.getByRole("heading", { level: 1, name: "Tags" })
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: typeName, exact: true })
      ).toHaveCount(0);

      // The machine no longer carries the deleted type's tag.
      await page.goto(`/m/${initials}`);
      await expect(
        page.getByTestId("machine-tags").getByRole("link", { name: tagName })
      ).toHaveCount(0);
    });
  });

  test.describe("member", () => {
    test.use({ storageState: STORAGE_STATE.member });

    test("sees the tag browse without Add tag type", async ({ page }) => {
      await page.goto("/c/tags");
      await expect(page.getByRole("link", { name: "Location" })).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Add tag type" })
      ).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Add tag" })).toHaveCount(
        0
      );
    });
  });

  test.describe("anonymous visitor", () => {
    test("opens a hand-applied tag page without management controls", async ({
      page,
    }) => {
      await page.goto("/c/tags/location/front-room");
      await expect(page).toHaveURL(/\/c\/tags\/location\/front-room$/);
      await expect(
        page.getByRole("heading", { level: 1, name: "Front room" })
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Edit machines" })
      ).toHaveCount(0);
      await expect(
        page.getByRole("button", { name: "Tag actions" })
      ).toHaveCount(0);

      await page.goto("/c/tags/location");
      await expect(
        page.getByRole("heading", { level: 1, name: "Location" })
      ).toBeVisible();
      await expect(page.getByRole("button", { name: "Add tag" })).toHaveCount(
        0
      );
      await expect(
        page.getByRole("button", { name: "Tag type actions" })
      ).toHaveCount(0);
    });
  });
});
