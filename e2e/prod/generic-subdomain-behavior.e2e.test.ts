import { test, expect } from "@playwright/test";

test.describe("prod: generic host with APC subdomain", () => {
  test("sign-in hides org dropdown when visiting apc.<generic-host>", async ({
    page,
    baseURL,
  }) => {
    test.skip(!baseURL, "baseURL required");
    await page.goto("/auth/sign-in");
    const orgSelectTrigger = page.getByTestId("org-select-trigger");
    await expect(orgSelectTrigger).toHaveCount(0);
  });
});
