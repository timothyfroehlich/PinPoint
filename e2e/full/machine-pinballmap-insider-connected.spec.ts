/**
 * E2E: the Insider Connected toggle on a machine's Manage tab (spec 3.8, 4.1).
 *
 * What only this layer sees is the join: eligibility lives on the catalog row,
 * Pinball Map's value on the stored lineup entry, the intent on the machine
 * row, and the toggle appears only when the loader carries the catalog flag
 * through to the control. Unit tests
 * render the control with a view handed to them, and integration tests stop at
 * the action; dropping `icEligible` from the loader would pass both.
 *
 * The E2E technician has no linked Pinball Map account, which is the case the intent
 * exists for: the toggle still records the intent, and the difference shows as
 * Out of sync. How the control renders that is the unit tests' job, and the
 * push path is `src/test/integration/pinballmap-insider-connected.test.ts`.
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

test.describe("Pinball Map Insider Connected toggle (PP-o355.59, PP-o355.67)", () => {
  test.use({ storageState: STORAGE_STATE.technician });

  for (const { icEligible, rowCount } of [
    { icEligible: true, rowCount: 1 },
    { icEligible: false, rowCount: 0 },
  ]) {
    test(`${icEligible ? "shows" : "hides"} the toggle for an ${icEligible ? "eligible" : "ineligible"} title`, async ({
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
        await expect(page.getByTestId("pbm-insider-connected")).toHaveCount(
          rowCount
        );
        if (!icEligible) return;

        const toggle = page.getByRole("radiogroup", {
          name: "Insider Connected",
        });
        const dontSync = toggle.getByRole("radio", { name: "Don't sync" });
        const off = toggle.getByRole("radio", { name: "Off" });
        const outOfSync = page.getByTestId("pbm-listing-out-of-sync");

        // No intent yet: Don't sync, stating Pinball Map's value, unflagged.
        await expect(dontSync).toBeChecked();
        await expect(
          page.getByTestId("pbm-insider-connected-observed")
        ).toHaveText("Pinball Map: On");
        await expect(outOfSync).toHaveCount(0);

        // Recording Off needs no credential (3.8). After revalidation the
        // loader derives the difference from the stored intent and lineup; how
        // the control renders it is the unit tests' job.
        await off.click();
        await expect(off).toBeChecked();
        await expect(outOfSync).toBeVisible();

        // Back to Don't sync clears the stored intent, and with it the flag.
        await dontSync.click();
        await expect(dontSync).toBeChecked();
        await expect(outOfSync).toHaveCount(0);
      } finally {
        await cleanupTestEntities(request, { machineInitials: [initials] });
        await deletePinballMapCatalogEntries([titleId]);
        // The stored lineup is shared across every spec in the run.
        await removeLmxFromStoredLineup([lmxId]);
      }
    });
  }
});
