/**
 * E2E Tests for Public Issue Reporting
 *
 * Covers anonymous reporting workflow.
 */

import { test, expect } from "@playwright/test";
import { assertNoHorizontalOverflow } from "../support/actions";
import { cleanupTestEntities } from "../support/cleanup";
import { TEST_USERS } from "../support/constants";
import { fillReportForm } from "../support/page-helpers";

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

    // Verify no horizontal overflow on report page
    await assertNoHorizontalOverflow(page);

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
    await expect(page.getByLabel("Description")).toHaveText(issueDescription);
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

    // AppHeader is unified — same testid on all viewports
    await page.getByTestId("nav-signin").click();
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
    await expect(page.getByLabel("Description")).toHaveText(issueDescription);
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
    await expect(page.getByLabel("Description")).toHaveText("");

    // Machine should be back to unselected state (empty), not the one we selected
    // This verifies draft wasn't restored - the form starts with no machine selected
    const machineAfterReset = await select.inputValue();
    expect(machineAfterReset).toBe(""); // Should be unselected again
    expect(machineAfterReset).not.toBe(selectedMachineId);
  });
});
