/**
 * E2E Tests for the Machine Settings tab (PP-43q3)
 *
 * Class-F multi-step journeys — the things only an end-to-end run can prove:
 * - create a set → name it → Save → it persists across a full page reload
 *   (proves the per-unit Save actually wrote to the DB, not just local island
 *   state)
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

import { test, expect, type Page } from "@playwright/test";
import { STORAGE_STATE } from "../support/auth-state.js";
import { seededMachines } from "../support/constants.js";
import {
  createTestMachine,
  deleteTestMachine,
  getProfileIdByEmail,
  seedSettingsSet,
} from "../support/supabase-admin.js";

const machine = seededMachines.addamsFamily.initials;
const PREFIX = "E2E PP-43q3";

/**
 * Open a section's kebab menu and click one of its items.
 *
 * Context: on a machine with no machine-wide guidance yet, the two "Before you
 * change anything" / "How to change settings" blocks render as tall always-open
 * editors that push the settings sets far down the page. At the default 720px
 * test viewport a section's kebab could sit at the very bottom edge, and the
 * Radix menu — a fixed-position portal — then opened below the fold where its
 * items reported "outside of the viewport" and a plain click could never reach
 * them (a fixed element can't be scrolled into view; the last section can't be
 * scrolled up either — nothing below it). A real user is never blocked: the menu
 * is reachable once there's room, and Radix flips it up near the viewport bottom
 * anyway. The describe blocks give these tests a tall viewport so the whole page
 * fits and every menu opens on-screen, which is all this needs. (PP-43q3 review
 * casework — verified a plain menu-item click works once the trigger has room.)
 */
async function activateSectionMenuItem(
  page: Page,
  sectionLabel: string,
  itemName: RegExp
): Promise<void> {
  await page
    .getByRole("button", {
      name: `More options for the ${sectionLabel} section`,
    })
    .click();
  await page.getByRole("menuitem", { name: itemName }).click();
}

test.describe("Machine Settings (PP-43q3)", () => {
  test.describe("editor journey (admin)", () => {
    test.use({
      storageState: STORAGE_STATE.admin,
      // Tall viewport so the always-open machine-wide guidance editors can't
      // push a set's controls or a section's kebab menu below the fold, where a
      // fixed-position Radix menu item can't be scrolled into view for a click
      // (PP-43q3 review casework).
      viewport: { width: 1280, height: 1800 },
    });

    test("creates a set, auto-saves, and survives a reload", async ({
      page,
    }) => {
      // The reload recompiles the route in dev mode (the E2E webServer runs
      // `next dev`); under suite load that first post-reload render is slow,
      // so give this journey extra budget rather than racing a fixed timeout.
      test.slow();
      // Auto-accept any confirm (delete/duplicate/unsaved-guard) so a stray
      // dialog can't hang the run.
      page.on("dialog", (d) => void d.accept());

      const name = `${PREFIX} Tournament ${Date.now().toString()}`;
      await page.goto(`/m/${machine}/settings`);

      // New set opens straight into edit mode with the name field focused.
      await page.getByRole("button", { name: /new set/i }).click();
      // New sets are prepended, so the just-created set is the first "set name"
      // field. Scoping to .first() keeps this unambiguous if a retry re-runs
      // against a machine that already holds the previous attempt's set.
      const nameField = page
        .getByRole("textbox", { name: /set name/i })
        .first();
      await nameField.fill(name);
      // The set name is always-live: blurring commits it (onBlurCommit), which
      // auto-saves the new set as a row insert — there is no explicit Save
      // button (PP-43q3 pivoted the sets to always-live auto-save). Tab moves
      // focus off the field to fire the blur.
      await nameField.press("Tab");
      await expect(nameField).toHaveValue(name);

      // Reload — if the set is still here, the auto-save wrote it to the DB (not
      // just local island state). The set name renders into the always-present
      // name input, so assert on its value. Wrapped in toPass: the dev webServer
      // can briefly serve a stale route render right after the action's
      // revalidate, so retry the reload until the persisted name reappears.
      // (Production renders this route dynamically, so the staleness is a
      // dev-mode artifact.)
      await expect(async () => {
        await page.reload();
        await expect(
          page.getByRole("textbox", { name: /set name/i }).first()
        ).toHaveValue(name, { timeout: 8_000 });
      }).toPass({ timeout: 45_000 });
    });

    test("reaches the Settings tab from the machine tab strip", async ({
      page,
    }) => {
      await page.goto(`/m/${machine}`);
      await page.getByRole("link", { name: /^settings$/i }).click();
      await expect(page).toHaveURL(new RegExp(`/m/${machine}/settings$`));
    });
  });

  // Structural section ops (delete / reorder) persist IMMEDIATELY — there's no
  // set-level "Done"; the action fires on confirm/click. The only thing an E2E
  // run can prove that the integration tests can't is that the persisted result
  // survives a real page reload (the route re-renders from the DB, not local
  // island state). Each test seeds its OWN machine + set so it never touches the
  // shared AFM seed and can't cross-talk with another worker. (PP-43q3)
  test.describe("section ops persist (admin, isolated machine)", () => {
    test.use({
      storageState: STORAGE_STATE.admin,
      // Tall viewport so the always-open machine-wide guidance editors can't
      // push a set's controls or a section's kebab menu below the fold, where a
      // fixed-position Radix menu item can't be scrolled into view for a click
      // (PP-43q3 review casework).
      viewport: { width: 1280, height: 1800 },
    });

    let machineId: string;
    let machineInitials: string;

    test.beforeEach(async () => {
      const adminId = await getProfileIdByEmail("admin@test.com");
      const created = await createTestMachine(adminId);
      machineId = created.id;
      machineInitials = created.initials;
    });

    test.afterEach(async () => {
      // ON DELETE CASCADE drops the seeded settings sets with the machine.
      await deleteTestMachine(machineId);
    });

    // The two named sections used by both tests: a software section (heading
    // "Software settings", kebab "…the Software settings section") and a "Rubbers"
    // preset note (heading "Rubbers", kebab "…the Rubbers section").
    const softwareSection = {
      id: "e2e-software",
      kind: "software",
      baseline: "Factory",
      rows: [{ id: "A.1 01", name: "Balls Per Game", value: "3" }],
    };
    const rubbersSection = {
      id: "e2e-rubbers",
      kind: "note",
      title: "Rubbers",
      customTitle: false,
      body: null,
    };

    test("delete a section via the kebab survives a reload", async ({
      page,
    }) => {
      test.slow();
      await seedSettingsSet(machineId, `${PREFIX} Delete target`, [
        softwareSection,
        rubbersSection,
      ]);

      await page.goto(`/m/${machineInitials}/settings`);
      // Sets render collapsed by default (PP-tn6t) — expand the seeded set so its
      // section headings are visible.
      await page
        .getByRole("button", {
          name: `Expand ${PREFIX} Delete target settings set`,
        })
        .click();
      await expect(page.getByText("Software settings")).toBeVisible();
      const rubbersHeading = page.getByRole("paragraph").filter({
        hasText: /^Rubbers$/,
      });
      await expect(rubbersHeading).toBeVisible();

      // Open the Rubbers section kebab and delete it (AlertDialog confirm).
      await activateSectionMenuItem(page, "Rubbers", /delete section/i);
      // The confirm dialog names the section.
      const dialog = page.getByRole("alertdialog");
      await expect(
        dialog.getByText(/Delete the Rubbers section\?/i)
      ).toBeVisible();
      await dialog.getByRole("button", { name: /^delete$/i }).click();

      // Gone locally...
      await expect(rubbersHeading).toHaveCount(0);

      // ...and gone after a reload (proves the delete was persisted, not just
      // removed from island state). Dev webServer can briefly serve a stale
      // render right after revalidate, so retry the reload.
      await expect(async () => {
        await page.reload();
        // Collapsed again after reload — re-expand to read the sections.
        await page
          .getByRole("button", {
            name: `Expand ${PREFIX} Delete target settings set`,
          })
          .click();
        await expect(page.getByText("Software settings")).toBeVisible({
          timeout: 8_000,
        });
        await expect(
          page.getByRole("paragraph").filter({ hasText: /^Rubbers$/ })
        ).toHaveCount(0);
      }).toPass({ timeout: 45_000 });
    });

    test("reorder a section (kebab Move down) survives a reload", async ({
      page,
    }) => {
      test.slow();
      // Seed software FIRST, Rubbers second.
      await seedSettingsSet(machineId, `${PREFIX} Reorder target`, [
        softwareSection,
        rubbersSection,
      ]);

      // The kebab aria-labels encode each section's identity; their DOM order is
      // the section order. Read them top-to-bottom.
      const sectionOrder = async (): Promise<string[]> => {
        const labels = await page
          // "the …" excludes the set-level kebab ("…for this set").
          .getByRole("button", { name: /^More options for the / })
          .evaluateAll((els) =>
            els.map((el) => el.getAttribute("aria-label") ?? "")
          );
        return labels;
      };

      await page.goto(`/m/${machineInitials}/settings`);
      // Sets render collapsed by default (PP-tn6t) — expand the seeded set.
      await page
        .getByRole("button", {
          name: `Expand ${PREFIX} Reorder target settings set`,
        })
        .click();
      await expect(page.getByText("Software settings")).toBeVisible();
      expect(await sectionOrder()).toEqual([
        "More options for the Software settings section",
        "More options for the Rubbers section",
      ]);

      // Move the first section (software) down — persists immediately.
      await activateSectionMenuItem(page, "Software settings", /move down/i);

      // Order flipped locally.
      expect(await sectionOrder()).toEqual([
        "More options for the Rubbers section",
        "More options for the Software settings section",
      ]);

      // And the new order survives a reload (persisted to the DB).
      await expect(async () => {
        await page.reload();
        // Collapsed again after reload — re-expand to read the section order.
        await page
          .getByRole("button", {
            name: `Expand ${PREFIX} Reorder target settings set`,
          })
          .click();
        await expect(page.getByText("Software settings")).toBeVisible({
          timeout: 8_000,
        });
        expect(await sectionOrder()).toEqual([
          "More options for the Rubbers section",
          "More options for the Software settings section",
        ]);
      }).toPass({ timeout: 45_000 });
    });
  });

  test.describe("read-only (non-owner member)", () => {
    test.use({ storageState: STORAGE_STATE.member });

    test("a non-owner sees the tab read-only (no New set affordance)", async ({
      page,
    }) => {
      await page.goto(`/m/${machine}/settings`);
      // TAF has no owner and no sets a non-owner member can see, so the tab
      // shows its read-only empty state (PP-tn6t) and offers no "New set".
      await expect(
        page.getByText(/no settings sets recorded yet/i)
      ).toBeVisible();
      await expect(page.getByRole("button", { name: /new set/i })).toHaveCount(
        0
      );
    });
  });
});
