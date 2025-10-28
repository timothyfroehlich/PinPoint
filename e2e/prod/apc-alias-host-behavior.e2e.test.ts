import { test, expect } from "@playwright/test";

test.describe("prod: APC alias host", () => {
  test("root redirects to /auth/sign-in (no landing page)", async ({
    page,
    baseURL,
  }) => {
    test.skip(!baseURL, "baseURL required");
    const res = await page.goto("/");
    // Accept either hard redirect or client redirect
    await expect(page).toHaveURL(/\/auth\/sign-in/);
    expect(res?.status()).toBeLessThan(400);
  });

  // @multi-org-only - Skip in alpha single-org mode
  // Alpha mode removed org selection UI entirely (no dropdown anywhere)
  test.skip("sign-in page hides organization dropdown (org locked by host)", async ({
    page,
    baseURL,
  }) => {
    test.skip(!baseURL, "baseURL required");
    await page.goto("/auth/sign-in");
    const orgSelectTrigger = page.getByTestId("org-select-trigger");
    await expect(orgSelectTrigger).toHaveCount(0);
    // And generic landing content should not be present here
    await expect(
      page.getByRole("heading", { name: "PinPoint" }),
    ).not.toBeVisible();
  });
});
