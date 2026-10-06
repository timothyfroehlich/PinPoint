/**
 * E2E Tests for Public Issue Reporting - Extended (Full Suite)
 *
 * Tests for email prompt and signup pre-fill flows.
 * Core reporting tests are in e2e/smoke/public-reporting.spec.ts.
 * Anonymous and guest status/priority enforcement tested in public-issue-submit.test.ts (PGlite integration).
 */

import { test, expect } from "../support/fixtures.js";
import { selectMachine } from "../support/actions.js";
import { cleanupTestEntities } from "../support/cleanup.js";
import { fillReportForm } from "../support/page-helpers.js";

const PUBLIC_PREFIX = "E2E Public Report";

test.describe("Public Issue Reporting - Extended", () => {
  test.afterEach(async () => {
    await cleanupTestEntities({
      issueTitlePrefix: PUBLIC_PREFIX,
    });
  });

  test("should show signup prompt when anonymous user provides email", async ({
    page,
  }) => {
    const timestamp = Date.now();
    const email = `newuser-${timestamp}@example.com`;

    await page.goto("/report/detailed");
    await selectMachine(page);
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
    await page.goto("/report/detailed");
    await selectMachine(page);
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

    await page.goto("/report/detailed");
    await selectMachine(page);
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
});
