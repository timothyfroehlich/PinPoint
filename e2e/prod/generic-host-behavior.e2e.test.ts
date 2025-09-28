import { test, expect } from "@playwright/test";

test.describe("prod: generic host", () => {
  test("landing page is visible at root and CTA links to sign-in", async ({
    page,
    baseURL,
  }, testInfo) => {
    test.skip(!baseURL, "baseURL required");
    // Skip this test in authenticated projects - it should test unauthenticated behavior
    test.skip(testInfo.project.name.includes("-auth"), "Skipping in authenticated projects");

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "PinPoint" })).toBeVisible();
    const cta = page.getByRole("link", { name: /get started/i });
    await expect(cta).toBeVisible();
    await cta.click();
    await expect(page).toHaveURL(/\/auth\/sign-in/);
  });

  test("sign-in page shows organization dropdown", async ({
    page,
    baseURL,
  }, testInfo) => {
    test.skip(!baseURL, "baseURL required");
    // Skip this test in authenticated projects - it should test unauthenticated behavior
    test.skip(testInfo.project.name.includes("-auth"), "Skipping in authenticated projects");

    await page.goto("/auth/sign-in");
    const orgSelectTrigger = page.getByTestId("org-select-trigger");
    await expect(orgSelectTrigger).toBeVisible();
  });
});
