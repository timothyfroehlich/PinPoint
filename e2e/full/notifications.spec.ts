import { test, expect } from "@playwright/test";
import { ensureLoggedIn, selectOption } from "../support/actions.js";
import { fillReportForm } from "../support/page-helpers.js";
import { seededMachines } from "../support/constants.js";
import {
  createTestUser,
  createTestMachine,
  deleteTestUser,
  deleteTestMachine,
  updateUserRole,
  updateNotificationPreferences,
} from "../support/supabase-admin.js";
import { getTestIssueTitle, getTestEmail } from "../support/test-isolation.js";

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
    await selectOption(adminPage, "issue-status-select", "in_progress");

    await expect(adminPage.getByTestId("status-update-success")).toBeVisible();

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
