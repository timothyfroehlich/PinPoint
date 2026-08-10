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
 * versions would be misallocation per CORE-TEST-005 (Interaction Coverage
 * at the Cheapest Catching Layer).
 *
 * Reassign-flow selectors are stable per PP-3hb (issues-reassign-machine.spec.ts).
 */

import { test, expect } from "@playwright/test";
import { openDropdownMenu } from "../support/actions.js";
import { STORAGE_STATE } from "../support/auth-state.js";
import { cleanupTestEntities } from "../support/cleanup.js";
import { seededMachines } from "../support/constants.js";
import {
  fillReportForm,
  submitFormAndWaitForRedirect,
} from "../support/page-helpers.js";

const machineA = seededMachines.addamsFamily.initials;
const machineB = seededMachines.eightBallDeluxe.initials;

// PREFIX tags note bodies; REASSIGN_PREFIX is the human-readable stem of the
// reassign journey's issue title (the run appends its own unique suffix).
const PREFIX = "E2E PP-0x98";
const REASSIGN_PREFIX = `${PREFIX} Reassign`;

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

      const recentActivity = page.getByRole("region", {
        name: /recent activity/i,
      });
      await expect(
        recentActivity.getByRole("heading", { name: /recent activity/i })
      ).toBeVisible();

      // Scope to the Recent activity region — the player hero also has a
      // "View all on Service" link, so an unscoped /view all/ now matches two.
      await recentActivity.getByRole("link", { name: /view all/i }).click();
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

  // Reassignment is a ONE-WAY move of a real row, so this journey files its own
  // issue instead of moving a seeded one. It used to move seeded TAF-01 to EBD
  // and leave it there: TAF-01 then no longer existed at /m/TAF/i/1, so a second
  // run in the same database timed out waiting for the kebab that page never
  // rendered — and machine-info.spec.ts, which asserts TAF-01 in the hero's
  // known-issues peek, went red as collateral. Moving it back is not a repair:
  // a returning issue gets a fresh per-machine number, so TAF-01 would stay
  // gone. (PP-168u.)
  test.describe("admin reassign journey", () => {
    test.use({ storageState: STORAGE_STATE.admin });

    // The exact title this run filed. Cleanup matches on it rather than on
    // REASSIGN_PREFIX: the cleanup endpoint's prefix match is an unbounded
    // `ilike(title, '<prefix>%')` delete, and the comprehensive job runs this
    // same file in three browser projects against one database — a prefix
    // sweep would delete another project's issue mid-reassign.
    let reassignTitle: string | null = null;

    test.afterEach(async ({ request }) => {
      if (reassignTitle === null) return;
      await cleanupTestEntities(request, {
        issueTitlePrefix: reassignTitle,
      });
      reassignTitle = null;
    });

    test("reassigning an issue surfaces events on BOTH timelines", async ({
      page,
    }, testInfo) => {
      // Project + worker in the title so two projects filing in the same
      // millisecond still get distinct titles.
      reassignTitle = `${REASSIGN_PREFIX} ${testInfo.project.name}-${testInfo.workerIndex.toString()}-${Date.now().toString()}`;

      // 1. File a throwaway issue on machine A and land on its detail page.
      await page.goto(`/report?machine=${machineA}`);
      await fillReportForm(page, {
        title: reassignTitle,
        priority: "medium",
      });
      await submitFormAndWaitForRedirect(
        page,
        page.getByRole("button", { name: "Submit Issue Report" }),
        { awayFrom: "/report" }
      );
      await expect(page).toHaveURL(new RegExp(`/m/${machineA}/i/[0-9]+$`));

      // 2. Reassign via kebab menu → reassign → pick destination → confirm.
      // openDropdownMenu, not a bare click: we arrive here straight off the
      // report form's redirect, and the report form's ProseMirror editor can
      // still hold focus when the first click lands — the trigger reports
      // clickable, the click is swallowed, and the menu never opens. The helper
      // asserts aria-expanded and retries once. (issues-reassign-machine.spec.ts
      // opens this same menu the same way after the same flow.)
      await openDropdownMenu(page.getByTestId("issue-actions-menu-trigger"));
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
