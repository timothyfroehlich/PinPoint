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
  seededIssues,
  seededMember,
} from "../support/constants.js";
import { getUserIdByEmail } from "../support/supabase-admin.js";

// Build routes from seeded data so they don't break if seed data changes
const machineInitials = seededMachines.addamsFamily.initials;
const issueNum = seededIssues.TAF[0].num;

const authenticatedRoutes = [
  "/dashboard",
  "/issues",
  "/m",
  `/m/${machineInitials}`,
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
        const memberId = await getUserIdByEmail(seededMember.email);
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
