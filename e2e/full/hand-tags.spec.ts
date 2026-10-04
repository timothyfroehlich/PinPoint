/**
 * E2E: hand-applied tags managed from the tag pages and from a machine's page
 * (PP-wqit.3, spec collections-and-tags §11).
 *
 * The tag-page journey crosses four page renders — tag browse, tag type page,
 * tag page, machine Info tab — and the machine-page editor saves each click
 * through a Server Action and revalidates the Tags card behind it, so both
 * belong here rather than in an integration test. Action wiring, permissions,
 * and exclusivity rules are covered in src/test/integration/tag-actions.test.ts
 * and hand-tags.test.ts.
 *
 * Isolation: tag types, tags, and machines that a test changes are created per
 * run and removed in afterAll; the read-only checks use seeded tags and
 * machines and never mutate them.
 */

import { test, expect } from "../support/fixtures.js";
import {
  assertNoA11yViolations,
  assertNoHorizontalOverflow,
} from "../support/actions.js";
import { STORAGE_STATE } from "../support/auth-state.js";
import { seededMachines, TEST_USERS } from "../support/constants.js";
import {
  createTestMachine,
  createTestTagType,
  deleteTestMachine,
  deleteTestTagType,
  getProfileIdByEmail,
} from "../support/supabase-admin.js";
import { getTestPrefix } from "../support/test-isolation.js";

test.describe("Hand-applied tags", () => {
  test.describe("technician", () => {
    test.use({ storageState: STORAGE_STATE.technician });

    // Names are capped at 20 characters; the prefix is ~11.
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

test.describe("Machine tag editor", () => {
  const desktop = { width: 1280, height: 800 };
  /** Admin-owned and carries seeded hand-applied tags (seed-tags.mjs). */
  const seededInitials = seededMachines.medievalMadness.initials;

  /** A tag row's accessible name reads "<name>, <count> machines". */
  function tagRow(name: string): RegExp {
    return new RegExp(`^${name},`);
  }

  test.describe("technician", () => {
    test.use({ storageState: STORAGE_STATE.technician, viewport: desktop });

    const prefix = getTestPrefix();
    const openType = `Kit ${prefix}`;
    const lamp = `Lamp ${prefix}`;
    const exclusiveType = `Spot ${prefix}`;
    const left = `Left ${prefix}`;
    const right = `Right ${prefix}`;
    const created = `New ${prefix}`;
    let machine: { id: string; initials: string } | null = null;

    test.beforeAll(async () => {
      const ownerId = await getProfileIdByEmail(TEST_USERS.admin.email);
      machine = await createTestMachine(ownerId);
      await createTestTagType(openType, { exclusive: false, tags: [lamp] });
      await createTestTagType(exclusiveType, {
        exclusive: true,
        tags: [left, right],
      });
    });

    test.afterAll(async () => {
      await deleteTestTagType(openType).catch(() => undefined);
      await deleteTestTagType(exclusiveType).catch(() => undefined);
      if (machine) await deleteTestMachine(machine.id).catch(() => undefined);
    });

    test("applies, swaps, clears, and creates tags from the machine page", async ({
      page,
    }) => {
      if (!machine) throw new Error("Test machine was not created");
      await page.goto(`/m/${machine.initials}`);

      const tagsCard = page.getByTestId("machine-tags");
      const cardTag = (name: string) =>
        tagsCard.getByRole("link", { name, exact: true });
      const editor = page.getByRole("dialog", { name: "Edit tags" });

      // --- An open type: a checkbox, saved on click ------------------------
      await tagsCard.getByRole("button", { name: "Edit tags" }).click();
      await expect(editor).toBeVisible();
      await editor.getByRole("checkbox", { name: tagRow(lamp) }).check();
      await expect(editor.getByRole("status")).toHaveText("Saved");
      await editor.getByRole("button", { name: "Done" }).click();
      await expect(editor).toBeHidden();
      await expect(cardTag(lamp)).toBeVisible();

      // --- An exclusive type: one choice, then another, then None ----------
      await tagsCard.getByRole("button", { name: "Edit tags" }).click();
      const exclusiveGroup = editor.getByRole("group", {
        name: new RegExp(`^${exclusiveType}`),
      });
      await exclusiveGroup.getByRole("radio", { name: tagRow(left) }).check();
      await expect(cardTag(left)).toBeVisible();

      await exclusiveGroup.getByRole("radio", { name: tagRow(right) }).check();
      await expect(cardTag(right)).toBeVisible();
      await expect(cardTag(left)).toHaveCount(0);
      await expect(
        exclusiveGroup.getByRole("radio", { name: tagRow(left) })
      ).not.toBeChecked();

      await exclusiveGroup.getByRole("radio", { name: "None" }).check();
      await expect(cardTag(right)).toHaveCount(0);

      // --- Create a tag into a type while tagging ---------------------------
      await editor.getByLabel("Find or create a tag").fill(created);
      await editor
        .getByLabel("Tag type for the new tag")
        .selectOption({ label: openType });
      await editor.getByRole("button", { name: `Create “${created}”` }).click();
      await expect(
        editor
          .getByRole("group", { name: new RegExp(`^${openType}`) })
          .getByRole("checkbox", { name: tagRow(created) })
      ).toBeChecked();
      await expect(cardTag(created)).toBeVisible();
      await editor.getByRole("button", { name: "Done" }).click();
      await expect(editor).toBeHidden();

      // --- The saved set survives a fresh render ----------------------------
      await page.reload();
      await expect(cardTag(lamp)).toBeVisible();
      await expect(cardTag(created)).toBeVisible();
      await expect(cardTag(left)).toHaveCount(0);
      await expect(cardTag(right)).toHaveCount(0);
    });
  });

  test.describe("member", () => {
    test.use({ storageState: STORAGE_STATE.member, viewport: desktop });

    const prefix = getTestPrefix();
    const ownType = `Own ${prefix}`;
    const mine = `Mine ${prefix}`;
    let machine: { id: string; initials: string } | null = null;

    test.beforeAll(async () => {
      const ownerId = await getProfileIdByEmail(TEST_USERS.member.email);
      machine = await createTestMachine(ownerId);
      await createTestTagType(ownType, { exclusive: false, tags: [mine] });
    });

    test.afterAll(async () => {
      await deleteTestTagType(ownType).catch(() => undefined);
      if (machine) await deleteTestMachine(machine.id).catch(() => undefined);
    });

    test("tags a machine they own without creating tags; cannot tag others", async ({
      page,
    }) => {
      if (!machine) throw new Error("Test machine was not created");
      await page.goto(`/m/${machine.initials}`);

      const tagsCard = page.getByTestId("machine-tags");
      const editor = page.getByRole("dialog", { name: "Edit tags" });
      await tagsCard.getByRole("button", { name: "Edit tags" }).click();
      await expect(editor).toBeVisible();

      // Members find tags; only tags.manage holders may create one.
      const search = editor.getByLabel("Find a tag");
      await search.fill(`Nope ${prefix}`);
      await expect(editor.getByText("No matching tags")).toBeVisible();
      await expect(editor.getByRole("button", { name: /^Create/ })).toHaveCount(
        0
      );
      await search.fill("");

      await editor.getByRole("checkbox", { name: tagRow(mine) }).check();
      await expect(editor.getByRole("status")).toHaveText("Saved");
      await editor.getByRole("button", { name: "Done" }).click();
      await expect(editor).toBeHidden();
      await expect(
        tagsCard.getByRole("link", { name: mine, exact: true })
      ).toBeVisible();

      // A machine the member does not own shows its tags, not the editor.
      await page.goto(`/m/${seededInitials}`);
      await expect(page.getByTestId("machine-tags")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Edit tags", includeHidden: true })
      ).toHaveCount(0);
    });
  });

  test.describe("anonymous visitor", () => {
    test("sees a machine's tags without the editor", async ({ page }) => {
      await page.goto(`/m/${seededInitials}`);
      await expect(page.getByTestId("machine-tags")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Edit tags", includeHidden: true })
      ).toHaveCount(0);
    });
  });

  test.describe("phone", () => {
    // The narrowest review viewport (pinpoint-design-bible §4).
    test.use({
      storageState: STORAGE_STATE.technician,
      viewport: { width: 320, height: 568 },
    });

    test("collapses chips behind +N and edits in a bottom sheet", async ({
      page,
    }) => {
      await page.goto(`/m/${seededInitials}`);
      const tagsCard = page.getByTestId("machine-tags");
      const chips = tagsCard.getByRole("link");

      // One line of chips; the rest wait behind the "+N" chip.
      const more = tagsCard.getByRole("button", {
        name: /^Show \d+ more tags?$/,
      });
      await expect(more).toBeVisible();
      const total = await tagsCard
        .getByRole("link", { includeHidden: true })
        .count();
      const shown = await chips.count();
      expect(shown).toBeLessThan(total);
      await expect(more).toHaveText(`+${String(total - shown)}`);
      await assertNoHorizontalOverflow(page, {
        scopeTestIds: ["machine-tags"],
      });

      await more.click();
      await expect(more).toHaveCount(0);
      await expect(chips).toHaveCount(total);

      // The editor opens as a bottom sheet and closes with Done.
      await tagsCard.getByRole("button", { name: "Edit tags" }).click();
      const sheet = page.getByRole("dialog", { name: "Edit tags" });
      await expect(sheet).toBeVisible();
      await expect(sheet.getByLabel("Find or create a tag")).toBeVisible();
      await assertNoA11yViolations(page);
      await sheet.getByRole("button", { name: "Done" }).click();
      await expect(sheet).toBeHidden();
    });
  });
});
