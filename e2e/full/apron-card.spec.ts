/**
 * E2E: the machine's Apron card tab (PP-esta, PP-o23o)
 *
 * Class-F journeys only an end-to-end run can prove:
 * - an editor adds cards, sees the live preview report text that does not fit
 *   (a layout measurement jsdom cannot make), names, sizes, and picks a
 *   template for two cards, saves them with one Save, and they persist across
 *   a reload; deleting one sticks;
 * - a member who cannot edit the machine gets Preview and Export only, and
 *   Export prints the chosen card;
 * - Export marks a saved card that does not fit and needs the override;
 * - a signed-out visitor gets no tab and cannot print;
 * - a member opens Print apron cards from the Machines list's Print menu, picks a card,
 *   and downloads its size's print file; a card that does not fit needs the
 *   page's override (§12);
 * - a member queues a card from Export, the Machines list shows the count,
 *   the print page opens with it selected, and Mark as printed clears it
 *   (§13).
 *
 * The edit-permission split and the save action's rules are covered at the
 * integration layer (src/test/integration/apron-card-actions.test.ts,
 * machine-apron-tab.test.tsx); who may queue and whose queue is whose, in
 * apron-print-queue.test.ts. Each test seeds its own machine, so no seeded
 * row is mutated.
 */

import { test, expect } from "../support/fixtures.js";
import { STORAGE_STATE } from "../support/auth-state.js";
import { TEST_USERS } from "../support/constants.js";
import {
  createTestMachine,
  deleteTestMachine,
  getProfileIdByEmail,
  seedSavedApronCard,
} from "../support/supabase-admin.js";

const LONG_TEXT = Array.from(
  { length: 12 },
  () => "Shoot the left ramp to light the lock, then the scoop to start it."
).join(" ");

test.describe("Apron card tab as an editor", () => {
  test.use({ storageState: STORAGE_STATE.admin });

  let machine: { id: string; initials: string; name: string };

  test.beforeEach(async () => {
    machine = await createTestMachine(
      await getProfileIdByEmail(TEST_USERS.admin.email)
    );
  });

  test.afterEach(async () => {
    await deleteTestMachine(machine.id).catch(() => undefined);
  });

  test("adds, saves, reloads, and deletes cards", async ({ page }) => {
    await page.goto(`/m/${machine.initials}/apron`);
    await expect(page.getByText("No saved cards")).toBeVisible();
    await page.getByRole("button", { name: "Add card" }).click();

    // Every card needs a size before the tab can save (§4.3).
    const save = page.getByRole("button", { name: "Save cards" });
    await expect(
      page.getByText("Choose an apron size for Card 1")
    ).toBeVisible();
    await expect(save).toBeDisabled();

    await page.getByRole("combobox", { name: "Apron size" }).click();
    await page
      .getByRole("option", { name: /Stern \/ Data East \/ Sega/ })
      .click();
    await page.getByRole("radio", { name: "Card description" }).click();
    const description = page.getByLabel("Card description", { exact: true });
    await description.fill(LONG_TEXT);

    // The preview measures the combined text region (§3.5); the card can
    // still be saved.
    await expect(page.getByText("Doesn't fit on the card")).toBeVisible();
    await expect(save).toBeEnabled();

    await description.fill("Shoot the ramps to light the lock.");
    await expect(page.getByText("Doesn't fit on the card")).toHaveCount(0);
    await page.getByRole("switch", { name: "On card" }).click();
    await page
      .getByLabel("Tip", { exact: true })
      .fill("Extra ball at three modes.");

    // A second card, renamed and sized (§11.3, §11.5).
    await page.getByRole("button", { name: "Add card" }).click();
    await page.getByRole("button", { name: "Card actions" }).click();
    await page.getByRole("menuitem", { name: "Rename card…" }).click();
    const rename = page.getByRole("dialog", { name: "Rename card" });
    await rename.getByLabel("Name").fill("Card 1");
    await expect(rename.getByText("Name already used")).toBeVisible();
    await rename.getByLabel("Name").fill("Tournament");
    await rename.getByRole("button", { name: "Rename" }).click();
    await page.getByRole("combobox", { name: "Apron size" }).click();
    await page.getByRole("option", { name: /WPC/ }).click();
    // Only the Standard template shows credits (§5.5, §10.5).
    await expect(page.getByRole("group", { name: "Credits" })).toBeVisible();
    await page.getByRole("combobox", { name: "Template" }).click();
    await page.getByRole("option", { name: "Header band" }).click();
    await expect(page.getByRole("group", { name: "Credits" })).toHaveCount(0);

    await save.click();
    await expect(page.getByText("Cards saved")).toBeVisible();

    await page.reload();
    const picker = page.getByRole("combobox", { name: "Saved card" });
    await expect(picker).toHaveText("Card 1");
    await expect(page.getByRole("combobox", { name: "Apron size" })).toHaveText(
      /Stern \/ Data East \/ Sega/
    );
    await expect(
      page.getByText("Shoot the ramps to light the lock.").first()
    ).toBeVisible();

    await picker.click();
    await page.getByRole("option", { name: "Tournament" }).click();
    await expect(page.getByRole("combobox", { name: "Apron size" })).toHaveText(
      /WPC/
    );
    await expect(page.getByRole("combobox", { name: "Template" })).toHaveText(
      "Header band"
    );

    await page.getByRole("button", { name: "Card actions" }).click();
    await page.getByRole("menuitem", { name: "Delete card…" }).click();
    await page.getByRole("button", { name: "Delete card" }).click();
    await save.click();
    await expect(page.getByText("Cards saved")).toBeVisible();

    await page.reload();
    await picker.click();
    await expect(page.getByRole("option")).toHaveText(["Card 1"]);
  });
});

test.describe("Apron card export", () => {
  let machine: { id: string; initials: string; name: string };
  let cardId: string;

  test.beforeEach(async () => {
    machine = await createTestMachine(
      await getProfileIdByEmail(TEST_USERS.admin.email)
    );
    cardId = await seedSavedApronCard(machine.id, {
      description: "Shoot the ramps to light the lock.",
      tip: "Extra ball at three modes.",
    });
  });

  test.afterEach(async () => {
    await deleteTestMachine(machine.id).catch(() => undefined);
  });

  test.describe("as a member who cannot edit the machine", () => {
    test.use({ storageState: STORAGE_STATE.member });

    test("sees Preview and Export only, and prints the card", async ({
      page,
    }) => {
      // The print page opens the print dialog once the card is ready.
      await page.addInitScript(() => {
        window.print = () => undefined;
      });

      await page.goto(`/m/${machine.initials}/apron`);
      await expect(page.getByText("Preview")).toBeVisible();
      await expect(page.getByRole("button", { name: "Add card" })).toHaveCount(
        0
      );
      await expect(
        page.getByRole("button", { name: "Card actions" })
      ).toHaveCount(0);
      await expect(
        page.getByRole("combobox", { name: "Apron size" })
      ).toHaveCount(0);

      await page.getByRole("button", { name: "Export" }).click();
      const menu = page.getByRole("dialog", { name: "Export apron card" });
      await expect(menu.getByRole("radio", { name: /Card 1/ })).toBeChecked();
      await expect(
        menu.getByRole("button", { name: "Download PDF" })
      ).toBeEnabled();
      await expect(menu.getByRole("link", { name: "Print…" })).toHaveAttribute(
        "href",
        `/m/${machine.initials}/apron/print?card=${cardId}`
      );

      await page.goto(`/m/${machine.initials}/apron/print?card=${cardId}`);
      await expect(
        page.getByRole("heading", { name: `Apron card · ${machine.name}` })
      ).toBeVisible();
      await expect(page.getByText("Scan this machine")).toBeVisible();
      await expect(
        page.getByRole("img", { name: /QR code for .*\/hub\?source=apron/ })
      ).toBeVisible();
    });

    test("needs the override to export a card that does not fit", async ({
      page,
    }) => {
      await seedSavedApronCard(machine.id, { description: LONG_TEXT });

      await page.goto(`/m/${machine.initials}/apron`);
      await expect(page.getByText("Doesn't fit on the card")).toBeVisible();

      await page.getByRole("button", { name: "Export" }).click();
      const menu = page.getByRole("dialog", { name: "Export apron card" });
      await expect(menu.getByText("Doesn't fit")).toBeVisible();
      const pdf = menu.getByRole("button", { name: "Download PDF" });
      await expect(pdf).toBeDisabled();

      await menu.getByLabel("Export with text cut off").check();
      await expect(pdf).toBeEnabled();

      // The override is not kept between openings (§9.5).
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Export" }).click();
      await expect(
        menu.getByLabel("Export with text cut off")
      ).not.toBeChecked();
      await expect(pdf).toBeDisabled();
    });
  });

  test("a signed-out visitor gets no tab and cannot print", async ({
    page,
  }) => {
    await page.goto(`/m/${machine.initials}`);
    await expect(page.getByTestId("machine-tab-apron")).toHaveCount(0);

    await page.goto(`/m/${machine.initials}/apron`);
    await expect(page).toHaveURL(`/m/${machine.initials}`);

    const response = await page.goto(
      `/m/${machine.initials}/apron/print?card=${cardId}`
    );
    expect(response?.status()).toBe(404);
  });
});

test.describe("Print apron cards", () => {
  test.use({ storageState: STORAGE_STATE.member });

  let fits: { id: string; initials: string; name: string };
  let overflows: { id: string; initials: string; name: string };

  test.beforeEach(async () => {
    const ownerId = await getProfileIdByEmail(TEST_USERS.admin.email);
    fits = await createTestMachine(ownerId);
    overflows = await createTestMachine(ownerId);
    await seedSavedApronCard(fits.id, {
      description: "Shoot the ramps to light the lock.",
    });
    await seedSavedApronCard(overflows.id, { description: LONG_TEXT });
  });

  test.afterEach(async () => {
    await deleteTestMachine(fits.id).catch(() => undefined);
    await deleteTestMachine(overflows.id).catch(() => undefined);
  });

  test("downloads a size's print file and needs the override for a card that does not fit", async ({
    page,
  }) => {
    await page.goto("/m");
    await page.getByRole("button", { name: "Print" }).click();
    await page.getByRole("menuitem", { name: "Apron cards" }).click();
    await expect(page).toHaveURL("/m/apron-cards");

    const search = page.getByRole("searchbox", { name: "Search machines" });
    await search.fill(fits.name);
    const card = page.getByRole("checkbox", { name: fits.name });
    await expect(card).toBeEnabled();
    await card.check();

    const run = page.getByRole("complementary", { name: "Print run" });
    await expect(run.getByText("1 card · 6 per sheet")).toBeVisible();
    await expect(run.getByText("5 spare copies")).toBeVisible();

    const download = page.waitForEvent("download");
    await run.getByRole("button", { name: "Download 1 PDF" }).click();
    expect((await download).suggestedFilename()).toBe("apron-cards-stern.pdf");

    // A card that does not fit is offered only with the override (§12.3).
    await search.fill(overflows.name);
    const tooLong = page.getByRole("checkbox", { name: overflows.name });
    await expect(page.getByText("Doesn't fit")).toBeVisible();
    await expect(tooLong).toBeDisabled();
    await run.getByLabel("Include cards that don't fit").check();
    await expect(tooLong).toBeEnabled();
  });

  test("queues a card from Export and marks it printed", async ({ page }) => {
    await page.goto(`/m/${fits.initials}/apron`);
    await page.getByRole("button", { name: "Export" }).click();
    const dialog = page.getByRole("dialog", { name: "Export apron card" });
    await dialog
      .getByRole("button", { name: "Add Card 1 to print queue" })
      .click();
    await expect(
      dialog.getByText("Card 1 is in your print queue")
    ).toBeVisible();
    await expect(dialog.getByText("Queued")).toBeVisible();
    await page.keyboard.press("Escape");

    await page.goto("/m");
    await page
      .getByRole("button", {
        name: /^Print, \d+ apron cards in your print queue$/,
      })
      .click();
    await page
      .getByRole("menuitem", {
        name: /^Apron cards, \d+ in your print queue$/,
      })
      .click();
    await expect(page).toHaveURL("/m/apron-cards");

    // The page opens with the queue selected (§13.5).
    await page
      .getByRole("searchbox", { name: "Search machines" })
      .fill(fits.name);
    await expect(page.getByRole("checkbox", { name: fits.name })).toBeChecked();

    const run = page.getByRole("complementary", { name: "Print run" });
    await run.getByRole("button", { name: "Mark as printed" }).click();
    await expect(
      page.getByText("Removed 1 card from your print queue")
    ).toBeVisible();
    await expect(
      run.getByRole("button", { name: "Mark as printed" })
    ).toHaveCount(0);

    // The queue no longer holds it on the next visit.
    await page.reload();
    await page
      .getByRole("searchbox", { name: "Search machines" })
      .fill(fits.name);
    await expect(
      page.getByRole("checkbox", { name: fits.name })
    ).not.toBeChecked();
  });
});
