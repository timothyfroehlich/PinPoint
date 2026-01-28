import { test, expect } from "@playwright/test";
import { MailpitClient } from "../support/mailpit.js";
import { selectOption, ensureLoggedIn } from "../support/actions.js";
import {
  fillReportForm,
  submitFormAndWaitForRedirect,
} from "../support/page-helpers.js";
import { TEST_USERS } from "../support/constants.js";
import {
  deleteTestUser,
  deleteTestMachine,
  createTestUser,
  createTestMachine,
  updateUserRole,
} from "e2e/support/supabase-admin.js";
import {
  getTestIssueTitle,
  getTestEmail,
  getTestMachineInitials,
} from "../support/test-isolation.js";

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

test.describe.serial("Email Notifications", () => {
  const mailpit = new MailpitClient();
  const cleanupUserIds: string[] = [];
  const cleanupMachineIds: string[] = [];
  let testAdminEmail: string;
  let testMachineInitials: string;

  test.beforeAll(async () => {
    // Create a unique admin user for this worker
    testAdminEmail = getTestEmail("worker-admin@test.com");
    const user = await createTestUser(testAdminEmail);
    await updateUserRole(user.id, "admin");
    cleanupUserIds.push(user.id);

    // Create a unique machine for this worker
    const initials = getTestMachineInitials();
    const machine = await createTestMachine(user.id, initials);
    testMachineInitials = machine.initials;
    cleanupMachineIds.push(machine.id);
  });

  test.afterAll(async () => {
    for (const machineId of cleanupMachineIds) {
      await deleteTestMachine(machineId).catch(() => undefined);
    }
    for (const userId of cleanupUserIds) {
      await deleteTestUser(userId).catch(() => undefined);
    }
  });

  // Skip this test in Safari due to Next.js Issue #48309
  // Safari fails to process Server Action redirects to dynamic pages
  // This is a known Next.js/WebKit bug, not our application code
  test.skip(
    ({ browserName }) => browserName === "webkit",
    "Next.js Issue #48309: Safari Server Action redirect timing"
  );

  test("should send email when issue is created", async ({
    page,
  }, testInfo) => {
    const issueTitle = getTestIssueTitle("Test Issue for Email");

    // Clear mailbox before test
    mailpit.clearMailbox(testAdminEmail);

    // Login as unique test admin
    await ensureLoggedIn(page, testInfo, {
      email: testAdminEmail,
      password: TEST_USERS.admin.password,
    });

    // Create an issue for the unique machine
    await page.goto(`/report?machine=${testMachineInitials}`);
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

    // Verify we're on the issue page (or success page + navigation)
    // Worker isolation should prevent /report/success, but we keep the fallback for robustness
    const issueUrlPattern = new RegExp(
      `\\/m\\/${testMachineInitials}\\/i\\/[0-9]+`
    );
    await expect(page).toHaveURL(
      new RegExp(`(${issueUrlPattern.source})|(\\/report\\/success)`)
    );

    if (page.url().includes("/report/success")) {
      await page.goto("/dashboard");
      await page
        .getByTestId("recent-issue-card")
        .filter({ hasText: issueTitle })
        .first()
        .click();
    }

    await expect(page).toHaveURL(issueUrlPattern);

    // Wait for email to arrive in Mailpit
    const email = await mailpit.waitForEmail(testAdminEmail, {
      subjectContains: issueTitle,
      timeout: 30000,
      pollIntervalMs: 750,
    });

    // Verify email was sent
    expect(email).not.toBeNull();
    expect(email?.subject).toContain(issueTitle);
    expect(email?.to).toContain(testAdminEmail);
  });

  // Skip this test in Safari due to Next.js Issue #48309
  // Safari fails to process Server Action redirects to dynamic pages
  // This is a known Next.js/WebKit bug, not our application code
  test.skip(
    ({ browserName }) => browserName === "webkit",
    "Next.js Issue #48309: Safari Server Action redirect timing"
  );

  test("should send email when status changes", async ({ page }, testInfo) => {
    const issueTitle = getTestIssueTitle("Status Change Test");

    // Clear mailbox
    mailpit.clearMailbox(testAdminEmail);

    // Login
    await ensureLoggedIn(page, testInfo, {
      email: testAdminEmail,
      password: TEST_USERS.admin.password,
    });

    // Create issue for the unique machine
    await page.goto(`/report?machine=${testMachineInitials}`);
    await fillReportForm(page, { title: issueTitle });

    // Submit form and wait for Server Action redirect (Safari-defensive)
    await submitFormAndWaitForRedirect(
      page,
      page.getByRole("button", { name: "Submit Issue Report" }),
      { awayFrom: "/report" }
    );

    // Accept either direct issue page OR success page
    const issueUrlPattern = new RegExp(
      `\\/m\\/${testMachineInitials}\\/i\\/[0-9]+`
    );
    await expect(page).toHaveURL(
      new RegExp(`(${issueUrlPattern.source})|(\\/report\\/success)`)
    );

    // If we landed on success page, we need to go to dashboard or recent issues to find the new issue
    if (page.url().includes("/report/success")) {
      await page.goto("/dashboard");
      await page
        .getByTestId("recent-issue-card")
        .filter({ hasText: issueTitle })
        .first()
        .click();
    }

    await expect(page).toHaveURL(issueUrlPattern);

    // Ensure we are on the page before interacting with sidebar
    const titlePattern = issueTitle
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\s+/g, "\\s+");
    await expect(
      page
        .getByRole("main")
        .getByRole("heading", { level: 1, name: new RegExp(titlePattern) })
    ).toBeVisible();

    // Clear the "new issue" email
    await new Promise((resolve) => setTimeout(resolve, 1000));
    mailpit.clearMailbox(testAdminEmail);

    // Update status
    await selectOption(page, "issue-status-select", "in_progress");
    // Ensure revalidation is complete before checking for success message
    await page.waitForLoadState("networkidle");
    await expect(page.getByTestId("status-update-success")).toBeVisible({
      timeout: 30000,
    });

    // Wait for status change email - use unique issue title to avoid crosstalk
    const emailAfterStatusChange = await mailpit.waitForEmail(testAdminEmail, {
      subjectContains: issueTitle,
      timeout: 30000,
      pollIntervalMs: 750,
    });

    expect(emailAfterStatusChange).not.toBeNull();
    expect(emailAfterStatusChange?.subject).toContain("Status Changed");
    expect(emailAfterStatusChange?.subject).toContain(issueTitle);
  });
});
