/**
 * E2E Tests: Public Routes — Class-A Residuals
 *
 * The bulk of this spec (17 DOWNGRADE-integration blocks) was retired to
 * src/lib/supabase/middleware.test.ts publicRoutes/protectedRoutes arrays
 * (PP-x6nb). Only the class-A case that requires a real browser remains:
 *
 *   1. /m/new redirects to /login — page-level protection (server component
 *      redirect), NOT middleware. middleware.test.ts explicitly defers this to
 *      E2E (see the "Note" comment in that file's protectedRoutes section).
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

import { test, expect } from "@playwright/test";

test.describe("Public Routes — Class-A Residuals", () => {
  test("/m/new redirects to login (page-level protection)", async ({
    page,
  }) => {
    await page.goto("/m/new");
    await expect(page).toHaveURL(/\/login/);
  });
});
