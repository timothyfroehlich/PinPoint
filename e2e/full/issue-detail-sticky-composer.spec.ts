/**
 * E2E Tests: StickyCommentComposer — visibility rules
 *
 * Covers three scenarios for the mobile-only fixed-bottom comment composer:
 *
 * 1. Mobile + signed-in:  sticky bar visible; tapping it opens a Sheet with
 *    the comment form.
 * 2. Mobile + signed-out: sticky bar absent (server-side gated); the inline
 *    "Log in to comment" placeholder in IssueTimeline is the canonical CTA.
 * 3. Desktop + signed-in: sticky bar hidden via `md:hidden`; the inline
 *    composer at the end of the timeline is the only one.
 */

import { test, expect } from "@playwright/test";
import { loginAs } from "../support/actions.js";
import { seededIssues } from "../support/constants.js";

// Use AFM issue 1 — confirmed publicly accessible without auth (public-routes-audit).
// The initials + num are stable seeded values that never change across test runs.
const ISSUE = seededIssues.AFM[0];
const ISSUE_URL = `/m/AFM/i/${ISSUE.num}`;

// ----------------------------------------------------------------------------
// Scenario 1: Mobile, signed-in
// ----------------------------------------------------------------------------

test.describe("StickyCommentComposer — mobile signed-in", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("renders the sticky bar and opens the comment Sheet on tap", async ({
    page,
  }, testInfo) => {
    await loginAs(page, testInfo);
    await page.goto(ISSUE_URL);
    await page.waitForLoadState("domcontentloaded");

    // The sticky bar button must be visible at a 375px viewport (below md: breakpoint).
    const trigger = page.getByRole("button", { name: "Add a comment" });
    await expect(trigger).toBeVisible();

    // Tapping the trigger opens the Sheet (Radix renders the dialog in a portal).
    await trigger.click();

    const sheet = page.getByRole("dialog");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText("Add a comment")).toBeVisible();
  });
});

// ----------------------------------------------------------------------------
// Scenario 2: Mobile, signed-out
// ----------------------------------------------------------------------------

test.describe("StickyCommentComposer — mobile signed-out", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("sticky bar absent; inline 'Log in to comment' placeholder visible", async ({
    page,
  }) => {
    // Navigate without logging in.
    await page.goto(ISSUE_URL);
    await page.waitForLoadState("domcontentloaded");

    // The StickyCommentComposer is NOT rendered server-side when unauthenticated
    // (page.tsx gates on `accessLevel !== "unauthenticated"`), so the button
    // should not be present at all.
    const trigger = page.getByRole("button", { name: "Add a comment" });
    await expect(trigger).not.toBeVisible();

    // The inline "Log in to comment" placeholder in IssueTimeline is the
    // canonical CTA for unauthenticated users.
    await expect(page.getByTestId("login-to-comment")).toBeVisible();
  });
});

// ----------------------------------------------------------------------------
// Scenario 3: Desktop, signed-in
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
