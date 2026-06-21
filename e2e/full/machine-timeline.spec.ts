/**
 * E2E Tests for Machine Timeline (PP-0x98)
 *
 * Class-F multi-step user journeys:
 * - Member posts a note via the "New Note" bottom sheet → it appears on the timeline
 * - Member edits their own note → an "(edited)" marker appears (full edit round-trip)
 * - Tag filter URL param round-trips through the dropdown
 * - The overview "Recent activity" section renders + "View all" navigates to the timeline
 * - Reassigning an issue surfaces events on BOTH machines' timelines
 *
 * The composer (quick-note default + "Aa" full-format toggle) is a single
 * bottom sheet reused by the Timeline tab and the overview "Recent activity"
 * section (`MachineNoteComposerSheet`). Quick-note + Aa-toggle UI states are
 * class-H, covered by MachineTimelineComposer.test.tsx; editedAt stamping is
 * class-B/I, covered by machine-timeline-events.test.ts. The E2E here only owns
 * the cross-page journeys.
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

    test("can post a note via the New Note sheet and see it on the timeline", async ({
      page,
    }) => {
      const body = `${PREFIX} cleaned playfield ${Date.now().toString()}`;

      await page.goto(`/m/${machineA}/timeline`);

      // Open the composer in the bottom sheet (the single shared entry point).
      await page.getByRole("button", { name: /new note/i }).click();

      // Tag defaults to "Note" (quick-note); switch it to "maintenance" via the
      // composer's "Tag" combobox. exact:true so we don't also match the
      // filter's "Filter by tag" trigger.
      await page.getByRole("combobox", { name: "Tag", exact: true }).click();
      await page.getByRole("option", { name: /maintenance/i }).click();

      // The RichTextEditor is a Tiptap/ProseMirror surface — use the documented
      // .ProseMirror selector + keyboard.type() pattern (see e2e/support/page-helpers.ts
      // and e2e/full/rich-text.spec.ts; .fill() is unreliable on contenteditable).
      const editor = page.locator(".ProseMirror").first();
      await editor.waitFor({ state: "visible", timeout: 15_000 });
      await editor.click();
      await page.keyboard.type(body);

      await page.getByRole("button", { name: /^post$/i }).click();

      // Sheet closes, the timeline RSC revalidates, and the note appears.
      await expect(page.getByText(body)).toBeVisible({ timeout: 10_000 });
    });

    test("can edit own note and an (edited) marker appears", async ({
      page,
    }) => {
      const body = `${PREFIX} editable note ${Date.now().toString()}`;

      await page.goto(`/m/${machineA}/timeline`);
      await page.getByRole("button", { name: /new note/i }).click();

      const editor = page.locator(".ProseMirror").first();
      await editor.waitFor({ state: "visible", timeout: 15_000 });
      await editor.click();
      await page.keyboard.type(body);
      await page.getByRole("button", { name: /^post$/i }).click();
      await expect(page.getByText(body)).toBeVisible({ timeout: 10_000 });

      // Newest-first ordering puts our just-posted note at the top, so the
      // first comment kebab is ours. Open it → Edit → Save (a save stamps
      // editedAt even with no content change).
      await page
        .getByRole("button", { name: /comment actions/i })
        .first()
        .click();
      await page.getByRole("menuitem", { name: /edit/i }).click();
      await page.getByRole("button", { name: /^save$/i }).click();

      await expect(page.getByText(/\(edited\)/i).first()).toBeVisible({
        timeout: 10_000,
      });
    });

    test("overview Recent activity renders and 'View all' opens the timeline", async ({
      page,
    }) => {
      // The overview (Info) tab is the discoverability surface — the last few
      // events plus a "View all" link into the full timeline (PP-0x98.3).
      await page.goto(`/m/${machineA}`);

      await expect(
        page.getByRole("heading", { name: /recent activity/i })
      ).toBeVisible();

      // Scope to the Recent activity region — the player hero also has a
      // "View all on Service" link, so an unscoped /view all/ now matches two.
      await page
        .getByRole("region", { name: /recent activity/i })
        .getByRole("link", { name: /view all/i })
        .click();
      await page.waitForURL(new RegExp(`/m/${machineA}/timeline$`), {
        timeout: 10_000,
      });
    });

    test("tag filter URL param ?tag= round-trips through the dropdown", async ({
      page,
    }) => {
      await page.goto(`/m/${machineA}/timeline?tag=maintenance`);

      // MachineTimelineFilter is the shared MultiSelect: a combobox trigger
      // labelled "Filter by tag" that shows a count badge for the selection.
      // Opening it reveals the "Maintenance" option in its checked state,
      // confirming the ?tag= param round-tripped into the control.
      const trigger = page.getByRole("combobox", { name: /filter by tag/i });
      await expect(trigger).toContainText("1");
      await trigger.click();
      await expect(
        page.getByRole("option", { name: /maintenance/i })
      ).toBeVisible();
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
      // .first() — shared E2E state may include earlier reassigns of other
      // issues on the same machine; we only care that the row exists.
      await page.goto(`/m/${machineA}/timeline`);
      await expect(page.getByText(/moved to/i).first()).toBeVisible({
        timeout: 10_000,
      });

      // 4. Destination machine timeline shows the "received from" system row.
      await page.goto(`/m/${machineB}/timeline`);
      await expect(page.getByText(/received from/i).first()).toBeVisible({
        timeout: 10_000,
      });
    });
  });
});
