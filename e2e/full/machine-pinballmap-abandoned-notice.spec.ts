/**
 * E2E: retitling a linked+listed machine surfaces the abandoned-listing
 * notice on its Info tab (PP-l81u).
 *
 * The line this guards is `src/app/(app)/m/[initials]/(tabs)/page.tsx`'s
 * render gate for the PinballMap card:
 *
 *   machine.pinballmapListed || showDesync || showAbandoned
 *
 * A machine that just retitled off a listing is, by definition, no longer
 * `pinballmapListed`, and `derivePbmMachineStatus` correctly reports it `ok`
 * (it points at a new title with no listing under it) — so the first two
 * disjuncts are false exactly when the notice is needed. Deleting
 * `|| showAbandoned` leaves the card, and the notice inside it, unreachable
 * for anyone, while every unit and integration test (which render the card
 * directly or stop at the database) stays green. This is the one layer that
 * goes through the real page and can catch that.
 *
 * Catalog entries and the "already listed" starting state are seeded
 * directly via `supabase-admin` helpers rather than through a real
 * pinballmap.com sync — CORE-PBM-001/CORE-TEST-006 forbid reaching the real
 * service from a test, and the local catalog mirror table is exactly what
 * the picker searches against in production too.
 */

import { test, expect } from "@playwright/test";
import { STORAGE_STATE } from "../support/auth-state.js";
import {
  getTestPrefix,
  getTestMachineInitials,
} from "../support/test-isolation.js";
import { cleanupTestEntities } from "../support/cleanup.js";
import {
  createTestMachine,
  getProfileIdByEmail,
  seedPinballMapCatalogEntry,
  deletePinballMapCatalogEntries,
  linkMachineToPinballMap,
} from "../support/supabase-admin.js";

test.describe("PinballMap abandoned-listing notice (PP-l81u)", () => {
  test.use({ storageState: STORAGE_STATE.technician });

  test("retitling a listed machine shows the abandoned-listing notice on Info", async ({
    page,
    request,
  }) => {
    const prefix = getTestPrefix();
    const initials = getTestMachineInitials();
    // Run-scoped integer ids so parallel runs never collide on the catalog's
    // primary key or the machines_pinballmap_listed_unique index. Randomised
    // rather than clock-derived, and each run claims a whole block of 10:
    // `Date.now() % 1_000_000` puts two workers that start 1 ms apart one
    // integer apart, which is exactly the gap between this test's OLD and NEW
    // title ids — worker A's newTitleId would be worker B's oldTitleId, one
    // insert would fail on the catalog PK, and A's cleanup would delete B's
    // row mid-test.
    const base = Math.floor(Math.random() * 9_000_000) * 10;
    const oldTitleId = 900_000_000 + base;
    const newTitleId = 900_000_000 + base + 1;
    const lmxId = 800_000_000 + base;
    const oldTitleName = `Zz E2E Old Title ${prefix}`;
    const newTitleName = `Zz E2E New Title ${prefix}`;

    const technicianId = await getProfileIdByEmail("technician@test.com");
    await createTestMachine(technicianId, initials);

    await seedPinballMapCatalogEntry({
      pinballmapMachineId: oldTitleId,
      name: oldTitleName,
      manufacturer: "E2E Test Co",
      year: 2020,
    });
    await seedPinballMapCatalogEntry({
      pinballmapMachineId: newTitleId,
      name: newTitleName,
      manufacturer: "E2E Test Co",
      year: 2021,
    });
    await linkMachineToPinballMap(initials, {
      pinballmapMachineId: oldTitleId,
      pinballmapLmxId: lmxId,
    });

    try {
      await page.goto(`/m/${initials}/edit`);

      // Retitle: open the catalog picker and choose a different title. Both
      // seeded entries are standalone (no machine group), so the pick
      // resolves immediately with no edition step.
      await page.getByTestId("pinballmap-link-select").click();
      await page.getByPlaceholder("e.g. Medieval Madness").fill(newTitleName);
      const result = page
        .locator("[data-slot=command-item]")
        .filter({ hasText: newTitleName });
      await expect(result).toBeVisible({ timeout: 5000 });
      await result.click();
      await expect(page.getByTestId("pinballmap-link-select")).toContainText(
        newTitleName
      );

      await page.getByRole("button", { name: "Save details" }).click();
      await expect(page.getByTestId("details-dirty-note")).toHaveText("Saved", {
        timeout: 10000,
      });

      // The old title's entry is still live on pinballmap.com under the OLD
      // link — that's what the notice on Info is reporting.
      await page.goto(`/m/${initials}`);
      await expect(
        page.getByTestId("machine-pinballmap-abandoned")
      ).toBeVisible();
    } finally {
      await cleanupTestEntities(request, { machineInitials: [initials] });
      await deletePinballMapCatalogEntries([oldTitleId, newTitleId]);
    }
  });
});
