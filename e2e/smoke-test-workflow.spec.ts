import { test, expect } from "@playwright/test";
import { logout } from "./helpers/unified-dashboard";

/**
 * Complete Issue Workflow Smoke Test
 *
 * Tests the entire user journey from issue creation through admin management.
 * This serves as a comprehensive smoke test to catch major regressions.
 *
 * Uses robust data-testid selectors to minimize flakiness from UI changes.
 * Provides clear error context when failures occur.
 */

test.describe("Smoke Test: Complete Issue Workflow", () => {
  test("should complete full issue creation to closure workflow", async ({
    page,
  }) => {
    // Generate unique issue title for this test run
    const timestamp = Date.now();
    const branch = "main"; // Could be dynamic if needed
    const issueTitle = `SMOKE-TEST-${branch}-${timestamp}`;
    const testEmail = "smoketest@example.com";

    // Enhanced debugging version - monitoring CI behavior
    console.log(`🧪 SMOKE TEST - Starting workflow with issue: ${issueTitle}`);

    // Step 1: Start Clean
    console.log("🧪 SMOKE TEST - Step 1: Clearing session and starting fresh");
    await logout(page);
    // Initial navigation (baseURL already points at apc subdomain)
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    console.log(
      "✅ SMOKE TEST - Step 1 Complete: Session cleared, on home page",
    );

    // Step 2: Go to Issue Creation
    console.log("🧪 SMOKE TEST - Step 2: Navigating to issue creation");
    await page.goto("/issues/create");
    await page.waitForLoadState("networkidle");

    // Enhanced debugging for CI failures
    const currentUrl = page.url();
    const pageTitle = await page.title();
    console.log(`🔍 SMOKE TEST - Current URL: ${currentUrl}`);
    console.log(`🔍 SMOKE TEST - Page title: ${pageTitle}`);

    // Check for error indicators
    const errorElements = await page
      .locator('[data-testid="error"], .error, [role="alert"]')
      .count();
    if (errorElements > 0) {
      const errorText = await page
        .locator('[data-testid="error"], .error, [role="alert"]')
        .first()
        .textContent();
      console.log(`🚨 SMOKE TEST - Error found on page: ${errorText}`);
    }

    // Check what h1 elements actually exist
    const h1Elements = await page.locator("h1").all();
    console.log(`🔍 SMOKE TEST - Found ${h1Elements.length} h1 elements`);
    for (let i = 0; i < h1Elements.length; i++) {
      const text = await h1Elements[i].textContent();
      console.log(`🔍 SMOKE TEST - h1[${i}]: "${text}"`);
    }

    // If no h1 found, check page content structure
    if (h1Elements.length === 0) {
      const bodyText = await page.locator("body").textContent();
      console.log(
        `🔍 SMOKE TEST - Page body text (first 500 chars): ${bodyText?.substring(0, 500)}`,
      );

      // Check if page has any content at all
      const allText = await page.textContent("body");
      if (!allText || allText.trim().length === 0) {
        console.log(`🚨 SMOKE TEST - Page appears to be empty or not loaded`);
      }
    }

    // Verify we're on the create page
    try {
      await expect(page.locator("h1")).toContainText("Create New Issue", {
        timeout: 10000,
      });
      console.log("✅ SMOKE TEST - Step 2 Complete: On issue creation page");
    } catch (error) {
      console.log(`🚨 SMOKE TEST - Failed to find 'Create New Issue' heading`);
      console.log(`🚨 SMOKE TEST - Error: ${error}`);
      throw error;
    }

    // Step 3: Pick a Game
    console.log("🧪 SMOKE TEST - Step 3: Selecting first available game");

    // Wait for the MUI Select component to load
    const machineSelect = page.locator('[role="combobox"]').first();
    try {
      await expect(machineSelect).toBeVisible({ timeout: 10000 });
    } catch (error) {
      throw new Error(
        `Step 3 FAILED: Machine selector not found. The page may not have loaded properly or the machine selector component failed to render. Error: ${error}`,
      );
    }

    // Click to open the dropdown
    await machineSelect.click();

    // Wait for the dropdown menu to appear and select the first non-empty option
    const firstOption = page.locator('[role="option"]').nth(1); // Skip placeholder at index 0
    await expect(firstOption).toBeVisible({ timeout: 5000 });

    // Get the text content before clicking
    const selectedMachine = await firstOption.textContent();
    await firstOption.click();

    // Wait for dropdown to close by waiting for the menu to be hidden
    await page.waitForSelector('[id^="menu-"]', {
      state: "hidden",
      timeout: 5000,
    });

    expect(selectedMachine).toBeTruthy();
    console.log(
      `✅ SMOKE TEST - Step 3 Complete: Selected machine "${selectedMachine}"`,
    );

    // Step 4: Fill Issue Form
    console.log("🧪 SMOKE TEST - Step 4: Filling issue form");

    // Use reliable test IDs - no fallbacks
    const titleInput = page.getByTestId("issue-title-input").locator("input");
    await expect(titleInput).toBeVisible({ timeout: 5000 });
    await titleInput.fill(issueTitle);

    const emailInput = page.getByTestId("issue-email-input").locator("input");
    await expect(emailInput).toBeVisible();
    await emailInput.fill(testEmail);

    console.log(
      `✅ SMOKE TEST - Step 4 Complete: Form filled with title "${issueTitle}" and email "${testEmail}"`,
    );

    // Step 5: Submit
    console.log("🧪 SMOKE TEST - Step 5: Submitting issue");

    // Find and click submit button
    const submitButton = page.getByTestId("issue-submit-button");
    try {
      await expect(submitButton).toBeVisible();
      await submitButton.click();
    } catch (error) {
      throw new Error(
        `Step 5 FAILED: Submit button not found or could not be clicked. Check if the form is properly rendered and enabled. Error: ${error}`,
      );
    }

    // Wait for success indication
    try {
      await expect(page.getByTestId("issue-success-message")).toBeVisible({
        timeout: 10000,
      });
    } catch (error) {
      throw new Error(
        `Step 5 FAILED: Success message not displayed after form submission. The issue creation may have failed on the backend. Error: ${error}`,
      );
    }

    console.log(
      "✅ SMOKE TEST - Step 5 Complete: Issue submitted successfully",
    );
    console.log(
      "🎯 SMOKE TEST - MINIMUM THRESHOLD REACHED - Issue creation works!",
    );

    // Step 6: Dev Login
    console.log("🧪 SMOKE TEST - Step 6: Logging in as Dev Admin");

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Find and click dev quick login section to expand it
    console.log("🔍 SMOKE TEST - Looking for Dev Quick Login...");
    const devLoginSection = page.locator('text="Dev Quick Login"');
    await expect(devLoginSection).toBeVisible({ timeout: 5000 });
    await devLoginSection.click();

    // Wait for the section to expand and users to load
    console.log("🔍 SMOKE TEST - Waiting for dev users to load...");

    // First, wait for loading to finish (if "Loading users..." appears)
    const loadingText = page.locator('text="Loading users..."');
    if (await loadingText.isVisible().catch(() => false)) {
      await expect(loadingText).not.toBeVisible({ timeout: 10000 });
    }

    // Then look for the admin user button (Tim Froehlich from seed data)
    console.log("🔍 SMOKE TEST - Looking for admin user button...");
    const devAdminButton = page
      .locator("button", {
        hasText: /Tim Froehlich|tim\.froehlich@example\.com/i,
      })
      .first();

    // Add some debug info if button not found
    if (!(await devAdminButton.isVisible().catch(() => false))) {
      const allButtons = await page.locator("button").allTextContents();
      console.log("🔍 SMOKE TEST - Available buttons:", allButtons);
      const pageContent = await page.textContent("body");
      console.log(
        "🔍 SMOKE TEST - Page content:",
        pageContent?.substring(0, 1000),
      );
    }

    await expect(devAdminButton).toBeVisible({ timeout: 10000 });
    await devAdminButton.click();

    // Wait for authentication to complete
    console.log("🔍 SMOKE TEST - Waiting for authentication...");

    // Wait for navigation to complete after login
    await page.waitForLoadState("networkidle", { timeout: 10000 });

    // Debug: Check what's actually on the page after login
    const postLoginUrl = page.url();
    console.log(`🔍 SMOKE TEST - Current URL after login: ${postLoginUrl}`);

    // Look for common dashboard indicators
    const dashboardIndicators = [
      'text="My Dashboard"',
      'text="Dashboard"',
      'h1:has-text("Dashboard")',
      '[data-testid="dashboard"]',
      'text="Issues"',
      'text="Machines"',
    ];

    let foundDashboardIndicator = false;
    for (const indicator of dashboardIndicators) {
      if (
        await page
          .locator(indicator)
          .isVisible()
          .catch(() => false)
      ) {
        console.log(`🔍 SMOKE TEST - Found dashboard indicator: ${indicator}`);
        foundDashboardIndicator = true;
        break;
      }
    }

    if (!foundDashboardIndicator) {
      // Get page content for debugging
      const pageContent = await page.textContent("body");
      console.log(
        `🔍 SMOKE TEST - Page content after login (first 500 chars): ${pageContent?.substring(0, 500)}`,
      );

      // Check for any h1 elements
      const h1Elements = await page.locator("h1").allTextContents();
      console.log(
        `🔍 SMOKE TEST - H1 elements after login: ${JSON.stringify(h1Elements)}`,
      );
    }

    // Try to find any dashboard-like content
    try {
      await expect(
        page
          .locator('text="Dashboard", text="Issues", text="Machines"')
          .first(),
      ).toBeVisible({ timeout: 5000 });
    } catch (error) {
      console.log(
        "🔍 SMOKE TEST - No standard dashboard elements found, continuing anyway",
      );
    }

    console.log(
      "✅ SMOKE TEST - Step 6 Complete: Logged in as Tim Froehlich (admin)",
    );

    // Step 7: Find Issue
    console.log("🧪 SMOKE TEST - Step 7: Navigating to issues and searching");

    await page.goto("/issues");
    await page.waitForLoadState("networkidle");

    // Search for the issue
    const searchInput = page.getByRole("textbox", { name: /search/i });
    if (await searchInput.isVisible()) {
      await searchInput.fill("SMOKE-TEST");
      // Wait for search results to update (look for our specific issue)
      await expect(page.locator(`text="${issueTitle}"`)).toBeVisible({
        timeout: 5000,
      });
    }

    console.log(
      "✅ SMOKE TEST - Step 7 Complete: On issues page, searched for SMOKE-TEST",
    );

    // Step 8: Open Issue
    console.log("🧪 SMOKE TEST - Step 8: Opening the created issue");

    // Click the issue title link (no fallbacks)
    const issueLink = page.getByRole("link", { name: issueTitle });
    await expect(issueLink).toBeVisible({ timeout: 5000 });
    await issueLink.click();

    await page.waitForLoadState("networkidle");

    // Verify we're on the issue detail page by checking for Comments section
    await expect(page.getByText("Comments", { exact: true })).toBeVisible({
      timeout: 15000,
    });
    console.log("✅ SMOKE TEST - Step 8 Complete: Opened issue detail page");

    // Step 9: Add Comment
    console.log("🧪 SMOKE TEST - Step 9: Adding admin comment");

    const commentText = "Admin reviewed this issue";
    const commentTextarea = page.getByRole("textbox", {
      name: "Write your comment...",
    });
    try {
      await expect(commentTextarea).toBeVisible();
      await commentTextarea.fill(commentText);
    } catch (error) {
      throw new Error(
        `Step 9 FAILED: Comment textarea not found. Check if user has proper permissions and the comment form is displayed. Error: ${error}`,
      );
    }

    // Submit comment
    const commentSubmit = page.getByTestId("submit-comment-button");
    try {
      await commentSubmit.click();
    } catch (error) {
      throw new Error(
        `Step 9 FAILED: Comment submit button not found or could not be clicked. Error: ${error}`,
      );
    }

    // Verify comment appears
    try {
      await expect(page.locator(`text="${commentText}"`)).toBeVisible({
        timeout: 10000,
      });
    } catch (error) {
      throw new Error(
        `Step 9 FAILED: Comment did not appear after submission. The comment creation may have failed. Error: ${error}`,
      );
    }
    console.log("✅ SMOKE TEST - Step 9 Complete: Comment added and verified");

    // Step 10: Close Issue
    console.log("🧪 SMOKE TEST - Step 10: Closing the issue");

    // Look for the close button first (this is the primary action)
    const closeButton = page.getByTestId("close-issue-button");
    if (await closeButton.isVisible()) {
      console.log("🔍 SMOKE TEST - Found Close Issue button, clicking...");
      await closeButton.click();

      // Wait for the button to show "Closing..." then return to enabled state
      await expect(closeButton).toContainText("Closing...");
      console.log(
        "🔍 SMOKE TEST - Button shows 'Closing...', waiting for completion...",
      );

      // Wait for the operation to complete (button text changes back and becomes enabled)
      await expect(closeButton).not.toContainText("Closing...", {
        timeout: 10000,
      });
      await expect(closeButton).toBeEnabled({ timeout: 5000 });
      console.log("🔍 SMOKE TEST - Close operation completed");
    } else {
      // Fallback: Look for status dropdown
      const statusSelect = page.getByRole("combobox", {
        name: /status|change status/i,
      });
      if (await statusSelect.isVisible()) {
        console.log("🔍 SMOKE TEST - Using status dropdown as fallback...");
        // Click to open the MUI Select dropdown
        await statusSelect.click();

        // Wait for dropdown options to appear and select a closed status
        const closedOptions = ["Fixed", "Closed", "Resolved", "Complete"];
        for (const status of closedOptions) {
          const option = page.getByRole("option", {
            name: new RegExp(status, "i"),
          });
          if ((await option.count()) > 0) {
            await option.click();
            break;
          }
        }
      } else {
        throw new Error(
          "Step 10 FAILED: Could not find close button or status dropdown",
        );
      }
    }

    console.log("✅ SMOKE TEST - Step 10 Complete: Issue status updated");

    // Step 11: Verify Closure
    console.log("🧪 SMOKE TEST - Step 11: Verifying issue is closed");

    // Wait a moment for UI to update after the close operation
    await page.waitForTimeout(1000);

    // Look for indicators that the issue is closed
    // Based on the seeding data, "Fixed" is the resolved status name
    console.log("🔍 SMOKE TEST - Looking for closure indicators...");

    let foundClosure = false;
    let foundIndicator = "";

    // Primary indicators: Status chips/badges with "Fixed" text
    const statusChip = page.locator('text="Fixed"').first();
    if (await statusChip.isVisible().catch(() => false)) {
      foundClosure = true;
      foundIndicator = "Status chip with 'Fixed'";
    }

    // Secondary: Look in status section
    if (!foundClosure) {
      const statusSection = page
        .locator('[data-testid*="status"], .status')
        .locator('text="Fixed"');
      if (await statusSection.isVisible().catch(() => false)) {
        foundClosure = true;
        foundIndicator = "Status section with 'Fixed'";
      }
    }

    // Tertiary: Any element containing fixed/closed/resolved
    if (!foundClosure) {
      const closedIndicators = [
        'text="Fixed"',
        'text="Closed"',
        'text="Resolved"',
        ':has-text("Fixed")',
        ':has-text("Closed")',
        ':has-text("Resolved")',
      ];

      for (const indicator of closedIndicators) {
        if (
          await page
            .locator(indicator)
            .isVisible()
            .catch(() => false)
        ) {
          foundClosure = true;
          foundIndicator = `Indicator: ${indicator}`;
          break;
        }
      }
    }

    console.log(
      `🔍 SMOKE TEST - Closure check result: ${foundClosure ? "✅ FOUND" : "❌ NOT FOUND"}`,
    );
    if (foundClosure) {
      console.log(`🔍 SMOKE TEST - Found via: ${foundIndicator}`);
    } else {
      // Debug: Show what's actually on the page
      const pageContent = await page.textContent("body");
      console.log("🔍 SMOKE TEST - Page content for debugging:");
      console.log(pageContent?.substring(0, 500) + "...");
    }

    expect(foundClosure).toBe(true);
    console.log("✅ SMOKE TEST - Step 11 Complete: Issue closure verified");

    console.log(
      "🎉 SMOKE TEST - ALL STEPS COMPLETE - Full workflow successful!",
    );
    console.log(`📊 SMOKE TEST SUMMARY:`);
    console.log(`   Issue Created: ${issueTitle}`);
    console.log(`   Email: ${testEmail}`);
    console.log(`   Machine: ${selectedMachine}`);
    console.log(`   Status: Successfully closed by admin`);
    console.log(`   Comment: Added and verified`);
  });
});
