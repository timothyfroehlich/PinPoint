/**
 * E2E Tests for Public Issue Reporting
 *
 * Covers anonymous reporting workflow.
 */

import { test, expect } from "@playwright/test";
import { cleanupTestEntities } from "../support/cleanup";

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

    const select = page.getByLabel("Machine *");
    await expect(select).toBeVisible();
    await select.selectOption({ index: 1 });
    // Wait for URL refresh (router.push) to prevent race conditions on Mobile Safari
    await expect(page).toHaveURL(/machine=/);

    const issueTitle = `${PUBLIC_PREFIX} ${Date.now()}`;
    await page.getByLabel("Issue Title *").fill(issueTitle);
    await page
      .getByLabel("Description")
      .fill("Playfield gets stuck during multiball.");
    await page.getByLabel("Severity *").selectOption("playable");
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
    await page.getByLabel("Machine *").selectOption({ index: 1 });
    // Wait for URL refresh (router.push) to prevent race conditions on Mobile Safari
    await expect(page).toHaveURL(/machine=/);

    await page.getByLabel("Issue Title *").fill(`${PUBLIC_PREFIX} with Email`);
    await page.getByLabel("Severity *").selectOption("minor");

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

  test("should allow reporting another issue from success page", async ({
    page,
  }) => {
    await page.goto("/report/success");
    await page.getByRole("link", { name: "Report Another Issue" }).click();
    await expect(page).toHaveURL("/report");
  });
});
