/**
 * E2E: retitling a linked+listed machine surfaces the abandoned-listing
 * notice on its Manage tab, and a warning on Info that points at it
 * (PP-l81u, moved by PP-o355.21).
 *
 * What this guards is a TWO-PAGE trail that no cheaper layer can see. The
 * notice lives on Manage, next to the controls that resolve it; the only thing
 * that tells a reader to go there is the "Config issue" warning on Info. Break
 * either end — drop `abandoned.length > 0` from the Manage page, or drop the
 * abandonment term from Info's `configIssue` — and the notice becomes
 * unreachable while every unit and integration test stays green, because they
 * render a component directly or stop at the database.
 *
 * It is also the one layer that catches the state being wrong rather than
 * absent: a machine that just retitled off a listing is no longer
 * `pinballmapListed` and derives as plain "not listed", so nothing about its
 * own listing hints that it left something behind.
 *
 * Catalog entries and the "already listed" starting state are seeded
 * directly via `supabase-admin` helpers rather than through a real
 * pinballmap.com sync — CORE-PBM-001/CORE-TEST-006 forbid reaching the real
 * service from a test, and the local catalog mirror table is exactly what
 * the picker searches against in production too.
 */

import { test, expect } from "../support/fixtures.js";
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

  test("retitling a listed machine leaves a notice on Manage and a warning on Info", async ({
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

    // Seeding lives INSIDE the try so the finally actually covers it. A throw
    // partway through — the second catalog insert, the link — would otherwise
    // leak a machine and a catalog row into the shared local database, and a
    // stray catalog row is searchable by the picker in every other spec.
    try {
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
      // link — that's what the notice reports. Assert the text, not just the
      // testid: the whole point of this notice is that it names a title which
      // is NOT this machine's current one, and a testid-only assertion would
      // survive the copy naming the wrong title entirely.
      await page.reload();
      await expect(
        page.getByTestId("machine-pinballmap-abandoned")
      ).toContainText(`Previous listing still live: “${oldTitleName}”`);
      // The listing control above it speaks for the machine's CURRENT standing,
      // which is what keeps the notice from reading as a bug about the wrong
      // game.
      //
      // "Unsynced" is the CORRECT expectation here, not a compromise: no test
      // ever fetches a lineup from pinballmap.com (CORE-PBM-001 /
      // CORE-TEST-006), so `pinballmap_state` carries no snapshot and PinPoint
      // genuinely has no evidence either way. Asserting it is worth a line —
      // "Not listed" in this exact situation is the lie the control this
      // replaces told APC's entire fleet, and it would be an easy one to
      // reintroduce by treating a missing snapshot as an empty lineup.
      await expect(page.getByTestId("pbm-listing-status")).toContainText(
        "hasn't read Pinball Map's lineup yet"
      );

      // The other half of the trail: Info's warning is what sends a reader
      // here, so a notice that only Manage knows about would never be found.
      await page.goto(`/m/${initials}`);
      await expect(
        page.getByTestId("machine-pinballmap-config-issue")
      ).toHaveAttribute("href", `/m/${initials}/edit`);
    } finally {
      await cleanupTestEntities(request, { machineInitials: [initials] });
      await deletePinballMapCatalogEntries([oldTitleId, newTitleId]);
    }
  });
});
