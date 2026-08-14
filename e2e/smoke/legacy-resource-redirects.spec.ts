/**
 * Smoke: legacy id-addressed links redirect to the canonical routes.
 *
 * Coverage goal: D-class — `/issues/<uuid>` and `/machines/<uuid>` were the URL
 * shapes Discord notifications shipped until PP-gzq2, and neither was ever a
 * route. Discord DMs can't be edited, so those links live forever and the app
 * has to resolve them. E2E is the cheapest honest layer here: the thing under
 * test is Next's routing + redirect, not a function's return value (the URL
 * builder itself is unit-tested in src/lib/notifications/resource-url.test.ts).
 */
import { test, expect } from "@playwright/test";
import { seededIssue, seededMachines } from "../support/constants.js";

test.describe("Legacy resource-id redirects", () => {
  test("/issues/<uuid> lands on the canonical issue page", async ({ page }) => {
    const issue = seededIssue("HD");

    const response = await page.goto(`/issues/${issue.id}`);

    expect(response?.ok(), "redirect target should respond 2xx").toBe(true);
    await expect(page).toHaveURL(`/m/HD/i/${issue.num}`);
    await expect(
      page.getByRole("heading", { level: 1, name: issue.title })
    ).toBeVisible();
  });

  test("/machines/<uuid> lands on the canonical machine page", async ({
    page,
  }) => {
    const machine = seededMachines.humptyDumpty;

    const response = await page.goto(`/machines/${machine.id}`);

    expect(response?.ok(), "redirect target should respond 2xx").toBe(true);
    await expect(page).toHaveURL(`/m/${machine.initials}`);
  });

  test("an unknown id 404s rather than redirecting somewhere wrong", async ({
    page,
  }) => {
    const response = await page.goto(
      "/issues/00000000-0000-4000-8000-999999999999"
    );

    expect(response?.status()).toBe(404);
  });

  // A non-UUID segment reaches a `uuid` column, where Postgres raises 22P02
  // instead of returning no rows — so without a shape check these 500 through
  // the error boundary and report to Sentry. Crawlers and truncated pastes hit
  // this far more often than a well-formed but unknown id.
  for (const path of [
    "/issues/not-a-uuid",
    "/issues/robots.txt",
    "/machines/not-a-uuid",
  ]) {
    test(`${path} 404s instead of erroring`, async ({ page }) => {
      const response = await page.goto(path);

      expect(response?.status()).toBe(404);
    });
  }
});
