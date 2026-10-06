/**
 * E2E: the Pinball Map lineup page at /m/pinball-map (PP-o355.65,
 * docs/feature-specs/pinballmap-lineup.md).
 *
 * What only a browser sees: the entry points (the /m header button and the
 * admin menu item), the page assembling stored state into sections, the row
 * links carrying the right query and machine into /m/new and /edit, and the
 * header's Confirm lineup dialog end to end against the mock client. The
 * comparison rules are unit-tested (`lineup-comparison.test.ts`) and the
 * push/link/confirm actions are integration-tested. Confirm is the one write
 * exercised here, through the mock client; nothing reaches pinballmap.com
 * (CORE-PBM-001 / CORE-TEST-006).
 *
 * Catalog rows, the stored-lineup entry and the machines are seeded directly.
 * The stored lineup is shared, so assertions target this run's own rows and
 * never an absolute count.
 */

import { test, expect } from "../support/fixtures.js";
import { STORAGE_STATE } from "../support/auth-state.js";
import { TEST_USERS } from "../support/constants.js";
import { getTestMachineInitials } from "../support/test-isolation.js";
import { cleanupTestEntities } from "../support/cleanup.js";
import {
  addLmxToStoredLineup,
  createTestMachine,
  deletePinballMapCatalogEntries,
  getProfileIdByEmail,
  markStoredLineupFresh,
  removeLmxFromStoredLineup,
  seedPinballMapCatalogEntry,
  setMachinePinballMapTitle,
} from "../support/supabase-admin.js";

test.describe("Pinball Map lineup page (PP-o355.65)", () => {
  test("anonymous visitors are sent to sign in", async ({ request }) => {
    const response = await request.get("/m/pinball-map", {
      headers: { "x-skip-autologin": "true" },
      maxRedirects: 0,
    });
    expect(response.status()).toBeGreaterThanOrEqual(300);
    expect(response.status()).toBeLessThan(400);
    expect(response.headers()["location"]).toMatch(/\/login/);
  });

  test.describe("as admin", () => {
    test.use({ storageState: STORAGE_STATE.admin });

    test("reaches the page from the machines list and the admin menu, and every row leads where it says", async ({
      page,
    }) => {
      const toAddInitials = getTestMachineInitials();
      const unlinkedInitials = getTestMachineInitials();
      // Run-scoped ids so parallel workers never share a catalog primary key
      // or a stored-lineup entry.
      const base = Math.floor(Math.random() * 9_000_000) * 10;
      const toAddTitleId = 920_000_000 + base;
      const entryTitleId = 920_000_001 + base;
      const entryLmxId = 820_000_000 + base;
      const toAddName = `Zz E2E Lineup Add ${String(base)}`;
      const entryName = `Zz E2E Lineup Entry ${String(base)}`;

      try {
        const adminId = await getProfileIdByEmail(TEST_USERS.admin.email);
        await createTestMachine(adminId, toAddInitials);
        const unlinked = await createTestMachine(adminId, unlinkedInitials);
        await seedPinballMapCatalogEntry({
          pinballmapMachineId: toAddTitleId,
          name: toAddName,
        });
        await seedPinballMapCatalogEntry({
          pinballmapMachineId: entryTitleId,
          name: entryName,
        });
        // On the lineup in PinPoint, absent from Pinball Map: Out of sync.
        await setMachinePinballMapTitle(toAddInitials, {
          pinballmapMachineId: toAddTitleId,
          intent: "on",
        });
        // On Pinball Map, no PinPoint machine: On Pinball Map, not linked.
        await addLmxToStoredLineup({
          pinballmapMachineId: entryTitleId,
          pinballmapLmxId: entryLmxId,
        });

        // Entry point 1: the machines list header button.
        await page.goto("/m");
        await page.getByTestId("pinball-map-lineup-button").click();
        await expect(page).toHaveURL(/\/m\/pinball-map$/);
        await expect(
          page.getByRole("heading", { name: "Pinball Map lineup" })
        ).toBeVisible();

        // Summary and section headings for the seeded state.
        await expect(page.getByTestId("pbm-lineup-summary")).toContainText(
          /\d+ to review/
        );
        for (const name of [
          "Out of sync",
          "In PinPoint, not linked to Pinball Map",
          "On Pinball Map, not linked to a PinPoint machine",
        ]) {
          await expect(
            page.getByRole("heading", { name, level: 3 })
          ).toBeVisible();
        }

        const addRow = page.getByTestId(
          `pbm-lineup-row-to_add-${String(toAddTitleId)}`
        );
        await expect(addRow).toContainText(toAddName);
        await expect(addRow).toContainText("To add");
        // The row offers the one push its tag names: the confirm button,
        // because the reset chain links the admin to a fake Pinball Map
        // account (seed-pinballmap-state.ts). Without one it would link out to
        // the location instead. The page never writes on its own (5.7, 5.8).
        await expect(
          addRow.getByRole("button", { name: "Add to Pinball Map" })
        ).toBeVisible();

        // The badge on /m shows the same count as the page.
        const summary =
          (await page.getByTestId("pbm-lineup-summary").textContent()) ?? "";
        const pageCount = /(\d+) to review/.exec(summary)?.[1];
        await page.goto("/m");
        await expect(
          page.getByTestId("pinball-map-lineup-to-review")
        ).toContainText(String(pageCount));

        // Entry point 2: the admin menu item.
        await page.getByTestId("user-menu-button").click();
        await page
          .getByRole("menuitem", { name: "Pinball Map lineup" })
          .click();
        await expect(page).toHaveURL(/\/m\/pinball-map$/);

        // Create in PinPoint: name and Pinball Map title preselected.
        const entryRow = page.getByTestId(
          `pbm-lineup-row-entry-${String(entryLmxId)}`
        );
        await expect(entryRow).toContainText(entryName);
        await entryRow
          .getByRole("link", { name: "Create in PinPoint" })
          .click();
        await expect(page).toHaveURL(/\/m\/new\?/);
        await expect(page.getByLabel("Machine Name")).toHaveValue(entryName);
        await expect(page.getByTestId("pinballmap-link-select")).toContainText(
          entryName
        );

        // Edit Machine: an unlinked PinPoint machine leads to its edit page.
        await page.goto("/m/pinball-map");
        const unlinkedRow = page.getByTestId(
          `pbm-lineup-row-machine-${unlinked.id}`
        );
        await unlinkedRow.getByRole("link", { name: "Edit Machine" }).click();
        await expect(page).toHaveURL(
          new RegExp(`/m/${unlinkedInitials}/edit$`)
        );
      } finally {
        await cleanupTestEntities({
          machineInitials: [toAddInitials, unlinkedInitials],
        });
        await deletePinballMapCatalogEntries([toAddTitleId, entryTitleId]);
        await removeLmxFromStoredLineup([entryLmxId]);
      }
    });
  });

  test.describe("Confirm lineup as admin", () => {
    test.use({ storageState: STORAGE_STATE.admin });

    test("confirms from the header after warning about an unlinked entry", async ({
      page,
    }) => {
      const base = Math.floor(Math.random() * 9_000_000) * 10;
      const entryTitleId = 930_000_000 + base;
      const entryLmxId = 830_000_000 + base;
      const entryName = `Zz E2E Confirm Entry ${String(base)}`;

      try {
        await seedPinballMapCatalogEntry({
          pinballmapMachineId: entryTitleId,
          name: entryName,
        });
        await addLmxToStoredLineup({
          pinballmapMachineId: entryTitleId,
          pinballmapLmxId: entryLmxId,
        });
        await markStoredLineupFresh();

        await page.goto("/m/pinball-map");
        await page
          .getByRole("button", { name: "Confirm lineup on Pinball Map" })
          .click();
        const dialog = page.getByTestId("pbm-confirm-lineup-dialog");
        const entry = dialog
          .getByTestId("pbm-confirm-lineup-entries")
          .getByRole("listitem")
          .filter({ hasText: entryName });
        await expect(entry).toContainText("Not linked");

        await dialog.getByRole("button", { name: "Confirm anyway" }).click();
        await expect(dialog).toBeHidden();
        await expect(
          page.getByText("Lineup confirmed on Pinball Map")
        ).toBeVisible();
      } finally {
        await deletePinballMapCatalogEntries([entryTitleId]);
        await removeLmxFromStoredLineup([entryLmxId]);
      }
    });
  });

  test.describe("as member", () => {
    test.use({ storageState: STORAGE_STATE.member });

    test("a member reaches the page from the Pinball Map button on /m", async ({
      page,
    }) => {
      await page.goto("/m");
      await page.getByRole("link", { name: /^Pinball Map/ }).click();
      await expect(page).toHaveURL(/\/m\/pinball-map$/);
      await expect(
        page.getByRole("heading", { name: "Pinball Map lineup" })
      ).toBeVisible();
      // Confirming vouches for the whole venue: technicians and admins only.
      await expect(page.getByTestId("pbm-lineup-header")).toBeVisible();
      await expect(page.getByTestId("pbm-confirm-lineup")).toHaveCount(0);
    });
  });
});
