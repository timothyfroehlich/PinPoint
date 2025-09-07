/**
 * Anonymous (Unauthenticated) Smoke Tests
 *
 * Covers basic expectations for users with no session:
 *  - Visiting a protected page (/issues) should NOT expose data and should surface
 *    an auth barrier (redirect to sign-in page OR error boundary prompting sign-in)
 *  - Placeholder (skipped) test for future anonymous issue reporting flow
 *
 * NOTE: CUJs specify an anonymous issue creation journey. The current implementation
 * of `/issues/create` requires membership (`requireMemberAccess`). Once a public
 * reporting endpoint (e.g. a machine QR landing page with a lightweight form)
 * exists, replace the skipped test with the real flow.
 */
import { test, expect } from "@playwright/test";

// Helper: detect if we landed on sign-in page
async function isOnSignIn(
  page: import("@playwright/test").Page,
): Promise<boolean> {
  return !!(await page
    .locator('h1:has-text("Sign In to PinPoint")')
    .first()
    .elementHandle());
}

// Helper: detect generic error boundary card (auth or access failure)
async function isShowingErrorBoundary(
  page: import("@playwright/test").Page,
): Promise<boolean> {
  return await page
    .locator(
      '[data-testid="error-boundary-card"], text=/Authentication Error|Issues Unavailable|Access Denied/i',
    )
    .first()
    .isVisible()
    .catch(() => false);
}

test.describe("Anonymous Access", () => {
  test("unauthenticated visit to /issues shows auth barrier (redirect or error boundary)", async ({
    page,
  }) => {
    await page.goto("/issues");

    // Allow a brief window for potential client redirect to /sign-in
    for (let i = 0; i < 6; i++) {
      if (page.url().includes("/sign-in")) break;
      await page.waitForTimeout(250);
    }

    const url = page.url();
    const onSignIn = await isOnSignIn(page);
    const errorBoundaryVisible = await isShowingErrorBoundary(page);

    if (!onSignIn && !errorBoundaryVisible) {
      // Capture diagnostics before failing
      const bodyHtml = await page.content();
      console.log("Anonymous /issues access diagnostics:", {
        url,
        snippet: bodyHtml.slice(0, 1200),
      });
    }

    expect(onSignIn || errorBoundaryVisible).toBeTruthy();
  });

  test.skip("anonymous user can create an issue via public reporting flow (CUJ 1.1)", async () => {
    /*
      CURRENT STATUS:
      The public anonymous issue creation endpoint is not yet implemented.
      When available, implement steps similar to:
        1. Navigate to machine QR URL: await page.goto(`http://apc.localhost:3000/m/<machineSlug>?public=1`)
        2. Click "Report Issue" button
        3. Fill title + (optional) description, optionally upload photo if allowed
        4. Submit and verify redirect to public issue detail view with immutable comment/attach controls disabled
     */
  });
});
