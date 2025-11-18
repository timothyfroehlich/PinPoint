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
        name: "Report an Issue with a Pinball Machine",
      })
    ).toBeVisible();

    const select = page.getByLabel("Machine *");
    const options = await select.evaluate((element) => {
      const selectElement = element as HTMLSelectElement;
      return Array.from(selectElement.options).map((option) => ({
        value: option.value,
        text: option.text,
      }));
    });
    console.log("machine options", options);
    await select.selectOption({ label: "Medieval Madness" });
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
        name: "Thank You for Reporting This Issue!",
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
});
