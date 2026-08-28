/**
 * E2E Tests: Collection view (PP-slrd.1)
 *
 * Smoke coverage for the /c/owner/[userId] tabbed page: user-menu entry
 * point, all three tabs render without 500, and the owner-name link on a
 * machine Info tab lands on that owner's collection.
 *
 * Fixtures: the seeded member user owns SC, HB, EBD, AFM, SM, GDZ2 (see
 * supabase/seed-users.mjs ownerMap), so "My Machines" is non-empty.
 */

import { test, expect } from "../support/fixtures.js";
import { STORAGE_STATE } from "../support/auth-state.js";
import {
  assertNoA11yViolations,
  assertNoHorizontalOverflow,
  retryNavClick,
} from "../support/actions.js";
import { seededMachines } from "../support/constants.js";

test.describe("Collection view (PP-slrd.1)", () => {
  test.use({ storageState: STORAGE_STATE.member });

  test("My Machines via user menu renders Overview without 500", async ({
    page,
  }) => {
    await page.goto("/");
    // Re-issue the menu navigation until it takes (PP-2b3r). retryNavClick
    // presses Escape before each attempt to reset a Radix dropdown left open
    // by a prior failed click, and caps the timeout so sequential retries fit
    // inside the 120 s CI test budget.
    await retryNavClick(
      page,
      async () => {
        await page.getByTestId("user-menu-button").click();
        await page.getByTestId("user-menu-my-machines").click();
      },
      /\/c\/owner\//
    );
    await expect(page.getByTestId("collection-summary")).toBeVisible();
    await expect(page.getByTestId("collection-overview-body")).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await assertNoA11yViolations(page);
  });

  test("Issues and Timeline tabs render without 500", async ({ page }) => {
    await page.goto("/");
    // Each hop is a client-side navigation that a Fast Refresh remount can
    // discard; retryNavClick re-issues the click until it takes (PP-2b3r).
    // Three sequential retries at 15 s each = 45 s worst case, well inside
    // the 120 s CI per-test timeout.
    await retryNavClick(
      page,
      async () => {
        await page.getByTestId("user-menu-button").click();
        await page.getByTestId("user-menu-my-machines").click();
      },
      /\/c\/owner\//
    );
    await retryNavClick(
      page,
      async () => {
        await page.getByTestId("collection-tab-issues").click();
      },
      /\/issues$/
    );
    await expect(page.getByTestId("collection-summary")).toBeVisible();
    await assertNoA11yViolations(page);
    await retryNavClick(
      page,
      async () => {
        await page.getByTestId("collection-tab-timeline").click();
      },
      /\/timeline$/
    );
    await expect(page.getByTestId("collection-summary")).toBeVisible();
    await assertNoA11yViolations(page);
  });

  test("owner name on machine info links to the owner's profile", async ({
    page,
  }) => {
    // AFM is owned by the member user (seed-users.mjs ownerMap).
    await page.goto(`/m/${seededMachines.attackFromMars.initials}`);
    // Scope to the owner block: the owner card can also contain a description
    // above the owner row, and a description with links would make a bare
    // getByRole("link") ambiguous.
    //
    // Retry the click rather than clicking once (PP-j1qm). Playwright runs
    // against `next dev`, and the trace from a CI failure shows the click
    // landing and then `[Fast Refresh] done in 7608ms` — a rebuild remounts the
    // React tree mid-navigation, the soft navigation is discarded, and the URL
    // never changes. Nothing is wrong with the link; the click was thrown away.
    // Waiting for the page to settle first cannot fix it, because the rebuild
    // can land after any wait; only re-issuing the click can.
    //
    // The hydration fixture this spec now imports (PP-kz47) does not subsume
    // this, and the retry is not leftover belt-and-braces. That fixture waits
    // for the FIRST hydration after a navigation; the trace here shows the
    // click landing on an already-hydrated page that a later rebuild then
    // remounted. Its own docs draw the same line — it narrows the window
    // rather than closing it. Removing this retry re-opens PP-j1qm.
    await retryNavClick(
      page,
      async () => {
        await page.getByTestId("owner-block").getByRole("link").click();
      },
      /\/u\//,
      { timeout: 30_000 }
    );
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});
