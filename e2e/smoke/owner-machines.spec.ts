/**
 * E2E Tests: A person's machines (spec collections-and-tags 6.4–6.5)
 *
 * A person's machines are the Machines list filtered by Owner; Owner
 * Collections are retired. Smoke coverage for the account-menu entry point,
 * the permanent redirects from old Owner Collection links (which must work
 * for anonymous visitors), and the owner-name link on a machine's Info tab.
 *
 * Fixtures: the seeded member user owns SC, HB, EBD, AFM, SM, GDZ2 (see
 * supabase/seed-users.mjs ownerMap); The Addams Family belongs to the admin.
 */

import { test, expect } from "../support/fixtures.js";
import { STORAGE_STATE } from "../support/auth-state.js";
import {
  assertNoA11yViolations,
  assertNoHorizontalOverflow,
  retryNavClick,
} from "../support/actions.js";
import { seededMachines, seededMember } from "../support/constants.js";
import { getProfileIdByEmail } from "../support/supabase-admin.js";

const ownedMachine = seededMachines.attackFromMars.name;
const otherOwnersMachine = seededMachines.addamsFamily.name;

test.describe("A person's machines", () => {
  test.describe("signed in", () => {
    test.use({ storageState: STORAGE_STATE.member });

    test("My Machines in the account menu opens Machines filtered to Me", async ({
      page,
    }) => {
      await page.goto("/");
      // Re-issue the menu navigation until it takes (PP-2b3r). retryNavClick
      // presses Escape before each attempt to reset a Radix dropdown left open
      // by a prior failed click.
      await retryNavClick(
        page,
        async () => {
          await page.getByTestId("user-menu-button").click();
          await page.getByTestId("user-menu-my-machines").click();
        },
        /\/m\?owner=me$/
      );
      await expect(
        page.getByRole("link", { name: ownedMachine, exact: true })
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: otherOwnersMachine, exact: true })
      ).toHaveCount(0);
      await assertNoHorizontalOverflow(page);
      await assertNoA11yViolations(page);
    });

    test("owner name on machine info links to the owner's profile", async ({
      page,
    }) => {
      // AFM is owned by the member user (seed-users.mjs ownerMap).
      await page.goto(`/m/${seededMachines.attackFromMars.initials}`);
      // Scope to the owner block: the page also renders the machine description,
      // and a description with links would make a bare getByRole("link")
      // ambiguous.
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

  // Old Owner Collection links (spec 6.5). Anonymous: no session, and the
  // header keeps local dev autologin from signing the request in.
  test.describe("old Owner Collection links", () => {
    test.use({
      storageState: { cookies: [], origins: [] },
      extraHTTPHeaders: { "x-skip-autologin": "true" },
    });

    let memberId = "";
    test.beforeAll(async () => {
      memberId = await getProfileIdByEmail(seededMember.email);
    });

    test("redirect permanently to the owner-filtered lists", async ({
      request,
    }) => {
      const cases = [
        { tab: "", list: "/m" },
        { tab: "/timeline", list: "/m" },
        { tab: "/issues", list: "/issues" },
      ];
      for (const { tab, list } of cases) {
        const response = await request.get(`/c/owner/${memberId}${tab}`, {
          maxRedirects: 0,
        });
        expect(response.status(), `/c/owner/[member]${tab}`).toBe(308);
        expect(response.headers()["location"]).toMatch(
          new RegExp(`${list}\\?owner=${memberId}$`)
        );
      }
    });

    test("land on Machines showing only that owner's machines", async ({
      page,
    }) => {
      await page.goto(`/c/owner/${memberId}`);
      await expect(page).toHaveURL(new RegExp(`/m\\?owner=${memberId}$`));
      await expect(
        page.getByRole("link", { name: ownedMachine, exact: true })
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: otherOwnersMachine, exact: true })
      ).toHaveCount(0);
    });
  });
});
