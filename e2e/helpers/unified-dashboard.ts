import type { Page, Expect } from "@playwright/test";

export async function loginAsUser(
  page: Page,
  userType: "Test Admin" | "Test Member" | "Test Player",
): Promise<void> {
  await page.locator('text="Dev Quick Login"').click();
  await page.locator(`button:has-text("${userType}")`).click();
  await page.waitForTimeout(3000);
}

export async function logout(page: Page): Promise<void> {
  await page.locator('button[aria-label="account of current user"]').click();
  await page.locator('text="Logout"').click();
  await page.waitForTimeout(3000);
}

export async function verifyPublicContent(
  page: Page,
  expect: Expect,
): Promise<void> {
  await expect(page.locator("text=Our Locations")).toBeVisible();
  await expect(page.locator("text=Austin Pinball Collective")).toBeVisible();
}

export async function verifyAuthenticatedContent(
  page: Page,
  expect: Expect,
): Promise<void> {
  await expect(page.locator("text=My Dashboard")).toBeVisible();
  await expect(page.locator("text=My Open Issues")).toBeVisible();
}

export async function verifyPublicOnlyContent(
  page: Page,
  expect: Expect,
): Promise<void> {
  await verifyPublicContent(page, expect);
  await expect(page.locator("text=My Dashboard")).not.toBeVisible();
  await expect(page.locator("text=My Open Issues")).not.toBeVisible();
}

export async function verifyNavigationState(
  page: Page,
  expect: Expect,
  isAuthenticated: boolean,
): Promise<void> {
  if (isAuthenticated) {
    // Should see user avatar and authenticated navigation
    await expect(
      page.locator('button[aria-label="account of current user"]'),
    ).toBeVisible();
    await expect(page.locator("text=Issues")).toBeVisible();
    await expect(page.locator("text=Games")).toBeVisible();
    await expect(page.locator("text=Sign In")).not.toBeVisible();
  } else {
    // Should see sign in button and no authenticated navigation
    await expect(
      page
        .locator("text=Sign In")
        .or(page.locator("button:has-text('Sign In')")),
    ).toBeVisible();
    await expect(
      page.locator('button[aria-label="account of current user"]'),
    ).not.toBeVisible();
  }
}

export async function clearSession(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}
