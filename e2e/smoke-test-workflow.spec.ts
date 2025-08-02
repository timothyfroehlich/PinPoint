import { test, expect } from "@playwright/test";
import { logout } from "./helpers/unified-dashboard";

/**
 * Complete Issue Workflow Smoke Test
 *
 * Tests the entire user journey from issue creation through admin management.
 * This serves as a comprehensive smoke test to catch major regressions.
 *
 * Designed to be resilient to UI changes and serve as a required GitHub Action check.
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

    // Wait for the form to load and select the first machine
    const machineSelect = page
      .locator('select[name="machineId"], select[name="machine"]')
      .first();
    await expect(machineSelect).toBeVisible({ timeout: 10000 });

    // Get all options and select the first non-empty one
    const options = await machineSelect.locator("option").all();
    let selectedMachine = "";
    for (const option of options) {
      const value = await option.getAttribute("value");
      const text = await option.textContent();
      if (value && value !== "" && text && text.trim() !== "") {
        await machineSelect.selectOption(value);
        selectedMachine = text.trim();
        break;
      }
    }

    expect(selectedMachine).toBeTruthy();
    console.log(
      `✅ SMOKE TEST - Step 3 Complete: Selected machine "${selectedMachine}"`,
    );

    // Step 4: Create Issue
    console.log("🧪 SMOKE TEST - Step 4: Filling issue form");

    // Fill in the issue title
    const titleInput = page
      .locator('input[name="title"], input[placeholder*="title" i]')
      .first();
    await expect(titleInput).toBeVisible();
    await titleInput.fill(issueTitle);

    // Fill in the email
    const emailInput = page
      .locator(
        'input[name="email"], input[type="email"], input[placeholder*="email" i]',
      )
      .first();
    await expect(emailInput).toBeVisible();
    await emailInput.fill(testEmail);

    console.log(
      `✅ SMOKE TEST - Step 4 Complete: Form filled with title "${issueTitle}" and email "${testEmail}"`,
    );

    // Step 5: Submit
    console.log("🧪 SMOKE TEST - Step 5: Submitting issue");

    // Find and click submit button
    const submitButton = page
      .locator(
        'button[type="submit"], button:has-text("Submit"), button:has-text("Create")',
      )
      .first();
    await expect(submitButton).toBeVisible();
    await submitButton.click();

    // Wait for success indication
    await expect(
      page
        .locator(':text("success"), :text("created"), .success, .toast-success')
        .first(),
    ).toBeVisible({ timeout: 10000 });

    console.log(
      "✅ SMOKE TEST - Step 5 Complete: Issue submitted successfully",
    );
    console.log(
      "🎯 SMOKE TEST - MINIMUM THRESHOLD REACHED - Issue creation works!",
    );

    // Step 6: Dev Login
    console.log("🧪 SMOKE TEST - Step 6: Logging in as Test Admin");

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Use dev quick login
    await page.locator('text="Dev Quick Login"').click();
    await page.locator('button:has-text("Test Admin")').click();

    // Wait for authentication
    await expect(page.locator('text="My Dashboard"')).toBeVisible({
      timeout: 15000,
    });
    console.log("✅ SMOKE TEST - Step 6 Complete: Logged in as Test Admin");

    // Step 7: Find Issue
    console.log("🧪 SMOKE TEST - Step 7: Navigating to issues and searching");

    await page.goto("/issues");
    await page.waitForLoadState("networkidle");

    // Search for the issue
    const searchInput = page
      .locator('input[name="search"], input[placeholder*="search" i]')
      .first();
    if (await searchInput.isVisible()) {
      await searchInput.fill("SMOKE-TEST");
      await page.waitForTimeout(1000); // Wait for search to filter
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
      page.locator(
        `h1:has-text("${issueTitle}"), h2:has-text("${issueTitle}"), text="${issueTitle}"`,
      ),
    ).toBeVisible();
    console.log("✅ SMOKE TEST - Step 8 Complete: Opened issue detail page");

    // Step 9: Add Comment
    console.log("🧪 SMOKE TEST - Step 9: Adding admin comment");

    const commentText = "Admin reviewed this issue";
    const commentTextarea = page
      .locator('textarea[name="comment"], textarea[placeholder*="comment" i]')
      .first();
    await expect(commentTextarea).toBeVisible();
    await commentTextarea.fill(commentText);

    // Submit comment
    const commentSubmit = page
      .locator(
        'button:has-text("Add"), button:has-text("Submit"), button:has-text("Comment")',
      )
      .first();
    await commentSubmit.click();

    // Verify comment appears
    await expect(page.locator(`text="${commentText}"`)).toBeVisible({
      timeout: 10000,
    });
    console.log("✅ SMOKE TEST - Step 9 Complete: Comment added and verified");

    // Step 10: Close Issue
    console.log("🧪 SMOKE TEST - Step 10: Closing the issue");

    // Find status dropdown or close button
    const statusSelect = page
      .locator('select[name="status"], select[name="statusId"]')
      .first();
    if (await statusSelect.isVisible()) {
      // Select a closed status (try multiple common names)
      const closedOptions = ["Fixed", "Closed", "Resolved", "Complete"];
      for (const status of closedOptions) {
        const option = statusSelect.locator(`option:has-text("${status}")`);
        if ((await option.count()) > 0) {
          await statusSelect.selectOption({ label: status });
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
