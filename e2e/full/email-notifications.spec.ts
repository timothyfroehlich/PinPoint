import { test, expect } from "@playwright/test";
import { MailpitClient } from "../support/mailpit.js";
import { selectOption } from "../support/actions.js";
import {
  fillReportForm,
  submitFormAndWaitForRedirect,
} from "../support/page-helpers.js";
import { TEST_USERS } from "../support/constants.js";
import { deleteTestIssueByNumber } from "e2e/support/supabase-admin.js";

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
  const cleanupIssues: { initials: string; number: number }[] = [];

  test.afterAll(async () => {
    for (const issue of cleanupIssues) {
      await deleteTestIssueByNumber(issue.initials, issue.number).catch(
        () => undefined
      );
    }
  });

  // Skip this test in Safari due to Next.js Issue #48309
  // Safari fails to process Server Action redirects to dynamic pages
  // This is a known Next.js/WebKit bug, not our application code
  test.skip(
    ({ browserName }) => browserName === "webkit",
    "Next.js Issue #48309: Safari Server Action redirect timing"
  );

  test("should send email when issue is created", async ({ page }) => {
    const timestamp = Date.now();
    const issueTitle = `Test Issue for Email ${timestamp}`;

    // Clear mailbox before test
    mailpit.clearMailbox(TEST_USERS.admin.email);

    // Login as admin
    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_USERS.admin.email);
    await page.getByLabel("Password").fill(TEST_USERS.admin.password);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.getByTestId("quick-stats")).toBeVisible();

    // Create an issue for a specific machine (e.g., MM)
    await page.goto("/report?machine=MM");
    await fillReportForm(page, {
      title: issueTitle,
      description: "Testing email notifications",
    });

    // Submit form and wait for Server Action redirect (Safari-defensive)
    await submitFormAndWaitForRedirect(
      page,
      page.getByRole("button", { name: "Submit Issue Report" }),
      { awayFrom: "/report" }
    );

    // Verify we're on the issue page
    await expect(page).toHaveURL(/\/m\/MM\/i\/[0-9]+/);
    const url = page.url();
    const issueIdMatch = /\/i\/(\d+)/.exec(url);
    const issueId = issueIdMatch?.[1];

    if (issueId) {
      cleanupIssues.push({ initials: "MM", number: parseInt(issueId) });
    }
    // Wait for email to arrive in Mailpit
    const email = await mailpit.waitForEmail(TEST_USERS.admin.email, {
      subjectContains: issueTitle,
      timeout: 30000,
      pollIntervalMs: 750,
    });

    // Verify email was sent
    expect(email).not.toBeNull();
    expect(email?.subject).toContain(issueTitle);
    expect(email?.to).toContain(TEST_USERS.admin.email);
  });

  // Skip this test in Safari due to Next.js Issue #48309
  // Safari fails to process Server Action redirects to dynamic pages
  // This is a known Next.js/WebKit bug, not our application code
  test.skip(
    ({ browserName }) => browserName === "webkit",
    "Next.js Issue #48309: Safari Server Action redirect timing"
  );

  test("should send email when status changes", async ({ page }) => {
    const timestamp = Date.now();
    const issueTitle = `Status Change Test ${timestamp}`;

    // Clear mailbox
    mailpit.clearMailbox(TEST_USERS.admin.email);

    // Login
    await page.goto("/login");
    await page.getByLabel("Email").fill(TEST_USERS.admin.email);
    await page.getByLabel("Password").fill(TEST_USERS.admin.password);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.getByTestId("quick-stats")).toBeVisible();

    // Create issue for a specific machine (e.g., MM)
    await page.goto("/report?machine=MM");
    await fillReportForm(page, { title: issueTitle });

    // Submit form and wait for Server Action redirect (Safari-defensive)
    await submitFormAndWaitForRedirect(
      page,
      page.getByRole("button", { name: "Submit Issue Report" }),
      { awayFrom: "/report" }
    );

    await expect(page).toHaveURL(/\/m\/MM\/i\/[0-9]+/);

    // Ensure we are on the page before interacting with sidebar
    await expect(
      page
        .getByRole("main")
        .getByRole("heading", { level: 1, name: new RegExp(issueTitle) })
    ).toBeVisible();

    // Clear the "new issue" email
    await new Promise((resolve) => setTimeout(resolve, 1000));
    mailpit.clearMailbox(TEST_USERS.admin.email);

    // Update status
    await selectOption(page, "issue-status-select", "in_progress");
    await expect(page.getByTestId("status-update-success")).toBeVisible({
      timeout: 30000,
    });

    const url = page.url();
    const issueIdMatch = /\/i\/(\d+)/.exec(url);
    if (issueIdMatch) {
      cleanupIssues.push({ initials: "MM", number: parseInt(issueIdMatch[1]) });
    }

    // Wait for status change email
    const emailAfterStatusChange = await mailpit.waitForEmail(
      TEST_USERS.admin.email,
      {
        subjectContains: "Status Changed",
        timeout: 30000,
        pollIntervalMs: 750,
      }
    );

    expect(emailAfterStatusChange).not.toBeNull();
    expect(emailAfterStatusChange?.subject).toContain("Status Changed");
    expect(emailAfterStatusChange?.subject).toContain(issueTitle);
  });
});
