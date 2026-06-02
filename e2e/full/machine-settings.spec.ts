/**
 * E2E Tests for the Machine Settings tab (PP-43q3)
 *
 * Class-F multi-step journeys — the things only an end-to-end run can prove:
 * - create a set → name it → Done → it persists across a full page reload
 *   (proves save-on-Done actually wrote to the DB, not just local island state)
 * - the Settings tab is reachable from the machine tab strip
 *
 * Permission splits (owner / technician / admin can edit; non-owner cannot) are
 * class-E and covered exhaustively at the action layer in
 * src/test/integration/machine-settings-actions.test.ts — duplicating them here
 * would be misallocation per AGENTS.md rule 9. We include only a single light
 * read-only affordance check (a distinct rendered UI state).
 *
 * TAF (addamsFamily) has no member owner in the seed, so: admin can edit it
 * (admin edits any machine), and the member test user sees it read-only.
 */

import { test, expect } from "@playwright/test";
import { STORAGE_STATE } from "../support/auth-state.js";
import { seededMachines } from "../support/constants.js";

const machine = seededMachines.addamsFamily.initials;
const PREFIX = "E2E PP-43q3";

test.describe("Machine Settings (PP-43q3)", () => {
  test.describe("editor journey (admin)", () => {
    test.use({ storageState: STORAGE_STATE.admin });

    test("creates a set, persists on Done, and survives a reload", async ({
      page,
    }) => {
      // Auto-accept any confirm (delete/duplicate/unsaved-guard) so a stray
      // dialog can't hang the run.
      page.on("dialog", (d) => void d.accept());

      const name = `${PREFIX} Tournament ${Date.now().toString()}`;
      await page.goto(`/m/${machine}/settings`);

      // New set opens straight into edit mode with the name field focused.
      await page.getByRole("button", { name: /new set/i }).click();
      const nameField = page.getByRole("textbox", { name: /set name/i });
      await nameField.fill(name);
      await nameField.press("Enter"); // commit the name

      // Done persists the whole set.
      await page.getByRole("button", { name: /^done$/i }).click();
      await expect(page.getByText(name)).toBeVisible({ timeout: 10_000 });

      // Reload — if it's still here, it was written to the DB (not just state).
      // Wait for the page to re-render (dev-mode reloads recompile the route)
      // via the stable header before asserting the persisted set name.
      await page.reload();
      await expect(page.getByText(/game settings/i)).toBeVisible({
        timeout: 20_000,
      });
      await expect(page.getByText(name)).toBeVisible({ timeout: 10_000 });
    });

    test("reaches the Settings tab from the machine tab strip", async ({
      page,
    }) => {
      await page.goto(`/m/${machine}`);
      await page.getByRole("link", { name: /^settings$/i }).click();
      await expect(page).toHaveURL(new RegExp(`/m/${machine}/settings$`));
    });
  });

  test.describe("read-only (non-owner member)", () => {
    test.use({ storageState: STORAGE_STATE.member });

    test("a non-owner sees the tab read-only (no New set affordance)", async ({
      page,
    }) => {
      await page.goto(`/m/${machine}/settings`);
      await expect(page.getByText(/game settings/i)).toBeVisible();
      await expect(page.getByRole("button", { name: /new set/i })).toHaveCount(
        0
      );
    });
  });
});
