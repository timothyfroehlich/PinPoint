/**
 * E2E: the Insider Connected row on a machine's Manage tab (spec 3.8, 4.1).
 *
 * What only this layer sees is the join: eligibility lives on the catalog row,
 * the setting on the stored lineup entry, and the row appears only when the
 * machine loader carries the catalog flag through to the control. Unit tests
 * render the control with a view handed to them, and integration tests stop at
 * the action; dropping `icEligible` from the loader would pass both.
 *
 * The E2E database has no operator credential, so the switch renders read-only
 * — which is itself the 8.2 rule. The write path is covered by
 * `src/test/integration/pinballmap-insider-connected.test.ts`.
 *
 * Catalog rows and the lineup entry are seeded directly; nothing reaches
 * pinballmap.com (CORE-PBM-001 / CORE-TEST-006).
 */

import { test, expect } from "../support/fixtures.js";
import { STORAGE_STATE } from "../support/auth-state.js";
import { TEST_USERS } from "../support/constants.js";
import { getTestMachineInitials } from "../support/test-isolation.js";
import { cleanupTestEntities } from "../support/cleanup.js";
import {
  createTestMachine,
  getProfileIdByEmail,
  seedPinballMapCatalogEntry,
  deletePinballMapCatalogEntries,
  linkMachineToPinballMap,
  removeLmxFromStoredLineup,
} from "../support/supabase-admin.js";

test.describe("Pinball Map Insider Connected row (PP-o355.59)", () => {
  test.use({ storageState: STORAGE_STATE.technician });

  for (const { icEligible, rowCount } of [
    { icEligible: true, rowCount: 1 },
    { icEligible: false, rowCount: 0 },
  ]) {
    test(`${icEligible ? "shows" : "hides"} the row for an ${icEligible ? "eligible" : "ineligible"} title`, async ({
      page,
      request,
    }) => {
      const initials = getTestMachineInitials();
      // Run-scoped ids, one block per run, so parallel workers never share a
      // catalog primary key or a stored-lineup entry.
      const base = Math.floor(Math.random() * 9_000_000) * 10;
      const titleId = 910_000_000 + base;
      const lmxId = 810_000_000 + base;
      const technicianId = await getProfileIdByEmail(
        TEST_USERS.technician.email
      );

      try {
        await createTestMachine(technicianId, initials);
        await seedPinballMapCatalogEntry({
          pinballmapMachineId: titleId,
          name: `Zz E2E IC Title ${String(base)}`,
          icEligible,
        });
        await linkMachineToPinballMap(initials, {
          pinballmapMachineId: titleId,
          pinballmapLmxId: lmxId,
          icEnabled: true,
        });

        await page.goto(`/m/${initials}/edit`);
        await expect(page.getByTestId("pbm-listing-control")).toBeVisible();
        await expect(
          page.getByTestId("pbm-listing-row-insider-connected")
        ).toHaveCount(rowCount);
        if (!icEligible) return;

        const toggle = page.getByRole("switch", { name: "Insider Connected" });
        await expect(toggle).toBeChecked();
        // No operator credential in the E2E database: status only (8.2).
        await expect(toggle).toBeDisabled();
        await expect(
          page.getByTestId("pbm-insider-connected-setting")
        ).toHaveText("On");
      } finally {
        await cleanupTestEntities(request, { machineInitials: [initials] });
        await deletePinballMapCatalogEntries([titleId]);
        // The stored lineup is shared across every spec in the run.
        await removeLmxFromStoredLineup([lmxId]);
      }
    });
  }
});
