/**
 * Soft-keyboard reflow guard for the Machine Settings tab (PP-a0pl, Part 2).
 *
 * WHAT THIS PROVES (and what it can't):
 *
 * No headless browser has a real on-screen keyboard, so the true failure — the
 * OS keyboard painting over a focused editor — is un-simulatable here (that
 * needs a physical device or a paid real-device cloud; PP-a0pl Part 3). What we
 * CAN do is drive the *consequence* of the fix: with the root
 * `interactive-widget=resizes-content` viewport (src/app/layout.tsx), an open
 * keyboard shrinks the layout viewport to a short window, and content must
 * reflow / scroll so the focused field stays reachable. We reproduce that short
 * window by pinning a keyboard-open-height viewport (390×430) and assert every
 * key typing surface on the Settings tab lands inside it once focused.
 *
 * This is a REACHABILITY / REFLOW proxy, not a pixel-exact keyboard-geometry
 * test — it catches gross regressions (a field trapped in a clipped or
 * non-scrollable container, a permanently-occluding sticky element) rather than
 * "the keyboard overlaps by N px". Same honest limit the RowEditSheet unit test
 * records (src/test/unit/components/machines/RowEditSheet.test.tsx).
 *
 * Runs across every configured project — including "Mobile Safari" (WebKit),
 * the closest headless proxy for iOS Safari, which ignores `interactive-widget`
 * and therefore exercises the cross-browser `scrollIntoView`-on-focus floor.
 */

import { test, expect, type Locator } from "@playwright/test";
import { STORAGE_STATE } from "../support/auth-state.js";
import { seededMachines } from "../support/constants.js";
import {
  createTestMachine,
  deleteTestMachine,
  getProfileIdByEmail,
  seedSettingsSet,
} from "../support/supabase-admin.js";

const machine = seededMachines.addamsFamily.initials;

// A phone with the software keyboard open: an iPhone-12-class width with the
// visible height collapsed to what remains above the keyboard. Under
// `interactive-widget=resizes-content` this is exactly the geometry a real
// keyboard produces, so it is a faithful stand-in for "keyboard is up".
const KEYBOARD_OPEN = { width: 390, height: 430 } as const;

/** After focusing a field, it must sit inside the (short) visible viewport. */
async function expectReachable(locator: Locator): Promise<void> {
  await expect(locator).toBeInViewport();
}

test.describe("Soft-keyboard reflow (PP-a0pl)", () => {
  test.use({
    storageState: STORAGE_STATE.admin,
    viewport: KEYBOARD_OPEN,
  });

  test("machine-wide guidance editors stay reachable with the keyboard up", async ({
    page,
  }) => {
    test.slow();
    await page.goto(`/m/${machine}/settings`);

    // The two always-open TipTap callouts stack near the top of the tab; the
    // second one starts below the fold at keyboard-open height, so focusing it
    // must scroll it into the short viewport (the exact reflow the fix enables).
    for (const testId of [
      "machine-settings-requests",
      "machine-settings-instructions",
    ]) {
      const field = page.getByTestId(testId);
      // "How to change settings" is a collapsible <details>, collapsed by
      // default (PP-tn6t) — open it via its summary before reaching the editor.
      // "Before you change anything" is always-open and has no summary.
      const summary = field.locator("summary");
      if ((await summary.count()) > 0) await summary.click();
      const editor = field.locator(".ProseMirror").first();
      await editor.click();
      await expect(editor).toBeFocused();
      await expectReachable(editor);
    }
  });

  test.describe("RowEditSheet input (isolated seeded machine)", () => {
    let machineId: string;
    let machineInitials: string;

    test.beforeEach(async () => {
      const adminId = await getProfileIdByEmail("admin@test.com");
      const created = await createTestMachine(adminId);
      machineId = created.id;
      machineInitials = created.initials;
      await seedSettingsSet(machineId, "PP-a0pl keyboard set", [
        {
          id: "e2e-software",
          kind: "software",
          baseline: "Factory",
          rows: [{ id: "A.1 01", name: "Balls Per Game", value: "3" }],
        },
      ]);
    });

    test.afterEach(async () => {
      // ON DELETE CASCADE drops the seeded set with the machine.
      await deleteTestMachine(machineId);
    });

    test("a focused sheet input rides above the keyboard fold", async ({
      page,
    }) => {
      test.slow();
      await page.goto(`/m/${machineInitials}/settings`);

      // Sets render collapsed by default (PP-tn6t) — expand the seeded set to
      // reveal its rows.
      await page
        .getByRole("button", {
          name: "Expand PP-a0pl keyboard set settings set",
        })
        .click();

      // Below md (390px < 767px) the settings row is tap-to-edit: tapping it
      // opens the bottom RowEditSheet rather than an inline cell.
      await page.getByText("Balls Per Game").click();
      const sheet = page.getByRole("dialog");
      await expect(sheet).toBeVisible();

      // Focus the sheet's first text input and confirm it isn't stranded behind
      // the (simulated) keyboard fold.
      const firstInput = sheet.getByRole("textbox").first();
      await firstInput.click();
      await expect(firstInput).toBeFocused();
      await expectReachable(firstInput);
    });
  });
});
