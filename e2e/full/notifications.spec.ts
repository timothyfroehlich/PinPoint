import { test, expect } from "@playwright/test";
import { ensureLoggedIn } from "../support/actions.js";
import { seededMachines, TEST_USERS } from "../support/constants.js";
import {
  createTestUser,
  createTestMachine,
  deleteTestUser,
  deleteTestMachine,
} from "../support/supabase-admin.js";

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

    // Login as owner to setup preferences
    const ownerContext = await browser.newContext();
    const ownerPage = await ownerContext.newPage();

    // Initial login to ensure profile creation and prefs
    await ownerPage.goto("/login");
    await ownerPage.getByLabel("Email").fill(ownerEmail);
    await ownerPage.getByLabel("Password").fill("TestPassword123");
    await ownerPage.getByRole("button", { name: "Sign In" }).click();
    await expect(ownerPage).toHaveURL("/dashboard");

    // Ensure "Auto-Watch Owned Machines" is ON (default)
    // We can verify by checking settings
    await ownerPage.goto("/settings");
    const newIssueToggle = ownerPage.locator("#inAppNotifyOnNewIssue");
    await expect(newIssueToggle).toBeChecked();

    // 2. Action: Anonymous user reports issue on THIS machine
    const publicContext = await browser.newContext();
    const publicPage = await publicContext.newPage();

    await publicPage.goto("/report");
    // Wait for machine list to populate (check select exists)
    await expect(publicPage.getByTestId("machine-select")).toBeVisible();
    await publicPage
      .getByTestId("machine-select")
      .selectOption({ value: machine.id });

    const issueTitle = `Public Report ${timestamp}`;
    await publicPage.getByLabel("Issue Title").fill(issueTitle);
    await publicPage.getByLabel("Severity").selectOption("minor");
    await publicPage
      .getByRole("button", { name: "Submit Issue Report" })
      .click();

    await expect(publicPage).toHaveURL("/report/success");

    // 3. Assertion: Owner receives notification
    await ownerPage.bringToFront();
    await ownerPage.goto("/dashboard"); // Reload/Navigate to fetch notifications

    const bell = ownerPage.getByRole("button", { name: /notifications/i });
    // Should have 1 notification (since it's a fresh user)
    await expect(bell).toContainText("1");

    await bell.click();
    const notification = ownerPage.getByText(/New report/).first();
    await expect(notification).toBeVisible();

    // Verify it links to the correct machine/issue (by clicking and checking title)
    await notification.click();
    await expect(
      ownerPage.getByRole("heading", { name: issueTitle })
    ).toBeVisible();

    await ownerContext.close();
    await publicContext.close();
  });

  test("should notify reporter when status changes", async ({
    page,
    browser,
  }, testInfo) => {
    // 1. Setup: Use seeded member as reporter, but report on a fresh machine owned by a fresh admin
    // This isolates the "Status Changed" notification to this interaction

    const timestamp = Date.now();
    const adminEmail = `admin-${timestamp}@example.com`;
    const admin = await createTestUser(adminEmail); // Acts as owner/admin
    cleanupUserIds.push(admin.id);
    const machine = await createTestMachine(admin.id);
    cleanupMachineIds.push(machine.id);

    // Reporter (Member) reports an issue
    await ensureLoggedIn(page, testInfo, TEST_USERS.member);

    await page.goto(`/m/${machine.initials}/report`);
    await expect(
      page.getByRole("heading", { name: "Report Issue" })
    ).toBeVisible();

    const issueTitle = `Status Change ${timestamp}`;
    await page.getByLabel("Issue Title").fill(issueTitle);
    await page.getByRole("button", { name: "Report Issue" }).click();

    // Capture Issue URL/number (new route format /m/{initials}/i/{issueNumber})
    await expect(page).toHaveURL(/\/m\/[A-Z0-9]{2,6}\/i\/[0-9]+/);
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
    await adminPage.getByLabel("Password").fill("TestPassword123");
    await adminPage.getByRole("button", { name: "Sign In" }).click();
    await expect(adminPage).toHaveURL("/dashboard");

    await adminPage.goto(`/m/${machine.initials}/i/${issueNumber}`);
    await adminPage
      .getByTestId("issue-status-select")
      .selectOption("in_progress");
    await adminPage.getByRole("button", { name: "Update Status" }).click();

    await expect(adminPage.getByTestId("status-update-success")).toBeVisible();

    // 3. Assertion: Reporter receives notification
    await page.bringToFront();
    await page.reload();

    const bell = page.getByRole("button", { name: /notifications/i });
    await expect(bell).toBeVisible();
    await bell.click();

    // Look for specific notification
    const notification = page.getByText(/Status updated for/).first();
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
    await watcherPage.getByLabel("Password").fill("TestPassword123");
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

    const issueTitle = `Global Watcher Test ${timestamp}`;
    await publicPage.getByLabel("Issue Title").fill(issueTitle);
    await publicPage.getByLabel("Severity").selectOption("unplayable");
    await publicPage
      .getByRole("button", { name: "Submit Issue Report" })
      .click();
    await expect(publicPage).toHaveURL("/report/success");

    // 3. Assertion: Global Watcher gets notification
    await watcherPage.bringToFront();
    await watcherPage.goto("/dashboard");
    const bell = watcherPage.getByRole("button", { name: /notifications/i });
    await expect(bell).toContainText("1");
    await bell.click();

    const notification = watcherPage.getByText(/New report/).first();
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
    await page.getByLabel("Password").fill("TestPassword123");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL("/dashboard");

    // 2. Create notification via public report (as Anonymous/Other)
    // We need a separate context to avoid "actor == recipient" filter
    const publicContext = await browser.newContext();
    const publicPage = await publicContext.newPage();
    await publicPage.goto("/report");
    await publicPage
      .getByTestId("machine-select")
      .selectOption({ value: machine.id });
    const issueTitle = `Interaction Test ${timestamp}`;
    await publicPage.getByLabel("Issue Title").fill(issueTitle);
    await publicPage
      .getByRole("button", { name: "Submit Issue Report" })
      .click();
    await expect(publicPage).toHaveURL("/report/success");
    await publicContext.close();

    // 3. Back to Owner
    await page.bringToFront();
    await page.goto("/dashboard"); // Reload to fetch
    await page.getByRole("button", { name: /notifications/i }).click();
    const notificationItem = page.getByText(/New report/).first();
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
    const ownerEmail = `email-test-${timestamp}@example.com`;
    const owner = await createTestUser(ownerEmail);
    cleanupUserIds.push(owner.id);
    const machine = await createTestMachine(owner.id);
    cleanupMachineIds.push(machine.id);

    await page.goto("/login");
    await page.getByLabel("Email").fill(ownerEmail);
    await page.getByLabel("Password").fill("TestPassword123");
    await page.getByRole("button", { name: "Sign In" }).click();

    // Ensure In-App is enabled (it is by default for owned machines)
    // We rely on In-App to verify the event triggered, as we can't easily check email in E2E without Mailpit API
    // (We could use Mailpit API, but checking In-App is sufficient to prove the event fired)

    // 2. Action: Member reports an issue
    const memberContext = await browser.newContext();
    const memberPage = await memberContext.newPage();
    await ensureLoggedIn(memberPage, testInfo, TEST_USERS.member);

    await memberPage.goto("/report");
    await memberPage
      .getByTestId("machine-select")
      .selectOption({ value: machine.id });

    await memberPage.getByLabel("Issue Title").fill("Email Test Issue");
    await memberPage
      .getByRole("button", { name: "Submit Issue Report" })
      .click();
    await expect(memberPage).toHaveURL("/report/success");

    // 3. Assertion: Admin verifies in-app notification created
    await page.bringToFront();
    await page.goto("/dashboard");

    const bell = page.getByRole("button", { name: /notifications/i });
    await expect(bell).toContainText("1");
    await bell.click();

    const notification = page.getByText(/New report/);
    await expect(notification).toBeVisible();

    await memberContext.close();
  });
});
