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

import { test, expect } from "@playwright/test";
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

test.describe("Machine Settings (PP-43q3)", () => {
  test.describe("editor journey (admin)", () => {
    test.use({ storageState: STORAGE_STATE.admin });

    test("creates a set, persists on Save, and survives a reload", async ({
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
      const nameField = page.getByRole("textbox", { name: /set name/i });
      await nameField.fill(name);
      await nameField.press("Enter"); // commit the name

      // The header unit's Save persists the new set (name + description) as one
      // atomic row insert (PP-43q3 per-unit commit model).
      await page.getByRole("button", { name: /save set details/i }).click();
      await expect(page.getByText(name)).toBeVisible({ timeout: 10_000 });

      // Reload — if it's still here, it was written to the DB (not just local
      // state). Wrapped in toPass: the dev webServer can briefly serve a stale
      // route render right after the action's revalidate, so retry the reload
      // until the persisted set appears. (Production renders this route
      // dynamically, so the staleness is a dev-mode artifact.)
      await expect(async () => {
        await page.reload();
        await expect(page.getByText(name)).toBeVisible({ timeout: 8_000 });
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
    test.use({ storageState: STORAGE_STATE.admin });

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
      // The seeded (and only) set is expanded by default, so both section
      // headings are visible up front.
      await expect(page.getByText("Software settings")).toBeVisible();
      const rubbersHeading = page.getByRole("paragraph").filter({
        hasText: /^Rubbers$/,
      });
      await expect(rubbersHeading).toBeVisible();

      // Open the Rubbers section kebab and delete it (AlertDialog confirm).
      await page
        .getByRole("button", { name: "More options for the Rubbers section" })
        .click();
      await page.getByRole("menuitem", { name: /delete section/i }).click();
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
      await expect(page.getByText("Software settings")).toBeVisible();
      expect(await sectionOrder()).toEqual([
        "More options for the Software settings section",
        "More options for the Rubbers section",
      ]);

      // Move the first section (software) down — persists immediately.
      await page
        .getByRole("button", {
          name: "More options for the Software settings section",
        })
        .click();
      await page.getByRole("menuitem", { name: /move down/i }).click();

      // Order flipped locally.
      expect(await sectionOrder()).toEqual([
        "More options for the Rubbers section",
        "More options for the Software settings section",
      ]);

      // And the new order survives a reload (persisted to the DB).
      await expect(async () => {
        await page.reload();
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
      await expect(page.getByText(/game settings/i)).toBeVisible();
      await expect(page.getByRole("button", { name: /new set/i })).toHaveCount(
        0
      );
    });
  });
});
