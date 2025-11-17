/**
 * E2E Tests for Public Issue Reporting
 *
 * Tests anonymous/public issue reporting flow (no authentication required).
 * Requires Supabase to be running.
 */

import { test, expect } from "@playwright/test";
import { cleanupTestEntities, extractIdFromUrl } from "../support/cleanup";

const createdIssueIds = new Set<string>();

const rememberIssueId = (url: string): void => {
  const issueId = extractIdFromUrl(url);
  if (issueId) {
    createdIssueIds.add(issueId);
  }
};

test.describe("Public Issue Reporting (Unauthenticated)", () => {
  test.afterEach(async ({ request }) => {
    if (!createdIssueIds.size) {
      return;
    }
    await cleanupTestEntities(request, {
      issueIds: Array.from(createdIssueIds),
    });
    createdIssueIds.clear();
  });

  test("should allow anonymous user to report issue from home page", async ({
    page,
  }) => {
    // Start on home page (unauthenticated)
    await page.goto("/");
    await expect(page).toHaveURL("/");

    // Should see "Report an Issue" button
    await expect(page.getByRole("link", { name: "Report an Issue" })).toBeVisible();

    // Click "Report an Issue" button
    await page.getByRole("link", { name: "Report an Issue" }).click();

    // Should navigate to /report
    await expect(page).toHaveURL("/report");
    await expect(
      page.getByRole("heading", {
        name: "Report an Issue with a Pinball Machine",
      })
    ).toBeVisible();
  });

  test("should report issue anonymously (no name provided)", async ({
    page,
  }) => {
    // Navigate to public report page
    await page.goto("/report");

    // Don't fill in reporter name (test anonymous reporting)
    // Select first machine
    await page.getByLabel("Machine *").selectOption({ index: 1 });

    // Fill in issue details
    await page
      .getByLabel("Issue Title *")
      .fill("Public Report - Broken flipper");
    await page
      .getByLabel("Description (optional)")
      .fill("Left flipper is not responding");
    await page.getByLabel("Severity *").selectOption("playable");

    // Submit
    await page.getByRole("button", { name: "Submit Issue Report" }).click();

    // Should redirect to success page
    await expect(page).toHaveURL("/report/success");
    await expect(
      page.getByRole("heading", {
        name: "Thank You for Reporting This Issue!",
      })
    ).toBeVisible();
    await expect(
      page.getByText("Our team has been notified and will address it")
    ).toBeVisible();
  });

  test("should report issue with reporter name", async ({ page, request }) => {
    // Navigate to public report page
    await page.goto("/report");

    // Fill in reporter name
    await page.getByLabel("Your Name (optional)").fill("Public User");

    // Select first machine
    await page.getByLabel("Machine *").selectOption({ index: 1 });

    // Fill in issue details
    await page.getByLabel("Issue Title *").fill("Display not working");
    await page
      .getByLabel("Description (optional)")
      .fill("Score display is blank");
    await page.getByLabel("Severity *").selectOption("unplayable");

    // Submit
    await page.getByRole("button", { name: "Submit Issue Report" }).click();

    // Should redirect to success page
    await expect(page).toHaveURL("/report/success");

    // Note: We can't easily verify the issue was created with the name in E2E
    // without authenticating, but integration tests cover this.
    // The success page proves submission worked.
  });

  test("should validate required fields", async ({ page }) => {
    await page.goto("/report");

    // Try to submit without filling in title
    await page.getByLabel("Machine *").selectOption({ index: 1 });
    // Don't fill title
    await page.getByRole("button", { name: "Submit Issue Report" }).click();

    // Should not navigate away (HTML5 validation)
    await expect(page).toHaveURL("/report");
  });

  test("should allow reporting another issue from success page", async ({
    page,
  }) => {
    // Navigate to success page directly (simulate completion)
    await page.goto("/report/success");

    // Should see "Report Another Issue" button
    await expect(
      page.getByRole("link", { name: "Report Another Issue" })
    ).toBeVisible();

    // Click it
    await page.getByRole("link", { name: "Report Another Issue" }).click();

    // Should navigate back to /report
    await expect(page).toHaveURL("/report");
    await expect(
      page.getByRole("heading", {
        name: "Report an Issue with a Pinball Machine",
      })
    ).toBeVisible();
  });

  test("should allow returning home from success page", async ({ page }) => {
    await page.goto("/report/success");

    // Should see "Return Home" button
    await expect(page.getByRole("link", { name: "Return Home" })).toBeVisible();

    // Click it
    await page.getByRole("link", { name: "Return Home" }).click();

    // Should navigate to home page
    await expect(page).toHaveURL("/");
  });

  test("should display error message for invalid submission", async ({
    page,
  }) => {
    // This test would require triggering a server-side validation error
    // For now, we can test that the error display mechanism works
    await page.goto("/report?error=Test+error+message");

    // Should display the error
    await expect(page.getByText("Test error message")).toBeVisible();
  });

  test("should show navigation bar with sign in/up links", async ({ page }) => {
    await page.goto("/report");

    // Should see navigation with unauthenticated state
    await expect(page.getByTestId("nav-signin")).toBeVisible();
    await expect(page.getByTestId("nav-signup")).toBeVisible();

    // Should not see authenticated navigation
    await expect(
      page.getByRole("link", { name: "Issues" })
    ).not.toBeVisible();
  });
});
