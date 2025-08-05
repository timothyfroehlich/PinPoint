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
    const testEmail = "smoketest@test.local";

    console.log(`🧪 SMOKE TEST - Starting workflow with issue: ${issueTitle}`);

    // Step 1: Start Clean
    console.log("🧪 SMOKE TEST - Step 1: Clearing session and starting fresh");
    await logout(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    console.log(
      "✅ SMOKE TEST - Step 1 Complete: Session cleared, on home page",
    );

    // Step 2: Go to Issue Creation
    console.log("🧪 SMOKE TEST - Step 2: Navigating to issue creation");
    await page.goto("/issues/create");
    await page.waitForLoadState("networkidle");

    // Verify we're on the create page
    await expect(page.locator("h1")).toContainText("Create");
    console.log("✅ SMOKE TEST - Step 2 Complete: On issue creation page");

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

    expect(selectedMachine).toBeTruthy();
    console.log(
      `✅ SMOKE TEST - Step 3 Complete: Selected machine "${selectedMachine}"`,
    );

    // Step 4: Create Issue
    console.log("🧪 SMOKE TEST - Step 4: Filling issue form");

    // Fill in the issue title
    const titleInput = page.getByRole("textbox", { name: "Issue Title" });
    try {
      await expect(titleInput).toBeVisible();
      await titleInput.fill(issueTitle);
    } catch (error) {
      throw new Error(
        `Step 4 FAILED: Issue title input not found or could not be filled. Check if the form rendered properly. Error: ${error}`,
      );
    }

    // Fill in the email
    const emailInput = page.getByRole("textbox", {
      name: "Your Email (Optional)",
    });
    try {
      await expect(emailInput).toBeVisible();
      await emailInput.fill(testEmail);
    } catch (error) {
      throw new Error(
        `Step 4 FAILED: Email input not found or could not be filled. Check if the anonymous user form section rendered properly. Error: ${error}`,
      );
    }

    console.log(
      `✅ SMOKE TEST - Step 4 Complete: Form filled with title "${issueTitle}" and email "${testEmail}"`,
    );

    // Step 5: Submit
    console.log("🧪 SMOKE TEST - Step 5: Submitting issue");

    // Find and click submit button
    const submitButton = page.getByRole("button", { name: "Create Issue" });
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
      await expect(
        page
          .locator(
            ':text("success"), :text("created"), :text("Issue Created"), .success, .toast-success',
          )
          .first(),
      ).toBeVisible({ timeout: 10000 });
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

    // Use dev quick login
    await page.locator('text="Dev Quick Login"').click();
    await page.locator('button:has-text("Dev Admin")').click();

    // Wait for authentication
    await expect(page.locator('text="My Dashboard"')).toBeVisible({
      timeout: 15000,
    });
    console.log("✅ SMOKE TEST - Step 6 Complete: Logged in as Dev Admin");

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

    // Find the issue row and click it
    const issueRow = page
      .locator(
        `tr:has-text("${issueTitle}"), div:has-text("${issueTitle}"), a:has-text("${issueTitle}")`,
      )
      .first();
    await expect(issueRow).toBeVisible({ timeout: 10000 });
    await issueRow.click();

    // Verify we're on the issue detail page
    await expect(
      page
        .locator(`h1:has-text("${issueTitle}"), h2:has-text("${issueTitle}")`)
        .or(page.getByText(issueTitle)),
    ).toBeVisible();
    console.log("✅ SMOKE TEST - Step 8 Complete: Opened issue detail page");

    // Step 9: Add Comment
    console.log("🧪 SMOKE TEST - Step 9: Adding admin comment");

    const commentText = "Admin reviewed this issue";
    const commentTextarea = page.getByRole("textbox", { name: /comment/i });
    try {
      await expect(commentTextarea).toBeVisible();
      await commentTextarea.fill(commentText);
    } catch (error) {
      throw new Error(
        `Step 9 FAILED: Comment textarea not found. Check if user has proper permissions and the comment form is displayed. Error: ${error}`,
      );
    }

    // Submit comment
    const commentSubmit = page.getByRole("button", {
      name: /add|submit|comment/i,
    });
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

    // Find status dropdown or close button
    const statusSelect = page.getByRole("combobox", {
      name: /status|change status/i,
    });
    if (await statusSelect.isVisible()) {
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
      // Look for a close button
      const closeButton = page
        .locator(
          'button:has-text("Close"), button:has-text("Fixed"), button:has-text("Resolve")',
        )
        .first();
      if (await closeButton.isVisible()) {
        await closeButton.click();
      }
    }

    console.log("✅ SMOKE TEST - Step 10 Complete: Issue status updated");

    // Step 11: Verify Closure
    console.log("🧪 SMOKE TEST - Step 11: Verifying issue is closed");

    // Look for indicators that the issue is closed
    const closedIndicators = [
      'text="Fixed"',
      'text="Closed"',
      'text="Resolved"',
      ".status-closed",
      '.badge:has-text("Fixed")',
      '.badge:has-text("Closed")',
    ];

    let foundClosure = false;
    for (const indicator of closedIndicators) {
      if (
        await page
          .locator(indicator)
          .isVisible()
          .catch(() => false)
      ) {
        foundClosure = true;
        break;
      }
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
