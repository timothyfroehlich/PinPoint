/**
 * E2E Tests: FloatingCommentButton — visibility checks (class-D)
 *
 * Verifies that the mobile-only floating "Comment" button:
 * 1. Is hidden by `md:hidden` CSS at desktop viewport widths, and that the
 *    inline composer in Activity is the only one visible.
 * 2. Is visible for authenticated (signed-in) members on mobile viewports and
 *    opens the comment composer in an "Add a comment" sheet.
 *
 * The unauthenticated (signed-out) check is consolidated into
 * e2e/smoke/issue-detail-permissions.spec.ts.
 */

import { test, expect } from "../support/fixtures.js";
import { loginAs } from "../support/actions.js";
import { seededIssue } from "../support/constants.js";
import { openIssueCommentForm } from "../support/page-helpers.js";

// Use AFM issue 1 — confirmed publicly accessible without auth (public-routes-audit).
// The initials + num are stable seeded values that never change across test runs.
const ISSUE = seededIssue("AFM");
const ISSUE_URL = `/m/AFM/i/${ISSUE.num}`;

// ----------------------------------------------------------------------------
// Scenario 1: Desktop, signed-in (class-D CSS regression)
// ----------------------------------------------------------------------------

test.describe("FloatingCommentButton — desktop signed-in", () => {
  test.use({ viewport: { width: 1024, height: 768 } });

  test("floating button hidden at desktop viewport; inline composer is present", async ({
    page,
  }, testInfo) => {
    await loginAs(page, testInfo);
    await page.goto(ISSUE_URL);
    await page.waitForLoadState("domcontentloaded");

    // The FloatingCommentButton wrapper carries `md:hidden` (display:none at
    // ≥768px). Playwright's toBeVisible() honours CSS visibility, so the button
    // should not be visible even though the element exists in the DOM.
    const floatingButton = page.getByRole("button", {
      name: "Comment",
      exact: true,
    });
    await expect(floatingButton).not.toBeVisible();

    // The inline AddCommentForm in Activity is the only composer at desktop.
    // It is wrapped in data-testid="issue-comment-form".
    await expect(page.getByTestId("issue-comment-form")).toBeVisible();
  });
});

// ----------------------------------------------------------------------------
// Scenario 2: Mobile, signed-in (responsive rendering)
// ----------------------------------------------------------------------------

test.describe("FloatingCommentButton — mobile signed-in", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("floating button is rendered on mobile and opens the comment sheet", async ({
    page,
  }, testInfo) => {
    await loginAs(page, testInfo);
    await page.goto(ISSUE_URL);
    await page.waitForLoadState("domcontentloaded");

    // The inline composer is hidden below md; the floating button replaces it.
    await expect(page.getByTestId("issue-comment-form")).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "Comment", exact: true })
    ).toBeVisible();

    // Tapping it opens the composer in a sheet titled "Add a comment".
    const { form, isSheet } = await openIssueCommentForm(page);
    expect(isSheet).toBe(true);
    await expect(
      form.getByRole("button", { name: "Add Comment" })
    ).toBeVisible();
  });

  // The unit tests cover the draft store against jsdom storage with the
  // editor mocked; this is the one place the real TipTap editor restores a
  // draft from the browser's localStorage after a full reload. Nothing is
  // posted, so the seeded issue is untouched.
  test("a comment draft survives closing the sheet and reloading the page", async ({
    page,
  }, testInfo) => {
    await loginAs(page, testInfo);
    await page.goto(ISSUE_URL);
    const draft = `Draft ${testInfo.project.name} ${Date.now().toString()}`;

    const { form } = await openIssueCommentForm(page);
    const editor = form.getByRole("textbox", { name: "Comment" });
    await expect(editor).toBeFocused();
    await page.keyboard.type(draft);
    await expect(editor).toContainText(draft);

    // Dismiss the sheet; reopening it in the same page view restores the draft.
    await form.getByRole("button", { name: "Close" }).click();
    await expect(form).toBeHidden();
    const reopened = await openIssueCommentForm(page);
    await expect(
      reopened.form.getByRole("textbox", { name: "Comment" })
    ).toContainText(draft);
    await reopened.form.getByRole("button", { name: "Close" }).click();

    // A reload restores it too.
    await page.reload();
    const afterReload = await openIssueCommentForm(page);
    await expect(
      afterReload.form.getByRole("textbox", { name: "Comment" })
    ).toContainText(draft);
  });
});
