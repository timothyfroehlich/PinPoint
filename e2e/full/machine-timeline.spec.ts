/**
 * E2E Tests for Machine Timeline (PP-0x98)
 *
 * Three class-F multi-step user journeys:
 * - Member posts a comment → it appears on the timeline
 * - Tag filter URL param round-trips through the dropdown
 * - Reassigning an issue surfaces events on BOTH machines' timelines
 *
 * Permission splits (admin/author/owner vs third-party) are class-E and
 * covered by integration tests at
 * src/test/integration/machine-timeline-permissions.test.ts — adding E2E
 * versions would be misallocation per AGENTS.md rule 9 (Interaction Coverage
 * at the Cheapest Layer).
 *
 * Reassign-flow selectors are stable per PP-3hb (issues-reassign-machine.spec.ts).
 */

import { test, expect } from "@playwright/test";
import { STORAGE_STATE } from "../support/auth-state";
import { seededMachines, seededIssues } from "../support/constants";

const machineA = seededMachines.addamsFamily.initials;
const machineB = seededMachines.eightBallDeluxe.initials;
const issueNumber = seededIssues.TAF[0].num;

const PREFIX = "E2E PP-0x98";

test.describe("Machine Timeline (PP-0x98)", () => {
  test.describe("member journeys", () => {
    test.use({ storageState: STORAGE_STATE.member });

    test("can post a comment and see it appear on the timeline", async ({
      page,
    }) => {
      const body = `${PREFIX} cleaned playfield ${Date.now().toString()}`;

      await page.goto(`/m/${machineA}/timeline`);

      // Expand the composer (collapsed trigger renders "What did you do?").
      await page.getByText(/what did you do/i).click();

      // Select the "maintenance" tag via the composer's "Tag" combobox.
      await page.getByRole("combobox", { name: "Tag" }).click();
      await page.getByRole("option", { name: /maintenance/i }).click();

      // The RichTextEditor is a Tiptap/ProseMirror surface — use the documented
      // .ProseMirror selector + keyboard.type() pattern (see e2e/support/page-helpers.ts
      // and e2e/full/rich-text.spec.ts; .fill() is unreliable on contenteditable).
      const editor = page.locator(".ProseMirror").first();
      await editor.waitFor({ state: "visible", timeout: 15_000 });
      await editor.click();
      await page.keyboard.type(body);

      await page.getByRole("button", { name: /^post$/i }).click();

      await expect(page.getByText(body)).toBeVisible({ timeout: 10_000 });
    });

    test("tag filter URL param ?tag= round-trips through the dropdown", async ({
      page,
    }) => {
      await page.goto(`/m/${machineA}/timeline?tag=maintenance`);

      // The MachineTimelineFilter's SelectTrigger has aria-label="Filter by tag".
      const trigger = page.getByRole("combobox", { name: /filter by tag/i });
      await expect(trigger).toContainText(/maintenance/i);
    });
  });

  test.describe("admin reassign journey", () => {
    test.use({ storageState: STORAGE_STATE.admin });

    test("reassigning an issue surfaces events on BOTH timelines", async ({
      page,
    }) => {
      // 1. Open the source issue on machine A.
      await page.goto(`/m/${machineA}/i/${issueNumber.toString()}`);

      // 2. Reassign via kebab menu → reassign → pick destination → confirm.
      await page.getByTestId("issue-actions-menu-trigger").click();
      await page.getByTestId("issue-actions-menu-reassign").click();

      // The reassign dialog renders a searchable combobox — filter by the
      // destination's initials so the option becomes selectable.
      const dialog = page.getByRole("alertdialog");
      await expect(dialog).toBeVisible();
      await dialog.getByPlaceholder("Search machines…").fill(machineB);
      await page.getByTestId(`reassign-option-${machineB}`).click();
      await page.getByTestId("reassign-confirm").click();

      // After success the issue lives at /m/<machineB>/i/<num>.
      await page.waitForURL(new RegExp(`/m/${machineB}/i/[0-9]+$`), {
        timeout: 15_000,
      });

      // 3. Source machine timeline shows the "moved to" system row.
      await page.goto(`/m/${machineA}/timeline`);
      await expect(page.getByText(/moved to/i)).toBeVisible({
        timeout: 10_000,
      });

      // 4. Destination machine timeline shows the "received from" system row.
      await page.goto(`/m/${machineB}/timeline`);
      await expect(page.getByText(/received from/i)).toBeVisible({
        timeout: 10_000,
      });
    });
  });
});
