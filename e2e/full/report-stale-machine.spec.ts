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
 *   - Assert the machine picker is empty (placeholder shown), not "first machine".
 *   - Assert the title (from the same draft) DID restore — proving the draft
 *     wasn't wholesale discarded; only the bad machine was dropped.
 *   - Confirm the form refuses submission with no machine (Submit is disabled —
 *     the combobox submits a hidden input the browser can't `required`-validate,
 *     so the button is gated on a selection instead).
 */

import { test, expect } from "../support/fixtures.js";
import { ensureLoggedIn, machineSelectValue } from "../support/actions.js";
import { TEST_USERS } from "../support/constants.js";

const STALE_UUID = "ffffffff-ffff-4fff-8fff-ffffffffffff";

test.describe("UnifiedReportForm — stale localStorage machineId (PP-lql)", () => {
  test("drops stale machineId from localStorage and renders empty placeholder", async ({
    page,
  }, testInfo) => {
    await ensureLoggedIn(page, testInfo, {
      email: TEST_USERS.admin.email,
      password: TEST_USERS.admin.password,
    });

    // Seed the stale draft as an init script, so it is in localStorage before
    // any app code runs on the next navigation.
    //
    // This used to be a `goto` + `evaluate` + `reload`, which raced the draft
    // store: once it has restored, its persist effect rewrites the key with the
    // current (empty) state, so a draft written after navigation only survived
    // if it landed after that effect. The spec won that race by luck rather
    // than by construction — it started failing deterministically the moment
    // anything shifted navigation timing. Seeding pre-navigation removes the
    // window, and drops the reload with it. (PP-jxhy.)
    //
    // The legacy key is deliberate: this exercises the migration path, and the
    // store reads `report_draft` first and falls back to `report_form_state`.
    await page.addInitScript((staleId: string) => {
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
    }, STALE_UUID);

    // The machine select must NOT silently land on machinesList[0].
    await page.goto("/report");

    const machineSelect = page.getByTestId("machine-select");
    await expect(machineSelect).toBeVisible();

    // The picker is empty (placeholder shown) — NOT the first real machine.
    await expect(machineSelect).toContainText("Select a machine");
    await expect(machineSelectValue(page)).toHaveValue("");

    // Other draft fields restored normally — only the invalid machine was dropped.
    await expect(page.getByLabel("Issue Title *")).toHaveValue(
      "PP-lql stale draft restoration"
    );

    // With no machine selected, submission is blocked: the Submit button is
    // disabled until the user picks a machine (replaces native `required`).
    await expect(
      page.getByRole("button", { name: "Submit Issue Report" })
    ).toBeDisabled();
    await expect(machineSelectValue(page)).toHaveValue("");
  });
});
