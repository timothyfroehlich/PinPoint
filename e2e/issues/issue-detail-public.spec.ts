import { test, expect } from "@playwright/test";
import { setupTestIssue } from "../helpers/auth";

test.describe("Issue Detail - Public User", () => {
  test.beforeEach(async ({ page }) => {
    // Set up test data for each test
    await setupTestIssue(page);
  });

  test("navigates from QR code to issue detail page", async ({ page }) => {
    // This test covers CUJ 1.1: First-Time Discovery & Issue Reporting

    // Navigate to issue detail page (simulating QR code scan)
    await page.goto("/issues/test-issue-1");

    // Expected elements should be visible for public users
    await expect(page.locator('[data-testid="issue-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="issue-status"]')).toBeVisible();
    await expect(
      page.locator('[data-testid="issue-description"]'),
    ).toBeVisible();
    await expect(page.locator('[data-testid="machine-info"]')).toBeVisible();
    await expect(page.locator('[data-testid="public-comments"]')).toBeVisible();

    // Should NOT see admin controls without authentication
    await expect(
      page.locator('[data-testid="edit-issue-button"]'),
    ).not.toBeVisible();
    await expect(
      page.locator('[data-testid="assign-user-button"]'),
    ).not.toBeVisible();
    await expect(
      page.locator('[data-testid="close-issue-button"]'),
    ).not.toBeVisible();
    await expect(
      page.locator('[data-testid="status-dropdown"]'),
    ).not.toBeVisible();
  });

  test("displays issue information correctly for public view", async ({
    page,
  }) => {
    await page.goto("/issues/test-issue-1");

    // Verify basic issue information is displayed
    await expect(page.locator('[data-testid="issue-title"]')).toContainText(
      "Test Issue Title",
    );
    await expect(
      page.locator('[data-testid="issue-description"]'),
    ).toContainText("Test issue description");
    await expect(page.locator('[data-testid="issue-status"]')).toContainText(
      "Open",
    );
    await expect(page.locator('[data-testid="issue-priority"]')).toContainText(
      "Medium",
    );

    // Verify machine information is displayed
    await expect(page.locator('[data-testid="machine-name"]')).toContainText(
      "Test Game",
    );
    await expect(
      page.locator('[data-testid="machine-location"]'),
    ).toContainText("Test Location");
    await expect(page.locator('[data-testid="machine-serial"]')).toContainText(
      "TEST123",
    );

    // Verify timestamps are displayed
    await expect(
      page.locator('[data-testid="issue-created-date"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="issue-last-updated"]'),
    ).toBeVisible();
  });

  test.fixme(
    "shows only public comments for unauthenticated users",
    async ({ page }) => {
      // TODO: Implementation agent will complete this test
      await page.goto("/issues/test-issue-with-mixed-comments");

      // Should see public comments
      await expect(
        page.locator('[data-testid="public-comment-1"]'),
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="public-comment-1"]'),
      ).toContainText("This is a public comment");

      // Should NOT see internal comments
      await expect(
        page.locator('[data-testid="internal-comment-1"]'),
      ).not.toBeVisible();
      await expect(page.locator(".internal-comment")).not.toBeVisible();

      // Should NOT see internal comment indicators
      await expect(
        page.locator('[data-testid="internal-badge"]'),
      ).not.toBeVisible();
    },
  );

  test.fixme("displays image attachments correctly", async ({ page }) => {
    // TODO: Implementation agent will complete this test
    await page.goto("/issues/test-issue-with-attachments");

    // Verify image gallery is displayed
    await expect(page.locator('[data-testid="image-gallery"]')).toBeVisible();
    await expect(
      page.locator('[data-testid="attachment-thumbnail"]'),
    ).toBeVisible();

    // Test image modal functionality
    await page.locator('[data-testid="attachment-thumbnail"]').first().click();
    await expect(page.locator('[data-testid="image-modal"]')).toBeVisible();
    await expect(
      page.locator('[data-testid="modal-close-button"]'),
    ).toBeVisible();

    // Close modal
    await page.locator('[data-testid="modal-close-button"]').click();
    await expect(page.locator('[data-testid="image-modal"]')).not.toBeVisible();
  });

  test.fixme("handles non-existent issues gracefully", async ({ page }) => {
    // TODO: Implementation agent will complete this test
    await page.goto("/issues/non-existent-issue");

    // Should show 404 error page
    await expect(page.locator('[data-testid="issue-not-found"]')).toBeVisible();
    await expect(page.locator('[data-testid="issue-not-found"]')).toContainText(
      "Issue not found",
    );

    // Should provide helpful actions
    await expect(
      page.locator('[data-testid="back-to-dashboard"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="report-new-issue"]'),
    ).toBeVisible();
  });

  test.fixme("shows login prompt for protected actions", async ({ page }) => {
    // TODO: Implementation agent will complete this test
    await page.goto("/issues/test-issue-1");

    // Try to add a comment without authentication
    await page.locator('[data-testid="add-comment-button"]').click();

    // Should show login modal or redirect to login
    await expect(page.locator('[data-testid="login-modal"]')).toBeVisible();
    await expect(page.locator('[data-testid="login-modal"]')).toContainText(
      "Please sign in to comment",
    );

    // Should have login options
    await expect(
      page.locator('[data-testid="email-login-button"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="google-login-button"]'),
    ).toBeVisible();
  });

  test.fixme("supports keyboard navigation", async ({ page }) => {
    // TODO: Implementation agent will complete this test
    await page.goto("/issues/test-issue-1");

    // Test tab navigation through interactive elements
    await page.keyboard.press("Tab");
    await expect(
      page.locator('[data-testid="add-comment-button"]'),
    ).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(
      page.locator('[data-testid="attachment-thumbnail"]').first(),
    ).toBeFocused();

    // Test Enter key on image thumbnail
    await page.keyboard.press("Enter");
    await expect(page.locator('[data-testid="image-modal"]')).toBeVisible();

    // Test Escape key to close modal
    await page.keyboard.press("Escape");
    await expect(page.locator('[data-testid="image-modal"]')).not.toBeVisible();
  });

  test.fixme("displays correctly on mobile devices", async ({ page }) => {
    // TODO: Implementation agent will complete this test
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
    await page.goto("/issues/test-issue-1");

    // Verify mobile layout elements
    await expect(page.locator('[data-testid="mobile-layout"]')).toBeVisible();
    await expect(page.locator('[data-testid="mobile-header"]')).toBeVisible();

    // Verify content is readable and accessible
    await expect(page.locator('[data-testid="issue-title"]')).toBeVisible();
    await expect(
      page.locator('[data-testid="issue-description"]'),
    ).toBeVisible();

    // Verify mobile-specific elements
    await expect(
      page.locator('[data-testid="mobile-actions-bar"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="mobile-share-button"]'),
    ).toBeVisible();
  });

  test.fixme("shows proper loading states", async ({ page }) => {
    // TODO: Implementation agent will complete this test
    // Mock slow network to test loading states
    await page.route("**/api/issues/**", (route) => {
      setTimeout(() => route.continue(), 2000);
    });

    await page.goto("/issues/test-issue-1");

    // Should show skeleton loaders
    await expect(page.locator('[data-testid="issue-skeleton"]')).toBeVisible();
    await expect(
      page.locator('[data-testid="comments-skeleton"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="timeline-skeleton"]'),
    ).toBeVisible();

    // Wait for content to load
    await expect(page.locator('[data-testid="issue-title"]')).toBeVisible({
      timeout: 5000,
    });

    // Skeletons should be hidden
    await expect(
      page.locator('[data-testid="issue-skeleton"]'),
    ).not.toBeVisible();
  });

  test.fixme("handles network errors gracefully", async ({ page }) => {
    // TODO: Implementation agent will complete this test
    // Mock network failure
    await page.route("**/api/issues/**", (route) => {
      route.abort("failed");
    });

    await page.goto("/issues/test-issue-1");

    // Should show error message
    await expect(page.locator('[data-testid="network-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="network-error"]')).toContainText(
      "Failed to load issue",
    );

    // Should provide retry option
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();

    // Test retry functionality
    await page.route("**/api/issues/**", (route) => route.continue());
    await page.locator('[data-testid="retry-button"]').click();

    await expect(page.locator('[data-testid="issue-title"]')).toBeVisible();
  });

  test.fixme(
    "provides proper meta tags for SEO and sharing",
    async ({ page }) => {
      // TODO: Implementation agent will complete this test
      await page.goto("/issues/test-issue-1");

      // Verify page title
      await expect(page).toHaveTitle(/Test Issue Title.*PinPoint/);

      // Verify meta description
      const metaDescription = page.locator('meta[name="description"]');
      await expect(metaDescription).toHaveAttribute(
        "content",
        /Test issue description/,
      );

      // Verify Open Graph tags
      const ogTitle = page.locator('meta[property="og:title"]');
      await expect(ogTitle).toHaveAttribute("content", /Test Issue Title/);

      const ogDescription = page.locator('meta[property="og:description"]');
      await expect(ogDescription).toHaveAttribute(
        "content",
        /Test issue description/,
      );

      // Verify Twitter Card tags
      const twitterCard = page.locator('meta[name="twitter:card"]');
      await expect(twitterCard).toHaveAttribute(
        "content",
        "summary_large_image",
      );
    },
  );
});
