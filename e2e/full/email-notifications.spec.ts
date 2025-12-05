import { test, expect } from "@playwright/test";
import { MailpitClient } from "../support/mailpit";
import { TEST_USERS } from "../support/constants";

/**
 * Email notification verification tests
 *
 * These tests verify that emails are actually sent via SMTP (Mailpit)
 * and can be retrieved for verification.
 *
 * Requires:
 * - Supabase running (includes Mailpit)
 * - EMAIL_TRANSPORT=smtp in .env.local
 */

test.describe("Email Notifications", () => {
  const mailpit = new MailpitClient();

  test("should send email when issue is created", async ({ page }) => {
    // Clear mailbox before test
    await mailpit.clearMailbox(TEST_USERS.admin.email);

    // Login as admin
    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_USERS.admin.email);
    await page.getByLabel("Password").fill(TEST_USERS.admin.password);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(
      page.getByRole("heading", { name: "Dashboard", exact: true })
    ).toBeVisible();

    // Create an issue for a specific machine (e.g., MM)
    await page.goto("/m/MM/report");
    await page.getByLabel("Title").fill("Test Issue for Email");
    await page.getByLabel("Description").fill("Testing email notifications");
    await page.getByLabel("Severity").selectOption("playable");
    await page.getByRole("button", { name: "Report Issue" }).click();

    // Wait for redirect to issue page (new URL format)
    await expect(page).toHaveURL(/\/m\/MM\/i\/[0-9]+/);

    // Wait for email to arrive in Mailpit
    const email = await mailpit.waitForEmail(TEST_USERS.admin.email, {
      subjectContains: "Test Issue for Email",
      timeout: 20000,
      pollIntervalMs: 750,
    });

    // Verify email was sent
    expect(email).not.toBeNull();
    expect(email?.subject).toContain("Test Issue for Email");
    expect(email?.to).toContain(TEST_USERS.admin.email);
  });

  test("should send email when status changes", async ({ page }) => {
    // Clear mailbox
    await mailpit.clearMailbox(TEST_USERS.admin.email);

    // Login
    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_USERS.admin.email);
    await page.getByLabel("Password").fill(TEST_USERS.admin.password);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(
      page.getByRole("heading", { name: "Dashboard", exact: true })
    ).toBeVisible();

    // Create issue for a specific machine (e.g., MM)
    await page.goto("/m/MM/report");
    await page.getByLabel("Title").fill("Status Change Test");
    await page.getByRole("button", { name: "Report Issue" }).click();
    await expect(page).toHaveURL(/\/m\/MM\/i\/[0-9]+/);

    // Ensure we are on the page before interacting with sidebar
    await expect(
      page
        .getByRole("main")
        .getByRole("heading", { level: 1, name: /Status Change Test/ })
    ).toBeVisible();

    // Clear the "new issue" email
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await mailpit.clearMailbox(TEST_USERS.admin.email);

    // Update status
    await page.getByTestId("issue-status-select").selectOption("in_progress");
    await page.getByRole("button", { name: "Update Status" }).click();
    await expect(page.getByTestId("status-update-success")).toBeVisible();

    // Wait for status change email
    const email = await mailpit.waitForEmail(TEST_USERS.admin.email, {
      subjectContains: "Status Changed",
      timeout: 20000,
      pollIntervalMs: 750,
    });

    expect(email).not.toBeNull();
    expect(email?.subject).toContain("Status Changed");
  });
});
