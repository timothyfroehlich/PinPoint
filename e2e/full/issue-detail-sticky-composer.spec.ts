/**
 * E2E Tests: StickyCommentComposer — visibility checks (class-D)
 *
 * Verifies that the mobile-only fixed-bottom comment composer:
 * 1. Is hidden by `md:hidden` CSS at desktop viewport widths, and that the inline
 *    composer in IssueTimeline is the only one visible.
 * 2. Is visible for authenticated (signed-in) members on mobile viewports.
 *
 * The unauthenticated (signed-out) check is consolidated into
 * e2e/smoke/issue-detail-permissions.spec.ts.
 */

import { test, expect } from "../support/fixtures.js";
import { loginAs } from "../support/actions.js";
import { seededIssue } from "../support/constants.js";

// Use AFM issue 1 — confirmed publicly accessible without auth (public-routes-audit).
// The initials + num are stable seeded values that never change across test runs.
const ISSUE = seededIssue("AFM");
const ISSUE_URL = `/m/AFM/i/${ISSUE.num}`;

// ----------------------------------------------------------------------------
// Scenario 1: Desktop, signed-in (class-D CSS regression)
// ----------------------------------------------------------------------------

test.describe("StickyCommentComposer — desktop signed-in", () => {
  test.use({ viewport: { width: 1024, height: 768 } });

  test("sticky bar hidden at desktop viewport; inline composer is present", async ({
    page,
  }, testInfo) => {
    await loginAs(page, testInfo);
    await page.goto(ISSUE_URL);
    await page.waitForLoadState("domcontentloaded");

    // The StickyCommentComposer wrapper carries `md:hidden` (display:none at ≥768px).
    // Playwright's toBeVisible() honours CSS visibility, so the button should
    // not be visible even though the element may exist in the DOM.
    const stickyTrigger = page.getByRole("button", { name: "Add a comment" });
    await expect(stickyTrigger).not.toBeVisible();

    // The inline AddCommentForm in IssueTimeline is the only composer at desktop.
    // It is wrapped in data-testid="issue-comment-form".
    await expect(page.getByTestId("issue-comment-form")).toBeVisible();
  });
});

// ----------------------------------------------------------------------------
// Scenario 3: Mobile, signed-in (class-E authorization verification)
// ----------------------------------------------------------------------------

test.describe("StickyCommentComposer — mobile signed-in", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("sticky bar is rendered on mobile for signed-in member", async ({
    page,
  }, testInfo) => {
    await loginAs(page, testInfo);
    await page.goto(ISSUE_URL);
    await page.waitForLoadState("domcontentloaded");

    // Authenticated mobile users should see the StickyCommentComposer bar.
    const stickyTrigger = page.getByRole("button", { name: "Add a comment" });
    await expect(stickyTrigger).toBeVisible();
  });
});
