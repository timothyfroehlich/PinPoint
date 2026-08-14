/**
 * E2E Tests: Public Routes — Class-A Residuals
 *
 * The bulk of this spec (17 DOWNGRADE-integration blocks) was retired to
 * src/lib/supabase/middleware.test.ts publicRoutes/protectedRoutes arrays
 * (PP-x6nb). Only the class-A cases that require a real browser remain:
 *
 *   1. /m/new redirects to /login — page-level protection (server component
 *      redirect), NOT middleware. middleware.test.ts explicitly defers this to
 *      E2E (see the "Note" comment in that file's protectedRoutes section).
 *
 *   2. /m/[initials]/edit redirects an anonymous viewer to the machine detail
 *      page — page-level protection again (PP-o355.19). `/m/` is public at
 *      middleware (src/lib/supabase/middleware.ts), so the gate lives entirely
 *      in the edit page's own `checkPermission("machines.edit", …)` +
 *      `redirect()` call, unreachable by a middleware-array test.
 *
 * The "machine detail Report Issue button navigates without login wall" test
 * was removed when the tabbed-layout redesign dropped the Report Issue button
 * from the machine detail header (moved to AppHeader / Info-tab actions in
 * follow-up work). Public-route access for `/report` is exercised by
 * middleware.test.ts.
 *
 * One block ("about page links to privacy and terms") was DELETE-redundant:
 * about-page.spec.ts already verifies those links, and middleware.test.ts
 * covers /about, /privacy, /terms as public routes.
 */

import { test, expect } from "../support/fixtures.js";
import { seededMachines } from "../support/constants.js";

test.describe("Public Routes — Class-A Residuals", () => {
  test("/m/new redirects to login (page-level protection)", async ({
    page,
  }) => {
    await page.goto("/m/new");
    await expect(page).toHaveURL(/\/login/);
  });

  test("/m/[initials]/edit redirects an anonymous viewer to the machine detail page (page-level protection)", async ({
    page,
  }) => {
    const { initials, name } = seededMachines.medievalMadness;

    await page.goto(`/m/${initials}/edit`);

    // The edit page's own permission gate sends anonymous viewers back to the
    // machine, not to /login — a bare 404 would be a lie (the machine exists;
    // the viewer just cannot edit it), and middleware never sees this route as
    // protected since /m/ is public.
    await expect(page).toHaveURL(`/m/${initials}`);
    await expect(page.getByRole("heading", { name })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Save details" })
    ).not.toBeVisible();
    expect(
      await page.getByRole("button", { name: "Save details" }).count()
    ).toBe(0);
  });
});
