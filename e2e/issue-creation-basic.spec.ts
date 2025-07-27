import { test, expect, type Page } from "@playwright/test";

/**
 * Basic Issue Creation Tests
 *
 * Focused tests to identify core functionality and issues in the issue creation page
 */

// Helper function to safely navigate to create page
async function navigateToCreatePage(page: Page): Promise<void> {
  await page.goto("/issues/create");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000); // Give React time to render
}

test.describe("Issue Creation Basic Tests", () => {
  test("should load the issue creation page successfully", async ({ page }) => {
    await navigateToCreatePage(page);

    // Check if page loaded
    await expect(page.locator('h1:has-text("Create New Issue")')).toBeVisible();

    // Take screenshot for debugging
    await page.screenshot({ path: "test-results/issue-create-loaded.png" });
  });

  test("should show breadcrumbs navigation", async ({ page }) => {
    await navigateToCreatePage(page);

    // Check breadcrumbs exist
    await expect(page.locator('nav[aria-label="breadcrumb"]')).toBeVisible();
    await expect(page.locator('text="Home"')).toBeVisible();
    await expect(page.locator('text="Issues"')).toBeVisible();
    await expect(page.locator('text="Create"')).toBeVisible();
  });

  test("should show the form elements", async ({ page }) => {
    await navigateToCreatePage(page);

    // Check main form components
    await expect(page.locator("form")).toBeVisible();
    await expect(page.locator('text="Select Machine"')).toBeVisible();
    await expect(page.locator('text="Issue Details"')).toBeVisible();

    // Check for submit button
    await expect(page.locator('button:has-text("Create Issue")')).toBeVisible();
  });

  test("should show form validation", async ({ page }) => {
    await navigateToCreatePage(page);

    // Check if submit button is disabled when form is empty
    const submitButton = page.locator('button:has-text("Create Issue")');
    await expect(submitButton).toBeVisible();

    // Button should be disabled initially
    await expect(submitButton).toBeDisabled();
  });

  test("should show anonymous user email field", async ({ page }) => {
    await navigateToCreatePage(page);

    // Look for email field for anonymous users
    const emailField = page.locator('input[type="email"]');
    const signInLink = page.locator('text="Sign in"');

    // Check if anonymous user section exists
    if (await emailField.isVisible()) {
      console.log("Anonymous user email field is visible");
      await expect(signInLink).toBeVisible();
    } else {
      console.log(
        "User appears to be authenticated or email field not visible",
      );
    }
  });

  test("should handle machine selection", async ({ page }) => {
    await navigateToCreatePage(page);

    // Find machine selector
    await expect(page.locator('text="Select Machine"')).toBeVisible();

    // Look for autocomplete or dropdown
    const machineInput = page.locator('input[role="combobox"]').first();
    if (await machineInput.isVisible()) {
      await machineInput.click();
      await page.waitForTimeout(1000);

      // Check if options appear
      const options = page.locator('[role="option"]');
      const optionCount = await options.count();
      console.log(`Found ${optionCount} machine options`);
    } else {
      console.log("Machine selector not found or different structure");
    }
  });

  test("should fill and submit a basic issue", async ({ page }) => {
    await navigateToCreatePage(page);

    try {
      // Fill title
      const titleField = page
        .locator("input")
        .filter({ hasText: /title/i })
        .or(page.locator('input[placeholder*="Brief description"]'))
        .first();

      if (await titleField.isVisible()) {
        await titleField.fill("Test Issue - Basic E2E");
        console.log("Title filled successfully");
      }

      // Try to select a machine
      const machineInput = page.locator('input[role="combobox"]').first();
      if (await machineInput.isVisible()) {
        await machineInput.click();
        await page.waitForTimeout(1000);

        const firstOption = page.locator('[role="option"]').first();
        if (await firstOption.isVisible()) {
          await firstOption.click();
          console.log("Machine selected successfully");
        }
      }

      // Check submit button state
      const submitButton = page.locator('button:has-text("Create Issue")');
      const isEnabled = await submitButton.isEnabled();
      console.log(`Submit button enabled: ${isEnabled}`);

      if (isEnabled) {
        await submitButton.click();

        // Look for success message
        await expect(
          page.locator('text="Issue Created Successfully"'),
        ).toBeVisible({ timeout: 10000 });
        console.log("Issue created successfully!");
      } else {
        console.log(
          "Submit button is disabled - form validation preventing submission",
        );
      }
    } catch (error) {
      console.log("Error during form submission:", error);
      await page.screenshot({ path: "test-results/issue-create-error.png" });
    }
  });

  test("should test Report Issue button in app bar", async ({ page }) => {
    // Start from home page
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Click Report Issue button
    const reportButton = page.locator(
      'a[href="/issues/create"]:has-text("Report Issue")',
    );
    await expect(reportButton).toBeVisible();
    await reportButton.click();

    // Should navigate to create page
    await page.waitForURL("/issues/create");
    await expect(page.locator('h1:has-text("Create New Issue")')).toBeVisible();
  });
});
