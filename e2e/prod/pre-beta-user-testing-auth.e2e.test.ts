import { test, expect } from "@playwright/test";

// Attempts to authenticate using Dev Login buttons if available.
// Skips gracefully in production if dev login is not exposed.

async function tryDevLoginIfAvailable(
  page: import("@playwright/test").Page,
): Promise<boolean> {
  const timButton = page.getByTestId("dev-login-tim");
  const harryButton = page.getByTestId("dev-login-harry");
  // Wait briefly to see if dev login UI is rendered
  const hasTim = await timButton.count();
  const hasHarry = await harryButton.count();
  if (hasTim === 0 && hasHarry === 0) return false;
  const button = hasHarry > 0 ? harryButton.first() : timButton.first();
  await button.click();
  await page.waitForURL(/\/dashboard/, { timeout: 15_000 });
  await expect(page).toHaveURL(/\/dashboard/);
  return true;
}

test.describe.configure({ tags: ["@prod"] });

test.describe("prod: pre-beta-user-testing", () => {
  test.beforeEach(({}, testInfo) => {
    const base = testInfo.project.use.baseURL ?? "";
    if (base.includes("localhost")) {
      testInfo.skip(
        "Prod pre-beta behaviours disabled for single-tenant alpha / localhost",
      );
    }
  });

  test("APC alias: dev login (if available) lands on /dashboard", async ({
    page,
    baseURL,
  }) => {
    test.skip(!baseURL, "baseURL required");
    await page.goto("/auth/sign-in");
    const attempted = await tryDevLoginIfAvailable(page);
    test.skip(!attempted, "dev login not available in this environment");
  });

  test("Generic APC subdomain: dev login (if available) lands on /dashboard", async ({
    page,
    baseURL,
  }) => {
    test.skip(!baseURL, "baseURL required");
    await page.goto("/auth/sign-in");
    const attempted = await tryDevLoginIfAvailable(page);
    test.skip(!attempted, "dev login not available in this environment");
  });
});
