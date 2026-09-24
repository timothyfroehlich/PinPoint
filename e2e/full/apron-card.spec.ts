/**
 * E2E: printable apron cards (PP-esta)
 *
 * Class-F journeys only an end-to-end run can prove:
 * - an editor opens the card from the Service tab, sets size, description and
 *   tip, sees the live preview block Save when the text overflows the card
 *   (a layout measurement jsdom cannot make), saves, and the saved card
 *   persists across a reload;
 * - a member who cannot edit the machine still gets Export and the print page;
 * - a signed-out visitor gets neither.
 *
 * The edit-permission split (owner / technician / admin / non-owner) is
 * covered at the action layer in src/test/integration/apron-card-actions.test.ts.
 * Each test seeds its own machine, so no seeded row is mutated.
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

test.describe("Apron card editor", () => {
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

  test("sets up, saves, and reloads a card", async ({ page }) => {
    await page.goto(`/m/${machine.initials}/maintenance`);
    const entry = page.getByTestId("apron-card-entry");
    await expect(entry.getByText("No card size set")).toBeVisible();

    await entry.getByRole("button", { name: "Edit card" }).click();
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByText("Choose an apron card size").first()
    ).toBeVisible();

    await dialog.getByRole("combobox", { name: "Apron card size" }).click();
    await page.getByRole("option", { name: /Stern \/ SPIKE/ }).click();
    await dialog.getByText("Use a custom description").click();
    await dialog
      .getByRole("textbox", { name: "Custom description" })
      .fill(LONG_TEXT);

    // The preview measures the combined text region; too much text blocks Save.
    await expect(dialog.getByText("Text too long for the card")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Save" })).toBeDisabled();

    await dialog
      .getByRole("textbox", { name: "Custom description" })
      .fill("Shoot the ramps to light the lock.");
    await dialog.getByRole("checkbox", { name: "Include a tip" }).check();
    await dialog
      .getByLabel("Tip", { exact: true })
      .fill("Extra ball at three modes.");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog.getByRole("status")).toHaveText("Saved");

    await page.keyboard.press("Escape");
    await page.reload();
    await expect(
      entry.getByText("Stern / SPIKE · card description · tip on")
    ).toBeVisible();
    await expect(
      entry.getByText("Shoot the ramps to light the lock.")
    ).toBeVisible();
    await expect(entry.getByRole("button", { name: "Export" })).toBeEnabled();
  });
});

test.describe("Apron card export", () => {
  let machine: { id: string; initials: string; name: string };

  test.beforeEach(async () => {
    machine = await createTestMachine(
      await getProfileIdByEmail(TEST_USERS.admin.email)
    );
    await seedSavedApronCard(machine.id, {
      description: "Shoot the ramps to light the lock.",
      tip: "Extra ball at three modes.",
    });
  });

  test.afterEach(async () => {
    await deleteTestMachine(machine.id).catch(() => undefined);
  });

  test.describe("as a member who cannot edit the machine", () => {
    test.use({ storageState: STORAGE_STATE.member });

    test("can export and print but not edit", async ({ page }) => {
      // The print page opens the print dialog once the card is ready.
      await page.addInitScript(() => {
        window.print = () => undefined;
      });

      await page.goto(`/m/${machine.initials}/maintenance`);
      const entry = page.getByTestId("apron-card-entry");
      await expect(entry.getByRole("button", { name: "Export" })).toBeEnabled();
      await expect(
        entry.getByRole("button", { name: "Edit card" })
      ).toHaveCount(0);

      await page.goto(`/m/${machine.initials}/apron/print`);
      await expect(
        page.getByRole("heading", { name: `Apron card · ${machine.name}` })
      ).toBeVisible();
      await expect(page.getByText("Scan this machine")).toBeVisible();
      await expect(
        page.getByRole("img", { name: /QR code for .*\/hub\?source=apron/ })
      ).toBeVisible();
    });
  });

  test.describe("when the saved text no longer fits", () => {
    test.use({ storageState: STORAGE_STATE.member });

    test("blocks export and says why", async ({ page }) => {
      await seedSavedApronCard(machine.id, { description: LONG_TEXT });

      await page.goto(`/m/${machine.initials}/maintenance`);
      const entry = page.getByTestId("apron-card-entry");
      await expect(entry.getByText("Text too long for the card")).toBeVisible();
      await expect(
        entry.getByRole("button", { name: "Export" })
      ).toBeDisabled();
    });
  });

  test("a signed-out visitor sees no card and cannot print", async ({
    page,
  }) => {
    await page.goto(`/m/${machine.initials}/maintenance`);
    await expect(page.getByTestId("apron-card-entry")).toHaveCount(0);

    const response = await page.goto(`/m/${machine.initials}/apron/print`);
    expect(response?.status()).toBe(404);
  });
});
