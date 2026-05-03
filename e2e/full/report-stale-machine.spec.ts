/**
 * E2E regression for PP-lql:
 *
 * If localStorage carries a machineId that is no longer in the current
 * machinesList (deleted machine, switched tenant, abandoned draft), the
 * UnifiedReportForm must NOT silently submit the alphabetically-first machine.
 *
 * Mechanism we are guarding against (proven by select-fallback.test.tsx):
 *   <select value="<stale-uuid>"> with no matching <option> renders — and
 *   submits — the first non-disabled option. Browsers do this by HTML spec.
 *
 * The form-level defense:
 *   1. Restoration only sets selectedMachineId when the parsed.machineId is
 *      in the current machinesList.
 *   2. A defensive useEffect resets selectedMachineId to "" if it ever ends
 *      up referencing a machine not in the list.
 *
 * What this test verifies:
 *   - Seed localStorage with a clearly-stale UUID before navigation.
 *   - Load /report with no URL machine param.
 *   - Assert the machine select is empty (placeholder shown), not "first machine".
 *   - Assert the title (from the same draft) DID restore — proving the draft
 *     wasn't wholesale discarded; only the bad machine was dropped.
 *   - Submit without re-selecting and confirm the form refuses (required attr).
 */

import { test, expect } from "@playwright/test";
import { ensureLoggedIn } from "../support/actions";
import { TEST_USERS } from "../support/constants";

const STALE_UUID = "ffffffff-ffff-4fff-8fff-ffffffffffff";

test.describe("UnifiedReportForm — stale localStorage machineId (PP-lql)", () => {
  test("drops stale machineId from localStorage and renders empty placeholder", async ({
    page,
  }, testInfo) => {
    await ensureLoggedIn(page, testInfo, {
      email: TEST_USERS.admin.email,
      password: TEST_USERS.admin.password,
    });

    // Visit /report once so we are on the right origin to set localStorage.
    await page.goto("/report");

    // Seed localStorage with a stale draft. The machineId UUID does not
    // correspond to any machine in the seeded data set.
    await page.evaluate(
      ([staleId]) => {
        window.localStorage.setItem(
          "report_form_state",
          JSON.stringify({
            machineId: staleId,
            title: "PP-lql stale draft restoration",
            description: null,
            severity: "minor",
            priority: "medium",
            frequency: "constant",
            watchIssue: true,
          })
        );
      },
      [STALE_UUID]
    );

    // Reload so the form re-mounts and restoration runs against the seeded
    // localStorage. The machine select must NOT silently land on machinesList[0].
    await page.reload();

    const machineSelect = page.getByTestId("machine-select");
    await expect(machineSelect).toBeVisible();

    // The dropdown is empty (placeholder) — NOT the first real machine.
    await expect(machineSelect).toHaveValue("");

    // Other draft fields restored normally — only the invalid machine was dropped.
    await expect(page.getByLabel("Issue Title *")).toHaveValue(
      "PP-lql stale draft restoration"
    );

    // Required attribute blocks submission until the user picks a machine.
    await page.getByRole("button", { name: "Submit Issue Report" }).click();
    await expect(page).toHaveURL(/\/report(\?.*)?$/, { timeout: 5000 });
    await expect(machineSelect).toHaveValue("");
  });
});
