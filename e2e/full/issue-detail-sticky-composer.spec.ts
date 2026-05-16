/**
 * E2E Tests: StickyCommentComposer — desktop CSS sticky-behavior (class-D)
 *
 * Verifies that the mobile-only fixed-bottom comment composer is genuinely
 * hidden by `md:hidden` CSS at desktop viewport widths, and that the inline
 * composer in IssueTimeline is the only one visible.
 *
 * The three H-class scenarios (mobile signed-in render, mobile signed-out
 * server-side gate, sheet open/close) are covered by the RTL unit suite at
 * src/components/issues/StickyCommentComposer.test.tsx.
 */

import { test, expect } from "@playwright/test";
import { loginAs } from "../support/actions.js";
import { seededIssues } from "../support/constants.js";

// Use AFM issue 1 — confirmed publicly accessible without auth (public-routes-audit).
// The initials + num are stable seeded values that never change across test runs.
const ISSUE = seededIssues.AFM[0];
const ISSUE_URL = `/m/AFM/i/${ISSUE.num}`;

// ----------------------------------------------------------------------------
// Scenario 3: Desktop, signed-in (class-D CSS regression)
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
