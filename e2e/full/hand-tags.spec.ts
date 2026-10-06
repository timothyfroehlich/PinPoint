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
 * Changing a tag type's one-per-machine setting and moving a tag between tag
 * types (PP-wqit.4, §11.7 and §11.16) are covered as journeys too: each
 * dialog reads what blocks it when the page renders, so the tests clear or
 * create the blocker on one page and check the dialog on the next.
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
  addTestMachineTags,
  createTestMachine,
  createTestTagType,
  deleteTestMachine,
  deleteTestTagType,
  getProfileIdByEmail,
  testTagSlug,
} from "../support/supabase-admin.js";
import { getTestPrefix } from "../support/test-isolation.js";

/** A machine-editor tag row's accessible name reads "<name>, <count> machines". */
function tagRow(name: string): RegExp {
  return new RegExp(`^${name},`);
}

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

test.describe("Tag type changes", () => {
  test.use({
    storageState: STORAGE_STATE.technician,
    viewport: { width: 1280, height: 800 },
  });

  test.describe("one per machine", () => {
    const prefix = getTestPrefix();
    const typeName = `Rack ${prefix}`;
    const top = `Top ${prefix}`;
    const low = `Low ${prefix}`;
    let machine: { id: string; initials: string; name: string } | null = null;

    test.beforeAll(async () => {
      const ownerId = await getProfileIdByEmail(TEST_USERS.admin.email);
      const created = await createTestMachine(ownerId);
      machine = created;
      await createTestTagType(typeName, { exclusive: false, tags: [top, low] });
      await addTestMachineTags(created.id, [top, low]);
    });

    test.afterAll(async () => {
      await deleteTestTagType(typeName).catch(() => undefined);
      if (machine) await deleteTestMachine(machine.id).catch(() => undefined);
    });

    test("is blocked by a machine holding two tags until one is removed, then toggles back", async ({
      page,
    }) => {
      if (!machine) throw new Error("Test machine was not created");
      const typePath = `/c/tags/${testTagSlug(typeName)}`;
      const badge = page.getByText("One per machine", { exact: true });
      const openMenuItem = async (name: string): Promise<void> => {
        await page.getByRole("button", { name: "Tag type actions" }).click();
        await page.getByRole("menuitem", { name }).click();
      };
      const makeDialog = page.getByRole("alertdialog", {
        name: `Make ${typeName} one per machine?`,
      });

      // --- Blocked: the machine holding both tags is named and linked ------
      await page.goto(typePath);
      await expect(
        page.getByRole("heading", { level: 1, name: typeName })
      ).toBeVisible();
      await expect(badge).toHaveCount(0);
      await openMenuItem("Make one per machine");
      await expect(makeDialog).toBeVisible();
      await expect(makeDialog.getByRole("alert")).toHaveText(
        `1 machine has more than one ${typeName} tag`
      );
      await expect(
        makeDialog.getByRole("link", { name: machine.name })
      ).toHaveAttribute("href", `/m/${machine.initials}`);
      await expect(
        makeDialog.getByRole("button", { name: "Make one per machine" })
      ).toHaveCount(0);
      await makeDialog.getByRole("button", { name: "Close" }).click();
      await expect(makeDialog).toBeHidden();

      // --- Clear the blocker from the machine page --------------------------
      await page.goto(`/m/${machine.initials}`);
      const tagsCard = page.getByTestId("machine-tags");
      await tagsCard.getByRole("button", { name: "Edit tags" }).click();
      const editor = page.getByRole("dialog", { name: "Edit tags" });
      await editor.getByRole("checkbox", { name: tagRow(low) }).uncheck();
      await expect(editor.getByRole("status")).toHaveText("Saved");
      await editor.getByRole("button", { name: "Done" }).click();
      await expect(editor).toBeHidden();
      await expect(
        tagsCard.getByRole("link", { name: low, exact: true })
      ).toHaveCount(0);

      // --- Now it can be made one per machine -------------------------------
      await page.goto(typePath);
      await openMenuItem("Make one per machine");
      await expect(makeDialog.getByRole("alert")).toHaveCount(0);
      await makeDialog
        .getByRole("button", { name: "Make one per machine" })
        .click();
      await expect(makeDialog).toBeHidden();
      await expect(badge).toBeVisible();

      // --- And back to more than one ---------------------------------------
      await openMenuItem("Allow more than one per machine");
      const allowDialog = page.getByRole("alertdialog", {
        name: `Allow more than one ${typeName} tag per machine?`,
      });
      await allowDialog
        .getByRole("button", { name: "Allow more than one" })
        .click();
      await expect(allowDialog).toBeHidden();
      await expect(badge).toHaveCount(0);
      await page.reload();
      await expect(
        page.getByRole("heading", { level: 1, name: typeName })
      ).toBeVisible();
      await expect(badge).toHaveCount(0);
    });
  });

  test.describe("move a tag", () => {
    const prefix = getTestPrefix();
    const fromType = `From ${prefix}`;
    const toType = `To ${prefix}`;
    const tagName = `Mv ${prefix}`;
    let machine: { id: string; initials: string } | null = null;

    test.beforeAll(async () => {
      const ownerId = await getProfileIdByEmail(TEST_USERS.admin.email);
      const created = await createTestMachine(ownerId);
      machine = created;
      await createTestTagType(fromType, { exclusive: false, tags: [tagName] });
      await createTestTagType(toType, { exclusive: false, tags: [] });
      await addTestMachineTags(created.id, [tagName]);
    });

    test.afterAll(async () => {
      await deleteTestTagType(fromType).catch(() => undefined);
      await deleteTestTagType(toType).catch(() => undefined);
      if (machine) await deleteTestMachine(machine.id).catch(() => undefined);
    });

    test("moves a tag to another tag type; the old address redirects", async ({
      page,
    }) => {
      if (!machine) throw new Error("Test machine was not created");
      const oldPath = `/c/tags/${testTagSlug(fromType)}/${testTagSlug(tagName)}`;
      const newPath = `/c/tags/${testTagSlug(toType)}/${testTagSlug(tagName)}`;
      const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });

      await page.goto(oldPath);
      await expect(
        page.getByRole("heading", { level: 1, name: tagName })
      ).toBeVisible();
      await expect(
        breadcrumb.getByRole("link", { name: fromType })
      ).toBeVisible();

      await page.getByRole("button", { name: "Tag actions" }).click();
      await page
        .getByRole("menuitem", { name: "Move to another tag type…" })
        .click();
      const dialog = page.getByRole("dialog", { name: `Move ${tagName}` });
      await expect(dialog).toBeVisible();
      await expect(
        dialog.getByText(`Now in ${fromType} · 1 machine`)
      ).toBeVisible();
      const move = dialog.getByRole("button", { name: "Move tag" });
      await expect(move).toBeDisabled();
      await dialog.getByLabel("Tag type").selectOption({ label: toType });
      await expect(dialog.getByRole("alert")).toHaveCount(0);
      await move.click();

      // --- The tag's page now lives under the destination type -------------
      await expect(page).toHaveURL(new RegExp(`${newPath}$`));
      await expect(
        page.getByRole("heading", { level: 1, name: tagName })
      ).toBeVisible();
      await expect(
        breadcrumb.getByRole("link", { name: toType })
      ).toHaveAttribute("href", `/c/tags/${testTagSlug(toType)}`);

      // --- The old address redirects to the new one ------------------------
      await page.goto(oldPath);
      await expect(page).toHaveURL(new RegExp(`${newPath}$`));

      // --- The machine keeps the tag, linked to its new page ---------------
      await page.goto(`/m/${machine.initials}`);
      await expect(
        page
          .getByTestId("machine-tags")
          .getByRole("link", { name: tagName, exact: true })
      ).toHaveAttribute("href", newPath);
    });
  });

  test.describe("merge a tag", () => {
    const prefix = getTestPrefix();
    const typeName = `Mrg ${prefix}`;
    const source = `Old ${prefix}`;
    const target = `New ${prefix}`;
    let both: { id: string; initials: string } | null = null;
    let onlySource: { id: string; initials: string } | null = null;

    test.beforeAll(async () => {
      const ownerId = await getProfileIdByEmail(TEST_USERS.admin.email);
      both = await createTestMachine(ownerId);
      onlySource = await createTestMachine(ownerId);
      await createTestTagType(typeName, {
        exclusive: false,
        tags: [source, target],
      });
      await addTestMachineTags(both.id, [source, target]);
      await addTestMachineTags(onlySource.id, [source]);
    });

    test.afterAll(async () => {
      await deleteTestTagType(typeName).catch(() => undefined);
      for (const m of [both, onlySource]) {
        if (m) await deleteTestMachine(m.id).catch(() => undefined);
      }
    });

    test("merges a tag into another; its machines and old links move to the target", async ({
      page,
    }) => {
      if (!both || !onlySource) throw new Error("Test machines not created");
      const typeSlug = testTagSlug(typeName);
      const oldPath = `/c/tags/${typeSlug}/${testTagSlug(source)}`;
      const newPath = `/c/tags/${typeSlug}/${testTagSlug(target)}`;

      await page.goto(oldPath);
      await expect(
        page.getByRole("heading", { level: 1, name: source })
      ).toBeVisible();
      await page.getByRole("button", { name: "Tag actions" }).click();
      await page
        .getByRole("menuitem", { name: "Merge into another tag…" })
        .click();
      const dialog = page.getByRole("dialog", {
        name: `Merge ${source} into another tag`,
      });
      await expect(dialog.getByText(`${typeName} · 2 machines`)).toBeVisible();
      const merge = dialog.getByRole("button", { name: "Merge tags" });
      await expect(merge).toBeDisabled();
      await dialog
        .getByLabel("Merge into")
        .selectOption({ label: `${target} · 1 machine` });
      await expect(
        dialog.getByText(
          `All 2 machines will be tagged ${target} (1 already is).`,
          { exact: false }
        )
      ).toBeVisible();
      await expect(dialog.getByRole("alert")).toHaveCount(0);
      await merge.click();

      // --- Lands on the target, which now holds both machines --------------
      await expect(page).toHaveURL(new RegExp(`${newPath}$`));
      await expect(
        page.getByRole("heading", { level: 1, name: target })
      ).toBeVisible();
      await expect(page.getByTestId("collection-summary")).toContainText(
        "2 machines"
      );

      // --- The merged tag's addresses open the target (11.19) --------------
      await page.goto(oldPath);
      await expect(page).toHaveURL(new RegExp(`${newPath}$`));
      await page.goto(`${oldPath}/issues`);
      await expect(page).toHaveURL(new RegExp(`${newPath}/issues$`));

      // --- The machine that held only the source now holds the target -------
      await page.goto(`/m/${onlySource.initials}`);
      const tags = page.getByTestId("machine-tags");
      await expect(
        tags.getByRole("link", { name: target, exact: true })
      ).toHaveAttribute("href", newPath);
      await expect(
        tags.getByRole("link", { name: source, exact: true })
      ).toHaveCount(0);
    });
  });

  test.describe("merge blocked", () => {
    const prefix = getTestPrefix();
    const looseType = `Lse ${prefix}`;
    const exclusiveType = `Exc ${prefix}`;
    const source = `Src ${prefix}`;
    const into = `Tgt ${prefix}`;
    const held = `Hld ${prefix}`;
    let machine: { id: string; initials: string; name: string } | null = null;

    test.beforeAll(async () => {
      const ownerId = await getProfileIdByEmail(TEST_USERS.admin.email);
      machine = await createTestMachine(ownerId);
      await createTestTagType(looseType, { exclusive: false, tags: [source] });
      await createTestTagType(exclusiveType, {
        exclusive: true,
        tags: [into, held],
      });
      await addTestMachineTags(machine.id, [source, held]);
    });

    test.afterAll(async () => {
      for (const name of [looseType, exclusiveType]) {
        await deleteTestTagType(name).catch(() => undefined);
      }
      if (machine) await deleteTestMachine(machine.id).catch(() => undefined);
    });

    test("refuses a merge that would leave a machine with two exclusive tags", async ({
      page,
    }) => {
      if (!machine) throw new Error("Test machine was not created");
      await page.goto(
        `/c/tags/${testTagSlug(looseType)}/${testTagSlug(source)}`
      );
      await page.getByRole("button", { name: "Tag actions" }).click();
      await page
        .getByRole("menuitem", { name: "Merge into another tag…" })
        .click();
      const dialog = page.getByRole("dialog", {
        name: `Merge ${source} into another tag`,
      });
      await dialog
        .getByLabel("Merge into")
        .selectOption({ label: `${into} · 0 machines` });
      await expect(dialog.getByRole("alert")).toHaveText(
        `1 machine would hold two ${exclusiveType} tags`
      );
      await expect(
        dialog.getByRole("link", { name: machine.name })
      ).toHaveAttribute("href", `/m/${machine.initials}`);
      await expect(dialog.getByText(held, { exact: true })).toBeVisible();
      await expect(
        dialog.getByRole("button", { name: "Merge tags" })
      ).toBeDisabled();
      await assertNoA11yViolations(page);
    });
  });

  test.describe("move blocked", () => {
    const prefix = getTestPrefix();
    const sourceType = `Src ${prefix}`;
    const tagName = `Dup ${prefix}`;
    const takenType = `Has ${prefix}`;
    const exclusiveType = `One ${prefix}`;
    const held = `Own ${prefix}`;
    let machine: { id: string; initials: string; name: string } | null = null;

    test.beforeAll(async () => {
      const ownerId = await getProfileIdByEmail(TEST_USERS.admin.email);
      const created = await createTestMachine(ownerId);
      machine = created;
      await createTestTagType(sourceType, {
        exclusive: false,
        tags: [tagName],
      });
      // Same name in another type; slugs are unique across every tag.
      await createTestTagType(takenType, {
        exclusive: false,
        tags: [{ name: tagName, slug: `${testTagSlug(tagName)}-2` }],
      });
      await createTestTagType(exclusiveType, {
        exclusive: true,
        tags: [held],
      });
      await addTestMachineTags(created.id, [tagName, held]);
    });

    test.afterAll(async () => {
      for (const name of [sourceType, takenType, exclusiveType]) {
        await deleteTestTagType(name).catch(() => undefined);
      }
      if (machine) await deleteTestMachine(machine.id).catch(() => undefined);
    });

    test("refuses a taken name and a machine that would hold two exclusive tags", async ({
      page,
    }) => {
      if (!machine) throw new Error("Test machine was not created");
      await page.goto(
        `/c/tags/${testTagSlug(sourceType)}/${testTagSlug(tagName)}`
      );
      await page.getByRole("button", { name: "Tag actions" }).click();
      await page
        .getByRole("menuitem", { name: "Move to another tag type…" })
        .click();
      const dialog = page.getByRole("dialog", { name: `Move ${tagName}` });
      const select = dialog.getByLabel("Tag type");
      const move = dialog.getByRole("button", { name: "Move tag" });

      // --- A tag type that already has the name -----------------------------
      await select.selectOption({ label: takenType });
      await expect(dialog.getByRole("alert")).toHaveText(
        `${takenType} already has a tag named ${tagName}`
      );
      await expect(move).toBeDisabled();

      // --- An exclusive type the machine already holds a tag of -------------
      await select.selectOption({
        label: `${exclusiveType} · one per machine`,
      });
      await expect(dialog.getByRole("alert")).toHaveText(
        `1 machine would hold two ${exclusiveType} tags`
      );
      await expect(
        dialog.getByRole("link", { name: machine.name })
      ).toHaveAttribute("href", `/m/${machine.initials}`);
      await expect(dialog.getByText(held, { exact: true })).toBeVisible();
      await expect(move).toBeDisabled();
      await assertNoA11yViolations(page);

      // --- The blocked dialog fits the narrowest review viewport ------------
      await page.setViewportSize({ width: 320, height: 568 });
      await expect(dialog.getByRole("alert")).toBeVisible();
      const fit = await dialog.evaluate((element) => ({
        right: element.getBoundingClientRect().right,
        overflow: element.scrollWidth - element.clientWidth,
        viewport: document.documentElement.clientWidth,
      }));
      expect(fit.right).toBeLessThanOrEqual(fit.viewport);
      expect(fit.overflow).toBeLessThanOrEqual(0);
    });
  });
});
