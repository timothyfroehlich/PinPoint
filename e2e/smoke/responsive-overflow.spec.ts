/**
 * Responsive overflow regression test.
 *
 * Visits every major route and asserts document.scrollWidth <= document.clientWidth.
 * Runs at both Chromium (1024×768) and Mobile Chrome (375×667) via Playwright's
 * project matrix — catches overflow at both desktop and mobile viewports.
 */

import { test } from "@playwright/test";
import {
  assertNoHorizontalOverflow,
  ensureLoggedIn,
  assertNoA11yViolations,
} from "../support/actions.js";
import {
  seededMachines,
  seededIssue,
  seededMember,
} from "../support/constants.js";
import { getProfileIdByEmail } from "../support/supabase-admin.js";

// Build routes from seeded data so they don't break if seed data changes
const machineInitials = seededMachines.addamsFamily.initials;
const issueNum = seededIssue("TAF").num;

// Filter-heavy query for surfaces that render <IssueFilters>. Overflow bugs
// live in the loaded, many-chips state — not the empty default — so exercise a
// route variant where a wide set of active-filter chips is rendered. This is
// what surfaces content bleeding off the viewport (see PP collections chip
// overflow: chips previously overlaid the search input and spilled off-screen
// on narrow viewports once several filters were active).
// Deliberately heavy: partial selections from each status group (so they render
// as individual chips rather than collapsing to a single group chip) plus every
// severity, priority, and frequency value. This produces ~19 chips — enough that
// a non-wrapping chip row would overrun a 375px viewport, which is exactly the
// regression this guards against.
const filterHeavyQuery =
  `?status=new,in_progress,need_parts,need_help,fixed,wont_fix,wai,no_repro` +
  `&severity=cosmetic,minor,major,unplayable` +
  `&priority=low,medium,high` +
  `&frequency=intermittent,frequent,constant` +
  `&machine=${machineInitials}`;

const authenticatedRoutes = [
  "/dashboard",
  "/issues",
  `/issues${filterHeavyQuery}`,
  "/m",
  `/m/${machineInitials}`,
  `/m/${machineInitials}/settings`,
  `/m/${machineInitials}/maintenance`,
  `/m/${machineInitials}/timeline`,
  `/m/${machineInitials}/i/${issueNum}`,
  "/settings",
];

const publicRoutes = ["/report", "/help", "/about", "/whats-new"];

test.describe("Responsive: no horizontal overflow", () => {
  test.describe("authenticated pages", () => {
    test.beforeEach(async ({ page }, testInfo) => {
      await ensureLoggedIn(page, testInfo);
    });

    for (const route of authenticatedRoutes) {
      test(`${route}`, async ({ page }) => {
        await page.goto(route);
        await page.waitForLoadState("load");
        await assertNoHorizontalOverflow(page);
        await assertNoA11yViolations(page);
      });
    }

    // Collection routes (PP-slrd.1) are keyed by a seed-time-generated user
    // uuid, so the owner id is resolved at runtime instead of hardcoded.
    test.describe("collection pages", () => {
      let collectionBase = "";
      test.beforeAll(async () => {
        const memberId = await getProfileIdByEmail(seededMember.email);
        collectionBase = `/c/owner/${memberId}`;
      });

      for (const suffix of ["", "/issues", "/timeline"]) {
        test(`/c/owner/[member]${suffix}`, async ({ page }) => {
          await page.goto(`${collectionBase}${suffix}`);
          await page.waitForLoadState("load");
          await assertNoHorizontalOverflow(page);
          await assertNoA11yViolations(page);
        });
      }

      // Loaded state: the collection Issues tab with a wide set of active
      // filters renders the full chip row — the surface where the chip overflow
      // was originally reported.
      test(`/c/owner/[member]/issues (filters active)`, async ({ page }) => {
        await page.goto(`${collectionBase}/issues${filterHeavyQuery}`);
        await page.waitForLoadState("load");
        await assertNoHorizontalOverflow(page);
        await assertNoA11yViolations(page);
      });
    });
  });

  test.describe("public pages", () => {
    for (const route of publicRoutes) {
      test(`${route}`, async ({ page }) => {
        await page.goto(route);
        await page.waitForLoadState("load");
        await assertNoHorizontalOverflow(page);
        await assertNoA11yViolations(page);
      });
    }
  });
});
