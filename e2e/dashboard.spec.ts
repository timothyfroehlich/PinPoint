import { test, expect } from "@playwright/test";

test("has title", async ({ page }) => {
  await page.goto("/");

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/PinPoint/);
});

test("login modal is visible", async ({ page }) => {
  await page.goto("/");

  // Expect the login modal to be visible
  await expect(page.getByText("Welcome to PinPoint")).toBeVisible();
  await expect(
    page.getByText("Enter your email to receive a magic link."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with Email" }),
  ).toBeVisible();
});
