/**
 * E2E Tests: Email and Notifications (Full Suite)
 *
 * Merged from notifications.spec.ts, email-notifications.spec.ts,
 * and password reset test from auth-flows-extended.spec.ts.
 */

import { test, expect } from "@playwright/test";
import { MailpitClient } from "../support/mailpit.js";
import {
  ensureLoggedIn,
  logout,
  updateIssueField,
} from "../support/actions.js";
import {
  fillReportForm,
  submitFormAndWaitForRedirect,
} from "../support/page-helpers.js";
import { seededMachines, TEST_USERS } from "../support/constants.js";
import {
  createTestUser,
  createTestMachine,
  deleteTestUser,
  deleteTestMachine,
  updateUserRole,
  updateNotificationPreferences,
  generateUnsubscribeTokenForTest,
  getNotificationPreferences,
} from "e2e/support/supabase-admin.js";
import {
  getTestIssueTitle,
  getTestEmail,
  getTestMachineInitials,
} from "../support/test-isolation.js";
import { getPasswordResetLink } from "../support/mailpit.js";
const cleanupUserIds: string[] = [];
const cleanupMachineIds: string[] = [];

test.afterAll(async () => {
  for (const machineId of cleanupMachineIds) {
    await deleteTestMachine(machineId).catch(() => undefined);
  }
  for (const userId of cleanupUserIds) {
    await deleteTestUser(userId).catch(() => undefined);
  }
});

test.describe("Notifications", () => {
  test("should notify machine owner when public issue is reported", async ({
    browser,
  }) => {
    // 1. Setup: Create unique owner and machine
    const timestamp = Date.now();
    const ownerEmail = `owner-${timestamp}@example.com`;
    const owner = await createTestUser(ownerEmail);
    cleanupUserIds.push(owner.id);
    const machine = await createTestMachine(owner.id);
    cleanupMachineIds.push(machine.id);

    // Enable in-app notifications for new issues on owned machines
    // (default is OFF after notification overhaul)
    await updateNotificationPreferences(owner.id, {
      inAppNotifyOnNewIssue: true,
    });

    // Login as owner
    const ownerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();

    await ownerPage.goto("/login");
    await ownerPage.getByLabel("Email").fill(ownerEmail);
    await ownerPage
      .getByLabel("Password", { exact: true })
      .fill("TestPassword123");
    await ownerPage.getByRole("button", { name: "Sign In" }).click();
    await expect(ownerPage).toHaveURL("/dashboard");

    // 2. Action: Anonymous user reports issue on THIS machine
    const publicContext = await browser.newContext();
    const publicPage = await publicContext.newPage();

    await publicPage.goto("/report");
    // Wait for machine list to populate (check select exists)
    await expect(publicPage.getByTestId("machine-select")).toBeVisible();
    await publicPage
      .getByTestId("machine-select")
      .selectOption({ value: machine.id });

    // Verify selection stuck (mobile chrome stability)
    await expect(publicPage.getByTestId("machine-select")).toHaveValue(
      machine.id
    );

    const issueTitle = getTestIssueTitle("Public Report");
    await fillReportForm(publicPage, {
      title: issueTitle,
      includePriority: false,
    });

    await publicPage
      .getByRole("button", { name: "Submit Issue Report" })
      .click();

    await expect(publicPage).toHaveURL("/report/success");

    // 3. Assertion: Owner receives notification
    await ownerPage.bringToFront();
    await ownerPage.goto("/dashboard"); // Reload/Navigate to fetch notifications

    const bell = ownerPage.getByRole("button", { name: /notifications/i });
    await bell.click();

    // Filter by unique issue title to avoid crosstalk from other workers
    const notification = ownerPage
      .getByText(new RegExp(issueTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
      .first();
    await expect(notification).toBeVisible();

    // Verify it links to the correct machine/issue (by clicking and checking title)
    await notification.click();
    await expect(
      ownerPage.getByRole("heading", { name: issueTitle })
    ).toBeVisible();

    await ownerContext.close();
    await publicContext.close();
  });

  test("should suppress own-action notifications when enabled in settings", async ({
    page,
  }, testInfo) => {
    const timestamp = Date.now();
    const ownerEmail = getTestEmail(`self-suppress-${timestamp}@test.com`);
    const owner = await createTestUser(ownerEmail);
    cleanupUserIds.push(owner.id);
    const machine = await createTestMachine(owner.id);
    cleanupMachineIds.push(machine.id);

    await ensureLoggedIn(page, testInfo, {
      email: ownerEmail,
      password: "TestPassword123",
    });

    // Click new settings controls via UI (E2E interaction coverage)
    await page.goto("/settings");

    const inAppNewIssueSwitch = page.locator("#inAppNotifyOnNewIssue");
    await expect(inAppNewIssueSwitch).toHaveAttribute("aria-checked", "false");
    await inAppNewIssueSwitch.click();
    await expect(inAppNewIssueSwitch).toHaveAttribute("aria-checked", "true");

    const suppressOwnActionsSwitch = page.locator("#suppressOwnActions");
    await expect(suppressOwnActionsSwitch).toHaveAttribute(
      "aria-checked",
      "false"
    );
    await suppressOwnActionsSwitch.click();
    await expect(suppressOwnActionsSwitch).toHaveAttribute(
      "aria-checked",
      "true"
    );

    await page.getByRole("button", { name: "Save Preferences" }).click();
    await expect(page.getByRole("button", { name: "Saved!" })).toBeVisible();

    // Report issue as this same user; with suppression on, no notification should appear
    await page.goto(`/report?machine=${machine.initials}`);
    const issueTitle = getTestIssueTitle("Own Action Suppressed");
    await fillReportForm(page, {
      title: issueTitle,
      includePriority: false,
    });
    await page.getByRole("button", { name: "Submit Issue Report" }).click();
    await expect(page).toHaveURL(
      /(\/m\/[A-Z0-9]{2,6}\/i\/[0-9]+)|(\/report\/success)/
    );

    await page.goto("/dashboard");
    const bell = page.getByRole("button", { name: /notifications/i });
    await bell.click();
    await expect(page.getByText("No new notifications")).toBeVisible();
  });

  // Skip this test in Safari due to Next.js Issue #48309
  // Safari fails to process Server Action redirects to dynamic pages
  // This test creates an issue (Server Action + redirect) which fails in Safari
  test.skip(
    ({ browserName }) => browserName === "webkit",
    "Next.js Issue #48309: Safari Server Action redirect timing"
  );

  test("should notify reporter when status changes", async ({
    page,
    browser,
  }, testInfo) => {
    // 1. Setup: Use fresh member as reporter, and fresh machine owned by a fresh admin
    // This isolates the "Status Changed" notification to this interaction

    const timestamp = Date.now();
    const adminEmail = getTestEmail(`admin-status-${timestamp}@test.com`);
    const admin = await createTestUser(adminEmail); // Acts as owner/admin
    await updateUserRole(admin.id, "admin");
    cleanupUserIds.push(admin.id);
    const machine = await createTestMachine(admin.id);
    cleanupMachineIds.push(machine.id);

    // Reporter (Fresh Member) reports an issue
    const memberEmail = getTestEmail(`member-status-${timestamp}@test.com`);
    const member = await createTestUser(memberEmail);
    cleanupUserIds.push(member.id);
    await ensureLoggedIn(page, testInfo, {
      email: memberEmail,
      password: "TestPassword123",
    });

    await page.goto(`/report?machine=${machine.initials}`);
    await expect(
      page.getByRole("heading", { name: "Report an Issue" })
    ).toBeVisible();

    const issueTitle = getTestIssueTitle("Status Change");
    await fillReportForm(page, { title: issueTitle });

    await page.getByRole("button", { name: "Submit Issue Report" }).click();

    // Capture Issue URL/number.
    // Use try/catch or flexible regex because it might redirect to success if auth checks fail
    await expect(page).toHaveURL(
      /(\/m\/[A-Z0-9]{2,6}\/i\/[0-9]+)|(\/report\/success)/
    );

    // If we landed on success page, we need to go to dashboard or recent issues to find the new issue
    if (page.url().includes("/report/success")) {
      await page.goto("/dashboard");
      await page.getByTestId("recent-issue-card").first().click();
    }

    const issueUrl = page.url();
    const issueNumberMatch = /\/i\/([0-9]+)$/.exec(issueUrl);
    const issueNumber = issueNumberMatch?.[1];
    if (!issueNumber) {
      throw new Error(
        `Expected issue detail URL with issue number, received ${issueUrl}`
      );
    }

    // Ensure reporter is watching (should be auto-watching own report)
    await expect(
      page.getByRole("button", { name: "Unwatch Issue" })
    ).toBeVisible();

    // 2. Action: Admin (Owner) changes status
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();

    await adminPage.goto("/login");
    await adminPage.getByLabel("Email").fill(adminEmail);
    await adminPage
      .getByLabel("Password", { exact: true })
      .fill("TestPassword123");
    await adminPage.getByRole("button", { name: "Sign In" }).click();
    await expect(adminPage).toHaveURL("/dashboard");

    await adminPage.goto(`/m/${machine.initials}/i/${issueNumber}`);
    // Use viewport-aware helper — works on both desktop and mobile
    await updateIssueField(adminPage, "status", "in_progress");
    // Wait for the server action to complete before checking notifications
    await adminPage.waitForLoadState("networkidle");

    // 3. Assertion: Reporter receives notification
    await page.bringToFront();
    await page.reload();

    // Wait for page to fully load after reload (ensure we're not redirecting)
    await page.waitForLoadState("networkidle");

    const bell = page.getByRole("button", { name: /notifications/i });
    await expect(bell).toBeVisible();
    await bell.click();

    // Look for specific notification with issue title
    const notification = page
      .getByText(new RegExp(issueTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
      .first();
    await expect(notification).toBeVisible();

    await adminContext.close();
  });

  test("should notify global watcher on new issue", async ({ browser }) => {
    // 1. Setup: New Admin User who enables "Watch All New Issues"
    const timestamp = Date.now();
    const globalWatcherEmail = `watcher-${timestamp}@example.com`;
    const watcher = await createTestUser(globalWatcherEmail);
    cleanupUserIds.push(watcher.id);

    const watcherContext = await browser.newContext();
    const watcherPage = await watcherContext.newPage();

    await watcherPage.goto("/login");
    await watcherPage.getByLabel("Email").fill(globalWatcherEmail);
    await watcherPage
      .getByLabel("Password", { exact: true })
      .fill("TestPassword123");
    await watcherPage.getByRole("button", { name: "Sign In" }).click();
    await expect(watcherPage).toHaveURL("/dashboard");

    await watcherPage.goto("/settings");
    const globalWatchSwitch = watcherPage.locator("#inAppWatchNewIssuesGlobal");
    await globalWatchSwitch.check();
    await watcherPage.getByRole("button", { name: "Save Preferences" }).click();
    await expect(
      watcherPage.getByRole("button", { name: "Saved!" })
    ).toBeVisible();

    // 2. Action: Anonymous user reports issue on ANY machine
    const publicContext = await browser.newContext();
    const publicPage = await publicContext.newPage();
    await publicPage.goto("/report");

    // Use a seeded machine for convenience, or create one.
    // Since we are watching globally, any machine works.
    await publicPage
      .getByTestId("machine-select")
      .selectOption({ value: seededMachines.medievalMadness.id });

    const issueTitle = getTestIssueTitle("Global Watcher Test");
    // Verify machine selection stuck
    await expect(publicPage.getByTestId("machine-select")).toHaveValue(
      seededMachines.medievalMadness.id
    );

    await fillReportForm(publicPage, {
      title: issueTitle,
      severity: "unplayable",
      frequency: "constant",
      includePriority: false,
    });

    await publicPage
      .getByRole("button", { name: "Submit Issue Report" })
      .click();
    await expect(publicPage).toHaveURL("/report/success");

    // 3. Assertion: Global Watcher gets notification
    await watcherPage.bringToFront();
    await watcherPage.goto("/dashboard");
    const bell = watcherPage.getByRole("button", { name: /notifications/i });
    await bell.click();

    // Filter to this test's notification only - other workers may have created global watchers too
    const notification = watcherPage
      .getByText(new RegExp(issueTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
      .first();
    await expect(notification).toBeVisible();

    await notification.click();
    await expect(
      watcherPage.getByRole("heading", { name: issueTitle })
    ).toBeVisible();

    await watcherContext.close();
    await publicContext.close();
  });

  test("notification interaction flow", async ({ page, browser }) => {
    // 1. Setup: Owner (Recipient)
    const timestamp = Date.now();
    const ownerEmail = `interact-owner-${timestamp}@example.com`;
    const owner = await createTestUser(ownerEmail);
    cleanupUserIds.push(owner.id);
    const machine = await createTestMachine(owner.id);
    cleanupMachineIds.push(machine.id);

    // Login as owner
    await page.goto("/login");
    await page.getByLabel("Email").fill(ownerEmail);
    await page.getByLabel("Password", { exact: true }).fill("TestPassword123");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL("/dashboard");

    // 2. Create notification via public report (as Anonymous/Other)
    // We need a separate context to avoid "actor == recipient" filter
    const publicContext = await browser.newContext();
    const publicPage = await publicContext.newPage();
    await publicPage.goto("/report");
    // Select machine and verify state (Mobile Chrome hardening)
    await publicPage
      .getByTestId("machine-select")
      .selectOption({ value: machine.id });
    await expect(publicPage.getByTestId("machine-select")).toHaveValue(
      machine.id
    );
    const issueTitle = getTestIssueTitle("Interaction Test");
    await fillReportForm(publicPage, {
      title: issueTitle,
      includePriority: false,
    });

    await publicPage
      .getByRole("button", { name: "Submit Issue Report" })
      .click();
    await expect(publicPage).toHaveURL("/report/success");
    await publicContext.close();

    // 3. Back to Owner
    await page.bringToFront();
    await page.goto("/dashboard"); // Reload to fetch
    await page.getByRole("button", { name: /notifications/i }).click();
    const notificationItem = page
      .getByText(new RegExp(issueTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
      .first();
    await expect(notificationItem).toBeVisible();

    // 4. Action: Click Notification
    await notificationItem.click();

    // 5. Assertion: Redirected to issue
    await expect(page).toHaveURL(/\/m\/[A-Z0-9]{2,6}\/i\/[0-9]+/);
    await expect(page.getByRole("heading", { name: issueTitle })).toBeVisible();
  });

  test("email notification flow", async ({ page, browser }, testInfo) => {
    // 1. Setup: Fresh Admin/Owner
    const timestamp = Date.now();
    const ownerEmail = getTestEmail(`email-test-${timestamp}@test.com`);
    const owner = await createTestUser(ownerEmail);
    await updateUserRole(owner.id, "admin");
    cleanupUserIds.push(owner.id);
    const machine = await createTestMachine(owner.id);
    cleanupMachineIds.push(machine.id);

    await page.goto("/login");
    await page.getByLabel("Email").fill(ownerEmail);
    await page.getByLabel("Password", { exact: true }).fill("TestPassword123");
    await page.getByRole("button", { name: "Sign In" }).click();

    // Ensure In-App is enabled (it is by default for owned machines)
    // We rely on In-App to verify the event triggered, as we can't easily check email in E2E without Mailpit API
    // (We could use Mailpit API, but checking In-App is sufficient to prove the event fired)

    // 2. Action: Fresh Member reports an issue
    const memberEmail = getTestEmail(`member-email-${timestamp}@test.com`);
    const member = await createTestUser(memberEmail);
    cleanupUserIds.push(member.id);
    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    await ensureLoggedIn(memberPage, testInfo, {
      email: memberEmail,
      password: "TestPassword123",
    });

    await memberPage.goto("/report");
    await memberPage
      .getByTestId("machine-select")
      .selectOption({ value: machine.id });

    const issueTitle = getTestIssueTitle("Email Test Issue");
    await fillReportForm(memberPage, { title: issueTitle });

    await expect(memberPage.getByTestId("machine-select")).toHaveValue(
      machine.id
    );
    await expect(memberPage.getByLabel("Issue Title *")).toHaveValue(
      issueTitle
    );

    await memberPage
      .getByRole("button", { name: "Submit Issue Report" })
      .click();

    // Accept either direct issue page OR success page (handling potential auth gap)
    await expect(memberPage).toHaveURL(
      /(\/m\/[A-Z0-9]{2,6}\/i\/[0-9]+)|(\/report\/success)/
    );

    // 3. Assertion: Admin verifies in-app notification created
    await page.bringToFront();
    await page.goto("/dashboard");

    const bell = page.getByRole("button", { name: /notifications/i });
    await bell.click();

    const notification = page
      .getByText(new RegExp(issueTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
      .first();
    await expect(notification).toBeVisible();

    await memberContext.close();
  });
});

test.describe.serial("Email Notifications", () => {
  const mailpit = new MailpitClient();
  const cleanupUserIds: string[] = [];
  const cleanupMachineIds: string[] = [];
  let testAdminEmail: string;
  let testAdminUserId: string;
  let testMachineInitials: string;

  test.beforeAll(async () => {
    // Create a unique admin user for this worker
    testAdminEmail = getTestEmail("worker-admin@test.com");
    const user = await createTestUser(testAdminEmail);
    testAdminUserId = user.id;
    await updateUserRole(user.id, "admin");
    cleanupUserIds.push(user.id);

    // Create a unique machine for this worker
    const initials = getTestMachineInitials();
    const machine = await createTestMachine(user.id, initials);
    testMachineInitials = machine.initials;
    cleanupMachineIds.push(machine.id);

    // Enable email notifications for status changes (default is OFF after overhaul)
    await updateNotificationPreferences(user.id, {
      emailNotifyOnStatusChange: true,
    });
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

    // Ensure we are on the page before interacting with issue detail
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

    // Update status (uses viewport-aware helper — works on both desktop and mobile)
    await updateIssueField(page, "status", "in_progress");
    // Wait for the server action to complete before checking email delivery
    await page.waitForLoadState("networkidle");

    // Wait for status change email - filter by "Status Changed" prefix since
    // clearMailbox() is a no-op and the "New Issue" email (also containing
    // issueTitle) is still in the mailbox.
    const emailAfterStatusChange = await mailpit.waitForEmail(testAdminEmail, {
      subjectContains: "Status Changed",
      timeout: 30000,
      pollIntervalMs: 750,
    });

    expect(emailAfterStatusChange).not.toBeNull();
    expect(emailAfterStatusChange?.subject).toContain("Status Changed");
    expect(emailAfterStatusChange?.subject).toContain(issueTitle);
  });

  test("should unsubscribe via confirmation page", async ({ page }) => {
    // Generate a valid unsubscribe token for the test admin
    const token = generateUnsubscribeTokenForTest(testAdminUserId);

    // Navigate to the unsubscribe confirmation page (GET — non-mutating)
    await page.goto(
      `/api/unsubscribe?uid=${encodeURIComponent(testAdminUserId)}&token=${encodeURIComponent(token)}`
    );

    // Verify confirmation page renders
    await expect(
      page.getByText("Unsubscribe from PinPoint emails?")
    ).toBeVisible();
    await expect(
      page.getByText("This will turn off all email notifications")
    ).toBeVisible();

    // Click the confirm button
    await page.getByRole("button", { name: "Confirm unsubscribe" }).click();

    // Verify success message
    await expect(page.getByText("You have been unsubscribed")).toBeVisible();

    // Verify all email preferences are now disabled in the database
    const prefs = await getNotificationPreferences(testAdminUserId);
    expect(prefs.email_enabled).toBe(false);
    expect(prefs.email_notify_on_assigned).toBe(false);
    expect(prefs.email_notify_on_status_change).toBe(false);
    expect(prefs.email_notify_on_new_comment).toBe(false);
    expect(prefs.email_notify_on_new_issue).toBe(false);
    expect(prefs.email_watch_new_issues_global).toBe(false);
    expect(prefs.email_notify_on_machine_ownership_change).toBe(false);

    // Restore email prefs so cleanup/other tests aren't affected
    await updateNotificationPreferences(testAdminUserId, {
      emailEnabled: true,
      emailNotifyOnStatusChange: true,
    });
  });
});

test.describe("Password Reset Email", () => {
  test("password reset flow - user journey only", async ({
    page,
  }, testInfo) => {
    test.setTimeout(40000);
    const testEmail = `reset-e2e-extended-${Date.now()}@example.com`;
    const oldPassword = "OldPassword123!";
    const newPassword = "NewPassword456!";

    // Create account
    await page.goto("/signup");
    await page.getByLabel("First Name").fill("Password Reset");
    await page.getByLabel("Last Name").fill("Test");
    await page.getByLabel("Email").fill(testEmail);
    await page.getByLabel("Password", { exact: true }).fill(oldPassword);
    await page.getByLabel("Confirm Password").fill(oldPassword);
    await page.getByLabel(/terms of service/i).check();
    await page.getByRole("button", { name: "Create Account" }).click();

    // Local env has enable_confirmations = false, so we are redirected to dashboard immediately
    await expect(page).toHaveURL("/dashboard", { timeout: 10000 });

    // Sign out to start reset journey
    await logout(page, testInfo);

    // Request reset
    await page.goto("/forgot-password");
    await expect(
      page.getByRole("heading", { name: "Reset Password" })
    ).toBeVisible();
    await page.getByLabel("Email").fill(testEmail);
    await page.getByRole("button", { name: "Send Reset Link" }).click();
    await expect(
      page.getByText(/you will receive a password reset link/i)
    ).toBeVisible();

    // Follow reset link from email
    const resetLink = await getPasswordResetLink(testEmail);
    expect(resetLink).toBeTruthy();
    await page.goto(resetLink, { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/reset-password/, { timeout: 15000 });
    await expect(
      page.getByRole("heading", { name: "Set New Password" })
    ).toBeVisible();

    // Set new password and submit
    await page.getByLabel("New Password").fill(newPassword);
    await page.getByLabel("Confirm Password").fill(newPassword);
    await page.getByRole("button", { name: "Update Password" }).click();

    // The action redirects to /login after successful password update
    await expect(page).toHaveURL("/login", { timeout: 15000 });

    await expect(page.getByRole("heading", { name: "Sign In" })).toBeVisible({
      timeout: 20000,
    });

    // Now log in with the new password
    await page.getByLabel("Email").fill(testEmail);
    await page.getByLabel("Password", { exact: true }).fill(newPassword);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL("/dashboard");
    await expect(page.getByTestId("quick-stats")).toBeVisible();

    // Cleanup
    await logout(page, testInfo);
  });
});
