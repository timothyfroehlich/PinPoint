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
} from "../support/actions.js";
import { seededMachines, seededIssues } from "../support/constants.js";

// Build routes from seeded data so they don't break if seed data changes
const machineInitials = seededMachines.addamsFamily.initials;
const issueNum = seededIssues.TAF[0].num;

const authenticatedRoutes = [
  "/dashboard",
  "/issues",
  "/m",
  `/m/${machineInitials}`,
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
      });
    }
  });

  test.describe("public pages", () => {
    for (const route of publicRoutes) {
      test(`${route}`, async ({ page }) => {
        await page.goto(route);
        await page.waitForLoadState("load");
        await assertNoHorizontalOverflow(page);
      });
    }
  });
});
