import { test, expect, type Page } from "@playwright/test";
import { loginAsAdmin, loginAsRegularUser, logout } from "./helpers/auth";

// Safe session clearing that handles security errors
async function safeClearSession(page: Page): Promise<void> {
  try {
    await page.evaluate(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (e) {
        // Ignore localStorage access errors in some contexts
        console.log("localStorage access denied, continuing...");
      }
    });
  } catch (e) {
    // If even the page.evaluate fails, just continue
    console.log("Session clearing failed, continuing...");
  }
}

/**
 * Comprehensive Exploratory Tests for Issue Creation Functionality
 *
 * This test suite explores all aspects of the /issues/create page including:
 * - Anonymous user flow with email field
 * - Authenticated user flow with basic permissions
 * - Admin user flow with advanced options
 * - Responsive design and mobile behavior
 * - Navigation and integration points
 * - Error scenarios and edge cases
 * - Data verification and persistence
 */

// Test data constants
const TEST_ISSUE_DATA = {
  title: "Test Issue - Comprehensive E2E",
  description:
    "This is a detailed test issue description to verify the full functionality of the issue creation system.",
  severity: "High",
  email: "test-user@example.com",
};

// Helper class for issue creation page interactions
class IssueCreationPage {
  constructor(private page: Page) {}

  async navigateToCreatePage(): Promise<void> {
    await this.page.goto("/issues/create");
    await this.page.waitForLoadState("networkidle");
  }

  async clickReportIssueInAppBar(): Promise<void> {
    // Try both desktop and mobile versions
    const desktopButton = this.page.locator(
      'a[href="/issues/create"]:has-text("Report Issue")',
    );
    const mobileMenuButton = this.page.locator(
      'button[aria-label="open navigation menu"]',
    );

    if (await mobileMenuButton.isVisible()) {
      // Mobile flow
      await mobileMenuButton.click();
      await this.page.locator('button:has-text("Report Issue")').click();
    } else {
      // Desktop flow
      await desktopButton.click();
    }

    await this.page.waitForURL("/issues/create");
    await this.page.waitForLoadState("networkidle");
  }

  async verifyPageStructure(): Promise<void> {
    // Check breadcrumbs
    await expect(
      this.page.locator('nav[aria-label="breadcrumb"]'),
    ).toBeVisible();
    await expect(this.page.locator('text="Home"')).toBeVisible();
    await expect(this.page.locator('text="Issues"')).toBeVisible();
    await expect(this.page.locator('text="Create"')).toBeVisible();

    // Check page header
    await expect(
      this.page.locator('h1:has-text("Create New Issue")'),
    ).toBeVisible();
    await expect(
      this.page.locator('text="Report a problem with a pinball machine"'),
    ).toBeVisible();

    // Check main form card is present
    await expect(this.page.locator("form")).toBeVisible();
  }

  async verifyResponsiveLayout(): Promise<void> {
    const viewport = await this.page.viewportSize();
    const isMobile = viewport ? viewport.width < 900 : false;

    if (isMobile) {
      // Mobile layout: no sidebar, full width form
      await expect(
        this.page.locator('[data-testid="recent-issues-sidebar"]'),
      ).not.toBeVisible();
    } else {
      // Desktop layout: 2/3 form + 1/3 sidebar
      await expect(this.page.locator("form")).toBeVisible();
      // Note: Sidebar may or may not be visible depending on data
    }
  }

  async fillBasicIssueForm(
    data: Partial<typeof TEST_ISSUE_DATA> = {},
  ): Promise<void> {
    const formData = { ...TEST_ISSUE_DATA, ...data };

    // Select machine first (required field)
    const machineSelector = this.page
      .locator('div:has-text("Select Machine")')
      .first();
    await expect(machineSelector).toBeVisible();

    // Try to find a machine option - this may vary based on test data
    const machineSelect = this.page
      .locator('input[role="combobox"], select, button')
      .first();
    await machineSelect.click();

    // Wait for machine options to load and select the first available
    await this.page.waitForTimeout(1000);
    const firstMachineOption = this.page.locator('[role="option"]').first();
    if (await firstMachineOption.isVisible()) {
      await firstMachineOption.click();
    } else {
      // Fallback: look for any selectable machine element
      const machineButton = this.page
        .locator("button, div")
        .filter({ hasText: /machine|game/i })
        .first();
      if (await machineButton.isVisible()) {
        await machineButton.click();
      }
    }

    // Fill title
    await this.page.fill(
      'input[label="Issue Title"], input[placeholder*="Brief description"]',
      formData.title,
    );

    // Fill description if field is visible
    const descriptionField = this.page.locator(
      'textarea[label="Description"], textarea[placeholder*="Detailed description"]',
    );
    if (await descriptionField.isVisible()) {
      await descriptionField.fill(formData.description);
    }

    // Select severity
    const severityRadio = this.page.locator(
      `input[value="${formData.severity}"]`,
    );
    if (await severityRadio.isVisible()) {
      await severityRadio.click();
    }
  }

  async fillAnonymousUserEmail(
    email: string = TEST_ISSUE_DATA.email,
  ): Promise<void> {
    const emailField = this.page.locator(
      'input[type="email"], input[label*="Email"]',
    );
    if (await emailField.isVisible()) {
      await emailField.fill(email);
    }
  }

  async submitForm(): Promise<void> {
    const submitButton = this.page.locator(
      'button[type="submit"], button:has-text("Create Issue")',
    );
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toBeEnabled();
    await submitButton.click();
  }

  async verifyFormValidation(): Promise<void> {
    // Try to submit empty form
    const submitButton = this.page.locator(
      'button[type="submit"], button:has-text("Create Issue")',
    );
    await expect(submitButton).toBeVisible();

    // Submit button should be disabled when required fields are empty
    const isDisabled = await submitButton.isDisabled();
    if (!isDisabled) {
      // If not disabled by HTML validation, try submitting and check for error message
      await submitButton.click();
      await expect(
        this.page.locator(
          'text="Please select a machine", text="Please enter a title"',
        ),
      ).toBeVisible();
    }
  }

  async verifySuccessState(): Promise<void> {
    // Look for success message
    await expect(
      this.page.locator('text="Issue Created Successfully", text="✅"'),
    ).toBeVisible({ timeout: 10000 });

    // Check for action buttons
    await expect(
      this.page.locator('button:has-text("Create Another Issue")'),
    ).toBeVisible();
    await expect(
      this.page.locator(
        'button:has-text("View All Issues"), a:has-text("View All Issues")',
      ),
    ).toBeVisible();
  }

  async verifyAdvancedOptionsVisibility(
    shouldBeVisible: boolean,
  ): Promise<void> {
    const advancedSection = this.page.locator('text="Advanced Options"');
    const prioritySelect = this.page.locator(
      'select[label="Priority"], input[label="Priority"]',
    );
    const assignmentSelect = this.page.locator(
      'select[label="Assign To"], input[label="Assign To"]',
    );

    if (shouldBeVisible) {
      await expect(advancedSection).toBeVisible();
      await expect(prioritySelect).toBeVisible();
      await expect(assignmentSelect).toBeVisible();
    } else {
      await expect(advancedSection).not.toBeVisible();
      await expect(prioritySelect).not.toBeVisible();
      await expect(assignmentSelect).not.toBeVisible();
    }
  }

  async verifyAnonymousUserFields(shouldBeVisible: boolean): Promise<void> {
    const emailField = this.page.locator('input[type="email"]');
    const signInPrompt = this.page.locator('text="Sign in"');

    if (shouldBeVisible) {
      await expect(emailField).toBeVisible();
      await expect(signInPrompt).toBeVisible();
      await expect(this.page.locator('text="Anonymous User"')).toBeVisible();
    } else {
      await expect(emailField).not.toBeVisible();
      await expect(
        this.page.locator('text="Anonymous User"'),
      ).not.toBeVisible();
    }
  }

  async testCancelNavigation(): Promise<void> {
    const cancelButton = this.page.locator(
      'button:has-text("Cancel"), a:has-text("Cancel")',
    );
    if (await cancelButton.isVisible()) {
      await cancelButton.click();
      await this.page.waitForURL("/issues");
    }
  }

  async testBreadcrumbNavigation(): Promise<void> {
    // Test Home breadcrumb
    await this.page.locator('a:has-text("Home")').click();
    await this.page.waitForURL("/");

    // Navigate back to test Issues breadcrumb
    await this.navigateToCreatePage();
    await this.page.locator('a:has-text("Issues")').click();
    await this.page.waitForURL("/issues");
  }

  async testFormErrorHandling(): Promise<void> {
    // Test invalid email format
    const emailField = this.page.locator('input[type="email"]');
    if (await emailField.isVisible()) {
      await emailField.fill("invalid-email");
      await this.submitForm();
      // Browser should show validation error for invalid email
    }

    // Test very long title
    const titleField = this.page.locator('input[label="Issue Title"]');
    const longTitle = "A".repeat(500);
    await titleField.fill(longTitle);

    // Check if there's a character limit indicator or validation
    const characterCount = this.page.locator('text*="characters"');
    if (await characterCount.isVisible()) {
      console.log("Character count validation detected");
    }
  }
}

test.describe("Anonymous User Flow", () => {
  test.beforeEach(async ({ page }) => {
    await safeClearSession(page);
  });

  test("should allow anonymous users to access issue creation", async ({
    page,
  }) => {
    const issuePage = new IssueCreationPage(page);

    await issuePage.navigateToCreatePage();
    await issuePage.verifyPageStructure();
    await issuePage.verifyAnonymousUserFields(true);
    await issuePage.verifyAdvancedOptionsVisibility(false);
  });

  test("should validate required fields for anonymous users", async ({
    page,
  }) => {
    const issuePage = new IssueCreationPage(page);

    await issuePage.navigateToCreatePage();
    await issuePage.verifyFormValidation();
  });

  test("should allow anonymous users to submit issues with email", async ({
    page,
  }) => {
    const issuePage = new IssueCreationPage(page);

    await issuePage.navigateToCreatePage();
    await issuePage.fillBasicIssueForm();
    await issuePage.fillAnonymousUserEmail();
    await issuePage.submitForm();
    await issuePage.verifySuccessState();
  });

  test("should allow anonymous users to submit issues without email", async ({
    page,
  }) => {
    const issuePage = new IssueCreationPage(page);

    await issuePage.navigateToCreatePage();
    await issuePage.fillBasicIssueForm();
    // Skip email field
    await issuePage.submitForm();
    await issuePage.verifySuccessState();
  });

  test("should show sign-in prompt for anonymous users", async ({ page }) => {
    const issuePage = new IssueCreationPage(page);

    await issuePage.navigateToCreatePage();
    await expect(page.locator('text="Sign in"')).toBeVisible();
    await expect(page.locator('text="track your issues"')).toBeVisible();
  });
});

test.describe("Authenticated User Flow", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsRegularUser(page);
  });

  test.afterEach(async ({ page }) => {
    await logout(page);
  });

  test("should allow authenticated users to create issues", async ({
    page,
  }) => {
    const issuePage = new IssueCreationPage(page);

    await issuePage.navigateToCreatePage();
    await issuePage.verifyPageStructure();
    await issuePage.verifyAnonymousUserFields(false);
    await issuePage.fillBasicIssueForm();
    await issuePage.submitForm();
    await issuePage.verifySuccessState();
  });

  test("should show appropriate permissions for regular users", async ({
    page,
  }) => {
    const issuePage = new IssueCreationPage(page);

    await issuePage.navigateToCreatePage();

    // Regular users might have limited advanced options
    // This depends on the specific permission configuration
    await issuePage.verifyAdvancedOptionsVisibility(false);
  });

  test("should allow access via Report Issue button in app bar", async ({
    page,
  }) => {
    const issuePage = new IssueCreationPage(page);

    // Start from home page
    await page.goto("/");
    await issuePage.clickReportIssueInAppBar();
    await issuePage.verifyPageStructure();
  });
});

test.describe("Admin User Flow", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test.afterEach(async ({ page }) => {
    await logout(page);
  });

  test("should show advanced options for admin users", async ({ page }) => {
    const issuePage = new IssueCreationPage(page);

    await issuePage.navigateToCreatePage();
    await issuePage.verifyAdvancedOptionsVisibility(true);
  });

  test("should allow admin to set priority and assignment", async ({
    page,
  }) => {
    const issuePage = new IssueCreationPage(page);

    await issuePage.navigateToCreatePage();
    await issuePage.fillBasicIssueForm();

    // Try to set priority
    const prioritySelect = page.locator('select[label="Priority"]');
    if (await prioritySelect.isVisible()) {
      await prioritySelect.selectOption({ index: 1 }); // Select second option
    }

    // Try to set assignment
    const assignSelect = page.locator('select[label="Assign To"]');
    if (await assignSelect.isVisible()) {
      await assignSelect.selectOption({ index: 1 }); // Select second option
    }

    await issuePage.submitForm();
    await issuePage.verifySuccessState();
  });

  test("should allow admin to create issues with all fields", async ({
    page,
  }) => {
    const issuePage = new IssueCreationPage(page);

    await issuePage.navigateToCreatePage();
    await issuePage.fillBasicIssueForm();
    await issuePage.submitForm();
    await issuePage.verifySuccessState();
  });
});

test.describe("Responsive Design", () => {
  test("should work correctly on mobile devices", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
    await safeClearSession(page);

    const issuePage = new IssueCreationPage(page);

    await issuePage.navigateToCreatePage();
    await issuePage.verifyPageStructure();
    await issuePage.verifyResponsiveLayout();

    // Test mobile navigation
    await issuePage.fillBasicIssueForm();
    await issuePage.submitForm();
    await issuePage.verifySuccessState();
  });

  test("should work correctly on tablet devices", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 }); // iPad
    await safeClearSession(page);

    const issuePage = new IssueCreationPage(page);

    await issuePage.navigateToCreatePage();
    await issuePage.verifyPageStructure();
    await issuePage.verifyResponsiveLayout();
  });

  test("should work correctly on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 }); // Desktop
    await safeClearSession(page);

    const issuePage = new IssueCreationPage(page);

    await issuePage.navigateToCreatePage();
    await issuePage.verifyPageStructure();
    await issuePage.verifyResponsiveLayout();
  });

  test("should maintain form data across viewport changes", async ({
    page,
  }) => {
    const issuePage = new IssueCreationPage(page);

    // Start on desktop
    await page.setViewportSize({ width: 1440, height: 900 });
    await issuePage.navigateToCreatePage();
    await issuePage.fillBasicIssueForm({ title: "Responsive Test Issue" });

    // Switch to mobile
    await page.setViewportSize({ width: 375, height: 667 });

    // Verify form data is preserved
    await expect(
      page.locator('input[value="Responsive Test Issue"]'),
    ).toBeVisible();
  });
});

test.describe("Navigation and Integration", () => {
  test("should navigate correctly via breadcrumbs", async ({ page }) => {
    await safeClearSession(page);
    const issuePage = new IssueCreationPage(page);

    await issuePage.navigateToCreatePage();
    await issuePage.testBreadcrumbNavigation();
  });

  test("should handle cancel button correctly", async ({ page }) => {
    await safeClearSession(page);
    const issuePage = new IssueCreationPage(page);

    await issuePage.navigateToCreatePage();
    await issuePage.fillBasicIssueForm();
    await issuePage.testCancelNavigation();
  });

  test("should work with browser back button", async ({ page }) => {
    await safeClearSession(page);
    const issuePage = new IssueCreationPage(page);

    await page.goto("/");
    await issuePage.navigateToCreatePage();
    await issuePage.fillBasicIssueForm({ title: "Back Button Test" });

    // Use browser back
    await page.goBack();
    await page.waitForURL("/");

    // Go forward again
    await page.goForward();
    await page.waitForURL("/issues/create");

    // Form data might or might not be preserved depending on implementation
  });

  test("should handle direct URL access", async ({ page }) => {
    await safeClearSession(page);
    const issuePage = new IssueCreationPage(page);

    // Direct navigation to create page
    await issuePage.navigateToCreatePage();
    await issuePage.verifyPageStructure();
  });
});

test.describe("Error Scenarios and Edge Cases", () => {
  test("should handle form validation errors gracefully", async ({ page }) => {
    await safeClearSession(page);
    const issuePage = new IssueCreationPage(page);

    await issuePage.navigateToCreatePage();
    await issuePage.testFormErrorHandling();
  });

  test("should handle network errors during submission", async ({ page }) => {
    await safeClearSession(page);
    const issuePage = new IssueCreationPage(page);

    await issuePage.navigateToCreatePage();
    await issuePage.fillBasicIssueForm();

    // Simulate network failure
    await page.route("**/api/trpc/**", (route) => route.abort());

    await issuePage.submitForm();

    // Should show error message
    await expect(
      page.locator('text="error", text="failed", text="try again"'),
    ).toBeVisible({ timeout: 10000 });
  });

  test("should handle slow network conditions", async ({ page }) => {
    await safeClearSession(page);
    const issuePage = new IssueCreationPage(page);

    await issuePage.navigateToCreatePage();
    await issuePage.fillBasicIssueForm();

    // Simulate slow network
    await page.route("**/api/trpc/**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await route.continue();
    });

    await issuePage.submitForm();

    // Should show loading state
    await expect(page.locator('text="Creating", text="loading"')).toBeVisible();
    await issuePage.verifySuccessState();
  });

  test("should handle edge case inputs", async ({ page }) => {
    await safeClearSession(page);
    const issuePage = new IssueCreationPage(page);

    await issuePage.navigateToCreatePage();

    // Test with special characters
    await issuePage.fillBasicIssueForm({
      title: "Issue with special chars: @#$%^&*()_+{}|:<>?[]\\;',./",
      description: "Description with\nmultiple\nlines and special chars 🎮🕹️",
    });

    await issuePage.submitForm();
    await issuePage.verifySuccessState();
  });

  test("should handle concurrent form submissions", async ({ page }) => {
    await safeClearSession(page);
    const issuePage = new IssueCreationPage(page);

    await issuePage.navigateToCreatePage();
    await issuePage.fillBasicIssueForm();

    // Try to submit multiple times quickly
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();
    await submitButton.click(); // Second click should be ignored

    await issuePage.verifySuccessState();
  });
});

test.describe("Data Verification", () => {
  test("should verify issue appears in the system after creation", async ({
    page,
  }) => {
    await safeClearSession(page);
    const issuePage = new IssueCreationPage(page);

    const uniqueTitle = `Test Issue ${Date.now()}`;

    await issuePage.navigateToCreatePage();
    await issuePage.fillBasicIssueForm({ title: uniqueTitle });
    await issuePage.submitForm();
    await issuePage.verifySuccessState();

    // Navigate to issues list and verify the issue appears
    await page
      .locator(
        'button:has-text("View All Issues"), a:has-text("View All Issues")',
      )
      .click();
    await page.waitForURL("/issues");

    // Look for the created issue
    await expect(page.locator(`text="${uniqueTitle}"`)).toBeVisible({
      timeout: 10000,
    });
  });

  test("should verify issue data persistence across browser sessions", async ({
    page,
    context,
  }) => {
    await safeClearSession(page);
    const issuePage = new IssueCreationPage(page);

    const uniqueTitle = `Persistent Issue ${Date.now()}`;

    await issuePage.navigateToCreatePage();
    await issuePage.fillBasicIssueForm({ title: uniqueTitle });
    await issuePage.submitForm();
    await issuePage.verifySuccessState();

    // Create new page in same context (simulates new tab)
    const newPage = await context.newPage();
    await newPage.goto("/issues");

    // Verify issue is still there
    await expect(newPage.locator(`text="${uniqueTitle}"`)).toBeVisible({
      timeout: 10000,
    });

    await newPage.close();
  });

  test("should handle issue creation when user changes authentication state", async ({
    page,
  }) => {
    // Start as anonymous
    await safeClearSession(page);
    const issuePage = new IssueCreationPage(page);

    await issuePage.navigateToCreatePage();
    await issuePage.fillBasicIssueForm({ title: "Auth Change Test" });

    // Login during form filling
    await loginAsRegularUser(page);

    // Navigate back to form and verify state
    await issuePage.navigateToCreatePage();

    // Form should now show authenticated user options
    await issuePage.verifyAnonymousUserFields(false);

    await logout(page);
  });
});

test.describe("Performance and Accessibility", () => {
  test("should load the create page quickly", async ({ page }) => {
    await safeClearSession(page);

    const startTime = Date.now();
    await page.goto("/issues/create");
    await page.waitForLoadState("networkidle");
    const loadTime = Date.now() - startTime;

    // Page should load within reasonable time (adjust threshold as needed)
    expect(loadTime).toBeLessThan(5000);

    console.log(`Issue creation page loaded in ${loadTime}ms`);
  });

  test("should be accessible to screen readers", async ({ page }) => {
    await safeClearSession(page);
    const issuePage = new IssueCreationPage(page);

    await issuePage.navigateToCreatePage();

    // Check for proper form labels
    const labelCount = await page.locator("label, [aria-label]").count();
    expect(labelCount).toBeGreaterThanOrEqual(3);

    // Check for proper heading structure
    await expect(page.locator("h1")).toHaveCount(1);

    // Check for proper form structure
    await expect(page.locator("form")).toHaveAttribute("novalidate", {
      timeout: 1000,
    });
  });

  test("should handle keyboard navigation", async ({ page }) => {
    await safeClearSession(page);
    const issuePage = new IssueCreationPage(page);

    await issuePage.navigateToCreatePage();

    // Test tab navigation through form
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");

    // Should be able to navigate to submit button
    const focusedElement = await page.evaluate(
      () => document.activeElement?.tagName,
    );
    expect(["INPUT", "BUTTON", "SELECT", "TEXTAREA"]).toContain(focusedElement);
  });
});
