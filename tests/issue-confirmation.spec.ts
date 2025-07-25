import { test, expect, type Page } from "@playwright/test";

/**
 * End-to-End Tests for Issue Confirmation Workflow
 *
 * These tests verify the issue confirmation system from the UI perspective,
 * including basic vs full form creation and permission-based confirmation controls.
 * They will fail initially as the implementation doesn't exist yet (TDD red phase).
 */

// Test data and helpers
const TEST_ISSUE = {
  title: "Test Issue for Confirmation",
  description: "This is a test issue to verify confirmation workflow",
  machine: "Medieval Madness #1",
  severity: "Medium",
  consistency: "Always",
} as const;

const TEST_USERS = {
  admin: { email: "admin@example.com", role: "Admin" },
  technician: { email: "tech@example.com", role: "Technician" },
  user: { email: "user@example.com", role: "User" },
} as const;

class IssueConfirmationPage {
  constructor(private page: Page) {}

  async loginAs(userType: keyof typeof TEST_USERS) {
    const user = TEST_USERS[userType];

    await this.page.goto("/");
    await this.page.fill('input[type="email"]', user.email);
    await this.page.click('button:has-text("Continue with Email")');
    await this.page.waitForURL("/dashboard");
  }

  async createIssueWithBasicForm() {
    // Navigate to issue creation
    await this.page.click('button:has-text("Report Issue")');

    // Verify basic form is shown
    await expect(this.page.locator(".issue-form.basic")).toBeVisible();

    // Fill required fields only
    await this.page.fill('input[name="title"]', TEST_ISSUE.title);
    await this.page.selectOption('select[name="machine"]', TEST_ISSUE.machine);

    // Submit basic form
    await this.page.click('button:has-text("Submit Issue")');

    // Wait for success
    await this.page.waitForSelector(".success-message, .toast-success");
  }

  async createIssueWithFullForm() {
    // Navigate to issue creation
    await this.page.click('button:has-text("Report Issue")');

    // Switch to full form
    await this.page.click('button:has-text("Use Full Form")');

    // Verify full form is shown
    await expect(this.page.locator(".issue-form.full")).toBeVisible();

    // Fill all fields
    await this.page.fill('input[name="title"]', TEST_ISSUE.title);
    await this.page.fill(
      'textarea[name="description"]',
      TEST_ISSUE.description,
    );
    await this.page.selectOption('select[name="machine"]', TEST_ISSUE.machine);
    await this.page.selectOption(
      'select[name="severity"]',
      TEST_ISSUE.severity,
    );
    await this.page.selectOption(
      'select[name="consistency"]',
      TEST_ISSUE.consistency,
    );

    // Submit full form
    await this.page.click('button:has-text("Submit Issue")');

    // Wait for success
    await this.page.waitForSelector(".success-message, .toast-success");
  }

  async createIssueWithExplicitConfirmation(isConfirmed: boolean) {
    // Navigate to issue creation
    await this.page.click('button:has-text("Report Issue")');

    // Switch to full form
    await this.page.click('button:has-text("Use Full Form")');

    // Fill basic fields
    await this.page.fill('input[name="title"]', TEST_ISSUE.title);
    await this.page.selectOption('select[name="machine"]', TEST_ISSUE.machine);

    // Set explicit confirmation status
    if (isConfirmed) {
      await this.page.check('input[name="isConfirmed"]');
    } else {
      await this.page.uncheck('input[name="isConfirmed"]');
    }

    // Submit form
    await this.page.click('button:has-text("Submit Issue")');

    // Wait for success
    await this.page.waitForSelector(".success-message, .toast-success");
  }

  async navigateToIssueList() {
    await this.page.click('nav a:has-text("Issues")');
    await this.page.waitForURL("/issues");
  }

  async findIssueByTitle(title: string) {
    await this.navigateToIssueList();
    return this.page.locator(`tr:has-text("${title}")`);
  }

  async toggleIssueConfirmation(issueTitle: string, shouldConfirm: boolean) {
    // Find the issue
    const issueRow = await this.findIssueByTitle(issueTitle);

    // Click on the issue to open details
    await issueRow.click();

    // Find confirmation toggle button
    const confirmButton = this.page.locator('button:has-text("Confirm Issue")');
    const unconfirmButton = this.page.locator(
      'button:has-text("Unconfirm Issue")',
    );

    if (shouldConfirm) {
      await confirmButton.click();
    } else {
      await unconfirmButton.click();
    }

    // Wait for update
    await this.page.waitForSelector(".success-message, .toast-success");
  }

  async verifyIssueConfirmationStatus(
    issueTitle: string,
    expectedStatus: "confirmed" | "unconfirmed",
  ) {
    const issueRow = await this.findIssueByTitle(issueTitle);

    if (expectedStatus === "confirmed") {
      await expect(
        issueRow.locator(".confirmation-badge.confirmed"),
      ).toBeVisible();
      await expect(issueRow.locator(".confirmation-badge")).toContainText(
        "Confirmed",
      );
    } else {
      await expect(
        issueRow.locator(".confirmation-badge.unconfirmed"),
      ).toBeVisible();
      await expect(issueRow.locator(".confirmation-badge")).toContainText(
        "Unconfirmed",
      );
    }
  }

  async verifyConfirmationButtonVisibility(
    issueTitle: string,
    shouldBeVisible: boolean,
  ) {
    const issueRow = await this.findIssueByTitle(issueTitle);
    await issueRow.click();

    const confirmButton = this.page.locator(
      'button:has-text("Confirm Issue"), button:has-text("Unconfirm Issue")',
    );

    if (shouldBeVisible) {
      await expect(confirmButton).toBeVisible();
    } else {
      await expect(confirmButton).not.toBeVisible();
    }
  }

  async viewConfirmationStatistics() {
    await this.page.click('nav a:has-text("Reports")');
    await this.page.click('a:has-text("Confirmation Stats")');
    await this.page.waitForURL("/reports/confirmation");
  }

  async verifyConfirmationStats(expectedStats: {
    total: number;
    confirmed: number;
    unconfirmed: number;
    rate: number;
  }) {
    await this.viewConfirmationStatistics();

    await expect(this.page.locator(".stat-total")).toContainText(
      expectedStats.total.toString(),
    );
    await expect(this.page.locator(".stat-confirmed")).toContainText(
      expectedStats.confirmed.toString(),
    );
    await expect(this.page.locator(".stat-unconfirmed")).toContainText(
      expectedStats.unconfirmed.toString(),
    );
    await expect(this.page.locator(".stat-rate")).toContainText(
      `${expectedStats.rate}%`,
    );
  }

  async filterIssuesByConfirmationStatus(
    status: "all" | "confirmed" | "unconfirmed",
  ) {
    await this.navigateToIssueList();
    await this.page.selectOption('select[name="confirmationFilter"]', status);
    await this.page.waitForTimeout(500); // Wait for filter to apply
  }
}

test.describe("Issue Creation Form Types", () => {
  let confirmationPage: IssueConfirmationPage;

  test.beforeEach(async ({ page }) => {
    confirmationPage = new IssueConfirmationPage(page);
  });

  test("basic form creates unconfirmed issues", async ({ page }) => {
    // Arrange
    await confirmationPage.loginAs("user");

    // Act
    await confirmationPage.createIssueWithBasicForm();

    // Assert
    await confirmationPage.verifyIssueConfirmationStatus(
      TEST_ISSUE.title,
      "unconfirmed",
    );
  });

  test("full form creates confirmed issues by default", async ({ page }) => {
    // Arrange
    await confirmationPage.loginAs("technician");

    // Act
    await confirmationPage.createIssueWithFullForm();

    // Assert
    await confirmationPage.verifyIssueConfirmationStatus(
      TEST_ISSUE.title,
      "confirmed",
    );
  });

  test("full form allows explicit confirmation override", async ({ page }) => {
    // Arrange
    await confirmationPage.loginAs("admin");

    // Act - Create with explicit unconfirmed status
    await confirmationPage.createIssueWithExplicitConfirmation(false);

    // Assert
    await confirmationPage.verifyIssueConfirmationStatus(
      TEST_ISSUE.title,
      "unconfirmed",
    );
  });

  test("form type selection is preserved during navigation", async ({
    page,
  }) => {
    // Arrange
    await confirmationPage.loginAs("user");

    // Navigate to issue creation
    await page.click('button:has-text("Report Issue")');

    // Switch to full form
    await page.click('button:has-text("Use Full Form")');

    // Navigate away and back
    await page.click('nav a:has-text("Dashboard")');
    await page.click('button:has-text("Report Issue")');

    // Assert - Should remember full form preference
    await expect(page.locator(".issue-form.full")).toBeVisible();
  });

  test("basic form shows simplified UI", async ({ page }) => {
    // Arrange
    await confirmationPage.loginAs("user");

    // Act
    await page.click('button:has-text("Report Issue")');

    // Assert
    await expect(page.locator(".issue-form.basic")).toBeVisible();
    await expect(page.locator('input[name="title"]')).toBeVisible();
    await expect(page.locator('select[name="machine"]')).toBeVisible();

    // These fields should not be visible in basic form
    await expect(
      page.locator('textarea[name="description"]'),
    ).not.toBeVisible();
    await expect(page.locator('select[name="severity"]')).not.toBeVisible();
    await expect(page.locator('select[name="consistency"]')).not.toBeVisible();
    await expect(page.locator('input[name="isConfirmed"]')).not.toBeVisible();
  });

  test("full form shows all fields", async ({ page }) => {
    // Arrange
    await confirmationPage.loginAs("technician");

    // Act
    await page.click('button:has-text("Report Issue")');
    await page.click('button:has-text("Use Full Form")');

    // Assert
    await expect(page.locator(".issue-form.full")).toBeVisible();
    await expect(page.locator('input[name="title"]')).toBeVisible();
    await expect(page.locator('textarea[name="description"]')).toBeVisible();
    await expect(page.locator('select[name="machine"]')).toBeVisible();
    await expect(page.locator('select[name="severity"]')).toBeVisible();
    await expect(page.locator('select[name="consistency"]')).toBeVisible();
    await expect(page.locator('input[name="isConfirmed"]')).toBeVisible();
  });
});

test.describe("Confirmation Status Management", () => {
  let confirmationPage: IssueConfirmationPage;

  test.beforeEach(async ({ page }) => {
    confirmationPage = new IssueConfirmationPage(page);
  });

  test("technician can toggle issue confirmation", async ({ page }) => {
    // Arrange
    await confirmationPage.loginAs("technician");
    await confirmationPage.createIssueWithBasicForm(); // Creates unconfirmed issue

    // Act
    await confirmationPage.toggleIssueConfirmation(TEST_ISSUE.title, true);

    // Assert
    await confirmationPage.verifyIssueConfirmationStatus(
      TEST_ISSUE.title,
      "confirmed",
    );
  });

  test("admin can toggle issue confirmation", async ({ page }) => {
    // Arrange
    await confirmationPage.loginAs("admin");
    await confirmationPage.createIssueWithFullForm(); // Creates confirmed issue

    // Act
    await confirmationPage.toggleIssueConfirmation(TEST_ISSUE.title, false);

    // Assert
    await confirmationPage.verifyIssueConfirmationStatus(
      TEST_ISSUE.title,
      "unconfirmed",
    );
  });

  test("regular user cannot toggle confirmation", async ({ page }) => {
    // Arrange
    await confirmationPage.loginAs("user");
    await confirmationPage.createIssueWithBasicForm();

    // Act & Assert
    await confirmationPage.verifyConfirmationButtonVisibility(
      TEST_ISSUE.title,
      false,
    );
  });

  test("confirmation status is preserved across page reloads", async ({
    page,
  }) => {
    // Arrange
    await confirmationPage.loginAs("admin");
    await confirmationPage.createIssueWithBasicForm();
    await confirmationPage.toggleIssueConfirmation(TEST_ISSUE.title, true);

    // Act
    await page.reload();

    // Assert
    await confirmationPage.verifyIssueConfirmationStatus(
      TEST_ISSUE.title,
      "confirmed",
    );
  });

  test("confirmation timestamp is displayed", async ({ page }) => {
    // Arrange
    await confirmationPage.loginAs("technician");
    await confirmationPage.createIssueWithBasicForm();

    // Act
    await confirmationPage.toggleIssueConfirmation(TEST_ISSUE.title, true);

    // Assert
    const issueRow = await confirmationPage.findIssueByTitle(TEST_ISSUE.title);
    await issueRow.click();

    await expect(page.locator(".confirmation-timestamp")).toBeVisible();
    await expect(page.locator(".confirmation-timestamp")).toContainText(
      "Confirmed",
    );
    await expect(page.locator(".confirmed-by")).toContainText(
      "tech@example.com",
    );
  });
});

test.describe("Issue Listing and Filtering", () => {
  let confirmationPage: IssueConfirmationPage;

  test.beforeEach(async ({ page }) => {
    confirmationPage = new IssueConfirmationPage(page);
  });

  test("issues display confirmation status badges", async ({ page }) => {
    // Arrange
    await confirmationPage.loginAs("technician");

    // Create both types of issues
    await confirmationPage.createIssueWithBasicForm(); // Unconfirmed
    await confirmationPage.createIssueWithFullForm(); // Confirmed

    // Act
    await confirmationPage.navigateToIssueList();

    // Assert
    const unconfirmedIssue = page
      .locator('tr:has-text("Test Issue for Confirmation")')
      .first();
    const confirmedIssue = page
      .locator('tr:has-text("Test Issue for Confirmation")')
      .last();

    await expect(
      unconfirmedIssue.locator(".confirmation-badge.unconfirmed"),
    ).toBeVisible();
    await expect(
      confirmedIssue.locator(".confirmation-badge.confirmed"),
    ).toBeVisible();
  });

  test("can filter issues by confirmation status", async ({ page }) => {
    // Arrange
    await confirmationPage.loginAs("technician");
    await confirmationPage.createIssueWithBasicForm(); // Unconfirmed
    await confirmationPage.createIssueWithFullForm(); // Confirmed

    // Act - Filter to only confirmed
    await confirmationPage.filterIssuesByConfirmationStatus("confirmed");

    // Assert
    const visibleIssues = page.locator('tr[data-confirmation="confirmed"]');
    await expect(visibleIssues).toHaveCount(1);

    const hiddenIssues = page.locator('tr[data-confirmation="unconfirmed"]');
    await expect(hiddenIssues).toHaveCount(0);
  });

  test("confirmation filter persists across navigation", async ({ page }) => {
    // Arrange
    await confirmationPage.loginAs("user");

    // Set filter
    await confirmationPage.filterIssuesByConfirmationStatus("unconfirmed");

    // Navigate away and back
    await page.click('nav a:has-text("Dashboard")');
    await page.click('nav a:has-text("Issues")');

    // Assert
    await expect(page.locator('select[name="confirmationFilter"]')).toHaveValue(
      "unconfirmed",
    );
  });

  test("issue count reflects confirmation filter", async ({ page }) => {
    // Arrange
    await confirmationPage.loginAs("technician");
    await confirmationPage.createIssueWithBasicForm(); // Unconfirmed
    await confirmationPage.createIssueWithFullForm(); // Confirmed

    // Act
    await confirmationPage.filterIssuesByConfirmationStatus("confirmed");

    // Assert
    await expect(page.locator(".issue-count")).toContainText("1 issue");

    // Change filter
    await confirmationPage.filterIssuesByConfirmationStatus("all");
    await expect(page.locator(".issue-count")).toContainText("2 issues");
  });
});

test.describe("Confirmation Statistics", () => {
  let confirmationPage: IssueConfirmationPage;

  test.beforeEach(async ({ page }) => {
    confirmationPage = new IssueConfirmationPage(page);
  });

  test("displays accurate confirmation statistics", async ({ page }) => {
    // Arrange
    await confirmationPage.loginAs("technician");

    // Create test data
    await confirmationPage.createIssueWithBasicForm(); // Unconfirmed
    await confirmationPage.createIssueWithFullForm(); // Confirmed
    await confirmationPage.createIssueWithFullForm(); // Confirmed

    // Act & Assert
    await confirmationPage.verifyConfirmationStats({
      total: 3,
      confirmed: 2,
      unconfirmed: 1,
      rate: 67, // 2/3 * 100 = 67%
    });
  });

  test("statistics update when confirmation status changes", async ({
    page,
  }) => {
    // Arrange
    await confirmationPage.loginAs("admin");
    await confirmationPage.createIssueWithBasicForm(); // Unconfirmed

    // Initial stats
    await confirmationPage.verifyConfirmationStats({
      total: 1,
      confirmed: 0,
      unconfirmed: 1,
      rate: 0,
    });

    // Act
    await confirmationPage.toggleIssueConfirmation(TEST_ISSUE.title, true);

    // Assert
    await confirmationPage.verifyConfirmationStats({
      total: 1,
      confirmed: 1,
      unconfirmed: 0,
      rate: 100,
    });
  });

  test("statistics can be filtered by date range", async ({ page }) => {
    // Arrange
    await confirmationPage.loginAs("admin");
    await confirmationPage.viewConfirmationStatistics();

    // Act
    await page.fill('input[name="startDate"]', "2024-01-01");
    await page.fill('input[name="endDate"]', "2024-12-31");
    await page.click('button:has-text("Apply Filter")');

    // Assert
    await expect(page.locator(".date-range-filter")).toBeVisible();
    await expect(page.locator(".filtered-stats")).toBeVisible();
  });

  test("statistics can be filtered by location", async ({ page }) => {
    // Arrange
    await confirmationPage.loginAs("admin");
    await confirmationPage.viewConfirmationStatistics();

    // Act
    await page.selectOption('select[name="locationFilter"]', "Test Location");
    await page.click('button:has-text("Apply Filter")');

    // Assert
    await expect(page.locator(".location-filtered-stats")).toBeVisible();
  });

  test("statistics show confirmation rate trends", async ({ page }) => {
    // Arrange
    await confirmationPage.loginAs("admin");
    await confirmationPage.viewConfirmationStatistics();

    // Act
    await page.click('button:has-text("View Trends")');

    // Assert
    await expect(page.locator(".confirmation-trend-chart")).toBeVisible();
    await expect(page.locator(".trend-line")).toBeVisible();
  });
});

test.describe("Permission-Based Access Control", () => {
  let confirmationPage: IssueConfirmationPage;

  test.beforeEach(async ({ page }) => {
    confirmationPage = new IssueConfirmationPage(page);
  });

  test("users without issue:confirm permission cannot toggle confirmation", async ({
    page,
  }) => {
    // Arrange
    await confirmationPage.loginAs("user");
    await confirmationPage.createIssueWithBasicForm();

    // Act & Assert
    await confirmationPage.verifyConfirmationButtonVisibility(
      TEST_ISSUE.title,
      false,
    );
  });

  test("form type availability depends on permissions", async ({ page }) => {
    // Arrange
    await confirmationPage.loginAs("user");

    // Act
    await page.click('button:has-text("Report Issue")');

    // Assert
    // Regular users might only see basic form
    await expect(page.locator(".form-type-selector")).not.toBeVisible();
    await expect(page.locator(".issue-form.basic")).toBeVisible();
  });

  test("confirmation statistics visibility is role-based", async ({ page }) => {
    // Arrange
    await confirmationPage.loginAs("user");

    // Act & Assert
    // Regular users should not see detailed confirmation statistics
    await page.click('nav a:has-text("Reports")');
    await expect(
      page.locator('a:has-text("Confirmation Stats")'),
    ).not.toBeVisible();
  });

  test("admin can access all confirmation features", async ({ page }) => {
    // Arrange
    await confirmationPage.loginAs("admin");

    // Act & Assert
    // Admin should have access to all features
    await page.click('nav a:has-text("Reports")');
    await expect(
      page.locator('a:has-text("Confirmation Stats")'),
    ).toBeVisible();

    await confirmationPage.createIssueWithBasicForm();
    await confirmationPage.verifyConfirmationButtonVisibility(
      TEST_ISSUE.title,
      true,
    );
  });
});
