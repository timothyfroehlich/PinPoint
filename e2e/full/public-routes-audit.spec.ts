/**
 * E2E Tests: Public Routes — Class-A Residuals
 *
 * The bulk of this spec (17 DOWNGRADE-integration blocks) was retired to
 * src/lib/supabase/middleware.test.ts publicRoutes/protectedRoutes arrays
 * (PP-x6nb). Only the two class-A cases that require a real browser remain:
 *
 *   1. /m/new redirects to /login — page-level protection (server component
 *      redirect), NOT middleware. middleware.test.ts explicitly defers this to
 *      E2E (see the "Note" comment in that file's protectedRoutes section).
 *
 *   2. machine detail "Report Issue" button navigates to /report — genuine
 *      multi-step click-through (button click → cross-page navigation) that
 *      cannot be captured by a unit/integration test.
 *
 * One block ("about page links to privacy and terms") was DELETE-redundant:
 * about-page.spec.ts already verifies those links, and middleware.test.ts
 * covers /about, /privacy, /terms as public routes.
 */

import { test, expect } from "@playwright/test";
import { seededMachines } from "../support/constants";

test.describe("Public Routes — Class-A Residuals", () => {
  test("/m/new redirects to login (page-level protection)", async ({
    page,
  }) => {
    await page.goto("/m/new");
    await expect(page).toHaveURL(/\/login/);
  });

  test("machine detail Report Issue button navigates without login wall", async ({
    page,
  }) => {
    const machine = seededMachines.medievalMadness;
    await page.goto(`/m/${machine.initials}`);

    // Click Report Issue button
    await page.getByTestId("machine-report-issue").click();
    await expect(page).toHaveURL(/\/report/);
  });
});
