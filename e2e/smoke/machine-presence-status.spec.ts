import { test, expect } from "@playwright/test";
import { ensureLoggedIn } from "../support/actions";
import { cleanupTestEntities } from "../support/cleanup";
import { fillReportForm } from "../support/page-helpers";
import { TEST_USERS } from "../support/constants";

test.describe("Machine Presence Status", () => {
  let machineInitials: string | undefined;
  let issueTitlePrefix: string | undefined;

  test.beforeEach(async ({ page }, testInfo) => {
    await ensureLoggedIn(page, testInfo, {
      email: TEST_USERS.admin.email,
      password: TEST_USERS.admin.password,
    });
  });

  test.afterEach(async ({ request }) => {
    if (!machineInitials && !issueTitlePrefix) {
      return;
    }

    await cleanupTestEntities(request, {
      machineInitials: machineInitials ? [machineInitials] : [],
      issueTitlePrefix,
    });

    machineInitials = undefined;
    issueTitlePrefix = undefined;
  });

  test("filters machines/issues by presence and supports editing presence", async ({
    page,
  }) => {
    const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
    machineInitials = `P${suffix}`.slice(0, 6);
    const machineName = `Presence Test ${suffix}`;
    issueTitlePrefix = `[presence-${suffix}]`;
    const issueTitle = `${issueTitlePrefix} hidden by inactive machine filter`;

    // Create a dedicated test machine.
    await page.goto("/m/new");
    await page.getByLabel(/Initials/i).fill(machineInitials);
    await page.getByLabel(/Machine Name/i).fill(machineName);
    await page.getByRole("button", { name: "Create Machine" }).click();
    await expect(page).toHaveURL(`/m/${machineInitials}`);
    await expect(
      page.getByRole("heading", { name: machineName, exact: true })
    ).toBeVisible();

    // Create an issue while machine is on the floor.
    await page.getByTestId("machine-report-issue").click();
    await fillReportForm(page, {
      title: issueTitle,
      severity: "minor",
      frequency: "intermittent",
    });
    await page.getByRole("button", { name: "Submit Issue Report" }).click();
    await expect(page).toHaveURL(new RegExp(`/m/${machineInitials}/i/\\d+$`));

    // Baseline: issue is visible in /issues while machine is on the floor.
    await page.goto("/issues");
    await page.getByPlaceholder("Search issues...").fill(issueTitle);
    await page.keyboard.press("Enter");
    await page.waitForURL((url) => url.searchParams.get("q") === issueTitle);
    await expect(page.getByRole("row", { name: issueTitle })).toBeVisible();

    // Update machine presence to On Loan via edit modal.
    await page.goto(`/m/${machineInitials}`);
    await page.getByTestId("edit-machine-button").click();

    const presenceSelect = page.getByRole("combobox", {
      name: "Presence Status",
    });
    await expect(presenceSelect).toBeVisible();
    await presenceSelect.click();
    await page.getByRole("option", { name: "On Loan" }).click();

    await page.getByRole("button", { name: "Update Machine" }).click();
    await expect(
      page.getByRole("heading", { name: "Edit Machine" })
    ).toBeHidden();

    // Machine detail shows presence status badge + inactive banner.
    await expect(page.getByText("On Loan").first()).toBeVisible();
    await expect(
      page.getByText("This machine is currently on loan.")
    ).toBeVisible();

    // Machine list default hides non-floor machines.
    await page.goto("/m");
    await expect(
      page.getByRole("link", { name: new RegExp(machineName, "i") })
    ).not.toBeVisible();

    // Presence filter reveals non-floor machine.
    const presenceFilter = page
      .getByRole("combobox")
      .filter({ hasText: "Presence" });
    await presenceFilter.click();
    await page.getByRole("option", { name: "On Loan" }).click();
    await page.keyboard.press("Escape");

    await expect(page).toHaveURL(/presence=.*on_loan/);
    await expect(
      page.getByRole("link", { name: new RegExp(machineName, "i") })
    ).toBeVisible();

    // Issues list now excludes this issue by default (inactive machine).
    await page.goto("/issues");
    await page.getByPlaceholder("Search issues...").fill(issueTitle);
    await page.keyboard.press("Enter");
    await page.waitForURL((url) => url.searchParams.get("q") === issueTitle);
    await expect(page.getByText("No issues found")).toBeVisible();
  });
});
