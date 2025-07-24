import { test, expect } from "@playwright/test";

test("has title", async ({ page }) => {
  await page.goto("/");

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/PinPoint/);
});

test("public dashboard content is visible when not authenticated", async ({
  page,
}) => {
  await page.goto("/");

  // Expect the public organization content to be visible
  await expect(
    page.locator('h1:has-text("Austin Pinball Collective")'),
  ).toBeVisible();
  await expect(page.getByText("Browse our pinball locations")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();

  // Should also see Dev Quick Login in development
  await expect(page.getByText("Dev Quick Login")).toBeVisible();
});
