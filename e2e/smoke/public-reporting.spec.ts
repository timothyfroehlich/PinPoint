/**
 * E2E Tests for Public Issue Reporting
 *
 * Covers anonymous reporting workflow.
 */

import { test, expect } from "@playwright/test";
import { cleanupTestEntities } from "../support/cleanup";
import { fillReportForm } from "../support/page-helpers";
import { loginAs } from "../support/actions";
import { TEST_USERS } from "../support/constants";

const PUBLIC_PREFIX = "E2E Public Report";

test.describe("Public Issue Reporting", () => {
  test.afterEach(async ({ request }) => {
    await cleanupTestEntities(request, {
      issueTitlePrefix: PUBLIC_PREFIX,
    });
  });

  test("should submit anonymous issue and show confirmation", async ({
    page,
  }) => {
    await page.goto("/report");
    await expect(
      page.getByRole("heading", {
        name: "Report an Issue",
      })
    ).toBeVisible();

    const select = page.getByTestId("machine-select");
    await expect(select).toBeVisible();
    await select.selectOption({ index: 1 });
    // Wait for URL refresh (router.push) to prevent race conditions on Mobile Safari
    await expect(page).toHaveURL(/machine=/);

    const issueTitle = `${PUBLIC_PREFIX} ${Date.now()}`;
    await fillReportForm(page, {
      title: issueTitle,
      description: "Playfield gets stuck during multiball.",
      includePriority: false,
    });
    await page.getByRole("button", { name: "Submit Issue Report" }).click();

    await expect(page).toHaveURL("/report/success");
    await expect(
      page.getByRole("heading", {
        name: "Issue Sent!",
      })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Report Another Issue" })
    ).toBeVisible();
  });

  test("should show signup prompt when anonymous user provides email", async ({
    page,
  }) => {
    const timestamp = Date.now();
    const email = `newuser-${timestamp}@example.com`;

    await page.goto("/report");
    await page.getByTestId("machine-select").selectOption({ index: 1 });
    // Wait for URL refresh (router.push) to prevent race conditions on Mobile Safari
    await expect(page).toHaveURL(/machine=/);

    await fillReportForm(page, {
      title: `${PUBLIC_PREFIX} with Email`,
      includePriority: false,
    });

    await page.getByLabel("First Name").fill("Test");
    await page.getByLabel("Last Name").fill("User");
    await page.getByLabel("Email Address").fill(email);

    await page.getByRole("button", { name: "Submit Issue Report" }).click();

    await expect(page).toHaveURL(/\/report\/success/);
    await expect(page.getByText("Want to track your reports?")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Join PinPoint" })
    ).toBeVisible();
  });

  test("should pre-fill name on signup when provided without email", async ({
    page,
  }) => {
    await page.goto("/report");
    await page.getByTestId("machine-select").selectOption({ index: 1 });
    // Wait for URL refresh (router.push) to prevent race conditions on Mobile Safari
    await expect(page).toHaveURL(/machine=/);

    await fillReportForm(page, {
      title: `${PUBLIC_PREFIX} with Name Only`,
      includePriority: false,
    });

    // Provide name but no email
    await page.getByLabel("First Name").fill("Jane");
    await page.getByLabel("Last Name").fill("Reporter");

    await page.getByRole("button", { name: "Submit Issue Report" }).click();

    // Should redirect to success page with new_pending flag
    await expect(page).toHaveURL(/\/report\/success/);
    await expect(page.getByText("Want to track your reports?")).toBeVisible();

    // Click the signup link
    await page.getByRole("link", { name: "Join PinPoint" }).click();

    // Should redirect to signup page with name pre-filled
    await expect(page).toHaveURL(/\/signup\?/);
    await expect(page.getByLabel(/First Name/i)).toHaveValue("Jane");
    await expect(page.getByLabel(/Last Name/i)).toHaveValue("Reporter");
  });

  test("should pre-fill name and email on signup when both provided", async ({
    page,
  }) => {
    const timestamp = Date.now();
    const email = `reporter-${timestamp}@example.com`;

    await page.goto("/report");
    await page.getByTestId("machine-select").selectOption({ index: 1 });
    // Wait for URL refresh (router.push) to prevent race conditions on Mobile Safari
    await expect(page).toHaveURL(/machine=/);

    await fillReportForm(page, {
      title: `${PUBLIC_PREFIX} with Name and Email`,
      includePriority: false,
    });

    // Provide name and email
    await page.getByLabel("First Name").fill("John");
    await page.getByLabel("Last Name").fill("Smith");
    await page.getByLabel("Email Address").fill(email);

    await page.getByRole("button", { name: "Submit Issue Report" }).click();

    // Should redirect to success page with new_pending flag
    await expect(page).toHaveURL(/\/report\/success/);
    await expect(page.getByText("Want to track your reports?")).toBeVisible();

    // Click the signup link
    await page.getByRole("link", { name: "Join PinPoint" }).click();

    // Should redirect to signup page with name and email pre-filled
    await expect(page).toHaveURL(/\/signup\?/);
    await expect(page.getByLabel(/First Name/i)).toHaveValue("John");
    await expect(page.getByLabel(/Last Name/i)).toHaveValue("Smith");
    await expect(page.getByLabel(/Email/i)).toHaveValue(email);
  });

  test("should allow reporting another issue from success page", async ({
    page,
  }) => {
    await page.goto("/report/success");
    await page.getByRole("link", { name: "Report Another Issue" }).click();
    await expect(page).toHaveURL("/report");
  });

  test("should preserve draft when logging in from inline report-form link", async ({
    page,
  }) => {
    await page.goto("/report");
    await page.getByTestId("machine-select").selectOption({ index: 1 });
    await expect(page).toHaveURL(/machine=/);

    const machineInitials = new URL(page.url()).searchParams.get("machine");
    expect(machineInitials).toBeTruthy();
    if (!machineInitials) {
      throw new Error("Expected machine initials in report URL before login.");
    }

    const issueTitle = `${PUBLIC_PREFIX} Inline Login Draft ${Date.now()}`;
    const issueDescription = "Draft should survive inline login.";
    await fillReportForm(page, {
      title: issueTitle,
      description: issueDescription,
      includePriority: false,
    });

    await page.getByRole("link", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/login\?/);

    const next = new URL(page.url()).searchParams.get("next");
    expect(next).toBe(`/report?machine=${machineInitials}`);

    await page.getByLabel("Email").fill(TEST_USERS.member.email);
    await page
      .getByLabel("Password", { exact: true })
      .fill(TEST_USERS.member.password);
    await page.getByRole("button", { name: "Sign In" }).click();

    await expect(page).toHaveURL(
      new RegExp(`/report\\?machine=${machineInitials}`)
    );
    await expect(page.getByLabel("Issue Title")).toHaveValue(issueTitle);
    await expect(page.getByLabel("Description")).toHaveValue(issueDescription);
    await expect(page.getByLabel("First Name")).toHaveCount(0);
  });

  test("should preserve draft when logging in from header sign-in link", async ({
    page,
  }) => {
    await page.goto("/report");
    await page.getByTestId("machine-select").selectOption({ index: 1 });
    await expect(page).toHaveURL(/machine=/);

    const machineInitials = new URL(page.url()).searchParams.get("machine");
    expect(machineInitials).toBeTruthy();
    if (!machineInitials) {
      throw new Error("Expected machine initials in report URL before login.");
    }

    const issueTitle = `${PUBLIC_PREFIX} Header Login Draft ${Date.now()}`;
    const issueDescription = "Draft should survive header sign-in login.";
    await fillReportForm(page, {
      title: issueTitle,
      description: issueDescription,
      includePriority: false,
    });

    await page
      .locator('[data-testid="nav-signin"],[data-testid="mobile-nav-signin"]')
      .filter({ visible: true })
      .click();
    await expect(page).toHaveURL(/\/login\?/);

    const next = new URL(page.url()).searchParams.get("next");
    expect(next).toBe(`/report?machine=${machineInitials}`);

    await page.getByLabel("Email").fill(TEST_USERS.member.email);
    await page
      .getByLabel("Password", { exact: true })
      .fill(TEST_USERS.member.password);
    await page.getByRole("button", { name: "Sign In" }).click();

    await expect(page).toHaveURL(
      new RegExp(`/report\\?machine=${machineInitials}`)
    );
    await expect(page.getByLabel("Issue Title")).toHaveValue(issueTitle);
    await expect(page.getByLabel("Description")).toHaveValue(issueDescription);
    await expect(page.getByLabel("First Name")).toHaveCount(0);
  });

  test("should clear form draft after successful submission", async ({
    page,
  }) => {
    // Submit an issue first - select a machine (dropdown starts unselected)
    await page.goto("/report");
    const select = page.getByTestId("machine-select");

    // Verify machine dropdown starts with no selection (empty value)
    const initialMachineId = await select.inputValue();
    expect(initialMachineId).toBe(""); // Should be unselected by default

    // Select a machine (use index 1 to select the first actual machine option)
    await select.selectOption({ index: 1 });
    const selectedMachineId = await select.inputValue();
    expect(selectedMachineId).toBeTruthy(); // Should have a valid selection now
    await expect(page).toHaveURL(/machine=/);

    const issueTitle = `${PUBLIC_PREFIX} Draft Clear Test ${Date.now()}`;
    await fillReportForm(page, {
      title: issueTitle,
      description: "This should not persist after submission.",
      includePriority: false,
    });

    await page.getByRole("button", { name: "Submit Issue Report" }).click();
    await expect(page).toHaveURL("/report/success");

    // Wait for success page to load and ClearReportDraft effect to run
    await expect(
      page.getByRole("heading", { name: "Issue Sent!" })
    ).toBeVisible();

    // Verify localStorage was cleared on success page
    const draftAfterSuccess = await page.evaluate(() =>
      window.localStorage.getItem("report_form_state")
    );
    expect(draftAfterSuccess).toBeNull();

    // Click "Report Another Issue"
    await page.getByRole("link", { name: "Report Another Issue" }).click();

    // Wait for the report page to load
    await expect(page).toHaveURL("/report");
    await expect(
      page.getByRole("heading", { name: "Report an Issue" })
    ).toBeVisible();

    // Verify text fields are empty (draft cleared, not restored)
    await expect(page.getByLabel("Issue Title")).toHaveValue("");
    await expect(page.getByLabel("Description")).toHaveValue("");

    // Machine should be back to unselected state (empty), not the one we selected
    // This verifies draft wasn't restored - the form starts with no machine selected
    const machineAfterReset = await select.inputValue();
    expect(machineAfterReset).toBe(""); // Should be unselected again
    expect(machineAfterReset).not.toBe(selectedMachineId);
  });

  test("anonymous issue should have status forced to 'new'", async ({
    page,
  }, testInfo) => {
    // Security test: Verify server-side enforcement of status='new' for anonymous users
    // Even if form data were manipulated, the server should force status to 'new'

    const issueTitle = `${PUBLIC_PREFIX} Security Test ${Date.now()}`;

    // 1. Submit anonymous issue
    await page.goto("/report");
    await page.getByTestId("machine-select").selectOption({ index: 1 });
    await expect(page).toHaveURL(/machine=/);

    await fillReportForm(page, {
      title: issueTitle,
      description: "Testing that status is forced to new for anonymous users.",
      includePriority: false,
    });

    await page.getByRole("button", { name: "Submit Issue Report" }).click();
    await expect(page).toHaveURL("/report/success");

    // 2. Login as admin to verify the issue
    await loginAs(page, testInfo, {
      email: TEST_USERS.admin.email,
      password: TEST_USERS.admin.password,
    });

    // 3. Search for the issue we just created
    await page.goto("/issues");
    await page.getByPlaceholder("Search issues...").fill(issueTitle);
    await page.keyboard.press("Enter");
    await page.waitForURL((url) => url.searchParams.has("q"));

    // 4. Verify the issue appears in search results
    const issueRow = page.getByRole("row", { name: new RegExp(issueTitle) });
    await expect(issueRow).toBeVisible();

    // 5. Click the issue title link to navigate to detail page (status column may be hidden on mobile)
    await issueRow.getByTestId("issue-title").click();
    await expect(page).toHaveURL(/\/m\/[A-Z0-9]+\/i\/\d+/);

    // 6. Verify status badge shows 'New' on the detail page
    const statusBadge = page.getByTestId("issue-status-badge").first();
    await expect(statusBadge).toHaveText(/New/i);
  });
});
