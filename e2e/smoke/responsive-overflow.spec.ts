/**
 * Responsive overflow regression test.
 *
 * Visits every major route and asserts document.scrollWidth <= document.clientWidth.
 * Runs at both Chromium (1024×768) and Mobile Chrome (375×667) via Playwright's
 * project matrix — catches overflow at both desktop and mobile viewports.
 */

import { expect, test } from "../support/fixtures.js";
import type { Page } from "@playwright/test";
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

// TAF is admin-owned (with an invited-owner override on top) — this file's
// `ensureLoggedIn` calls default to the `member` role, which lacks
// `machines.edit` on it. Routing the /edit entry at TAF would only ever
// render the page's own permission-denied redirect back to /m/TAF, not the
// edit page's content. Eight Ball Deluxe is member-owned (see the ownerMap
// in supabase/seed-users.mjs), so this entry actually renders what it
// claims to overflow-check.
const ownedMachineInitials = seededMachines.eightBallDeluxe.initials;

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
  `/m/${ownedMachineInitials}/edit`,
  `/m/${machineInitials}/i/${issueNum}`,
  "/settings",
];

const publicRoutes = ["/report", "/help", "/about", "/whats-new"];

async function assertNoBodyHorizontalOverflow(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    bodyScrollWidth: document.body.scrollWidth,
    documentScrollWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));

  expect(
    Math.max(dimensions.bodyScrollWidth, dimensions.documentScrollWidth)
  ).toBeLessThanOrEqual(dimensions.viewportWidth);
}

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

    test("machine tabs remain mouse-reachable at desktop width", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1024, height: 768 });
      await page.goto(`/m/${ownedMachineInitials}`);

      await expect(page.getByTestId("machine-tab-more")).toHaveCount(0);
      for (const tab of [
        "info",
        "settings",
        "maintenance",
        "timeline",
        "edit",
      ]) {
        await expect(page.getByTestId(`machine-tab-${tab}`)).toBeVisible();
      }
    });

    for (const width of [390, 393]) {
      test(`machine overflow menu reaches Manage with a mouse at ${String(width)}px`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 844 });
        await page.goto(`/m/${ownedMachineInitials}`);

        await page.getByTestId("machine-tab-more").click();
        const manageLink = page.getByTestId("machine-tab-overflow-edit");
        await expect(manageLink).toHaveAttribute(
          "href",
          `/m/${ownedMachineInitials}/edit`
        );
        await manageLink.click();

        await expect(page).toHaveURL(
          new RegExp(`/m/${ownedMachineInitials}/edit$`)
        );
        await expect(page.getByTestId("machine-tab-edit")).toHaveAttribute(
          "aria-current",
          "page"
        );
        await assertNoBodyHorizontalOverflow(page);
      });
    }

    test("machine tabs remain reachable at 320px with 200% root text", async ({
      page,
    }) => {
      await page.setViewportSize({ width: 320, height: 640 });
      await page.goto(`/m/${ownedMachineInitials}/edit`);
      await page.addStyleTag({
        content: "html { font-size: 200% !important; }",
      });
      await expect
        .poll(() =>
          page.evaluate(() =>
            Number.parseFloat(
              getComputedStyle(document.documentElement).fontSize
            )
          )
        )
        .toBeGreaterThan(16);

      const trigger = page.getByTestId("machine-tab-more");
      await expect(trigger).toBeVisible();
      await expect(page.getByTestId("machine-tab-edit")).toHaveAttribute(
        "aria-current",
        "page"
      );
      await assertNoBodyHorizontalOverflow(page);
    });

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

      test("collection tabs remain directly reachable at desktop width", async ({
        page,
      }) => {
        await page.setViewportSize({ width: 1024, height: 768 });
        await page.goto(collectionBase);

        await expect(page.getByTestId("collection-tab-more")).toHaveCount(0);
        for (const tab of ["overview", "issues", "timeline"]) {
          await expect(page.getByTestId(`collection-tab-${tab}`)).toBeVisible();
        }
      });

      for (const width of [390, 393]) {
        test(`collection tabs reach Timeline with a mouse at ${String(width)}px`, async ({
          page,
        }) => {
          await page.setViewportSize({ width, height: 844 });
          await page.goto(collectionBase);

          const overflowTrigger = page.getByTestId("collection-tab-more");
          let timeline = page.getByTestId("collection-tab-timeline");
          if ((await overflowTrigger.count()) > 0) {
            await overflowTrigger.click();
            timeline = page.getByTestId("collection-tab-overflow-timeline");
          }
          await timeline.click();

          await expect(page).toHaveURL(
            new RegExp(`${collectionBase}/timeline$`)
          );
          await expect(
            page.getByTestId("collection-tab-timeline")
          ).toHaveAttribute("aria-current", "page");
          await assertNoBodyHorizontalOverflow(page);
        });
      }

      test("collection tabs remain reachable at 320px with 200% root text", async ({
        page,
      }) => {
        await page.setViewportSize({ width: 320, height: 640 });
        await page.goto(collectionBase);
        await page.addStyleTag({
          content: "html { font-size: 200% !important; }",
        });
        await expect
          .poll(() =>
            page.evaluate(() =>
              Number.parseFloat(
                getComputedStyle(document.documentElement).fontSize
              )
            )
          )
          .toBeGreaterThan(16);

        const trigger = page.getByTestId("collection-tab-more");
        await expect(trigger).toBeVisible();
        await expect(trigger).toHaveAttribute(
          "aria-label",
          /current section: Overview/
        );
        await trigger.click();
        const currentLink = page.getByTestId(
          "collection-tab-overflow-overview"
        );
        await expect(currentLink).toHaveAttribute("aria-current", "page");
        await expect(currentLink).toHaveAttribute("href", collectionBase);
        await assertNoBodyHorizontalOverflow(page);
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
