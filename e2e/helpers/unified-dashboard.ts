import type { Page, Expect } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Enhanced login with retry logic and proper wait conditions
 */
export async function loginAsUser(
  page: Page,
  userType: "Test Admin" | "Test Member" | "Test Player",
  maxRetries: number = 3,
): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Clear any existing session state
      await clearSession(page);

      // Navigate to home page if not already there
      if (!page.url().includes("localhost:3000/")) {
        await page.goto("/");
      }

      // Wait for page to be ready
      await page.waitForLoadState("networkidle");

      // Perform login
      await page.locator('text="Dev Quick Login"').click();
      await page.locator(`button:has-text("${userType}")`).click();

      // Wait for authentication to complete - look for authenticated content
      // The Dev login triggers a page reload, so we need to wait for that
      await waitForAuthentication(page);

      // Verify authentication was successful
      await expect(page.locator('text="My Dashboard"')).toBeVisible({
        timeout: 5000,
      });

      console.log(
        `Authentication successful for ${userType} on attempt ${attempt}`,
      );
      return; // Success - exit retry loop
    } catch (error) {
      console.log(
        `Authentication attempt ${attempt} failed for ${userType}:`,
        error,
      );

      if (attempt === maxRetries) {
        throw new Error(
          `Authentication failed for ${userType} after ${maxRetries} attempts: ${error}`,
        );
      }

      // Exponential backoff before retry
      const delay = 1000 * attempt;
      console.log(`Waiting ${delay}ms before retry...`);
      await page.waitForTimeout(delay);
    }
  }
}

/**
 * Wait for authentication state to be established
 */
async function waitForAuthentication(page: Page): Promise<void> {
  // Dev login triggers window.location.reload(), so wait for the page reload
  await page.waitForLoadState("networkidle");

  // Wait a bit more for React to rehydrate and render authenticated content
  await page.waitForTimeout(3000);
}

/**
 * Enhanced logout with retry logic and proper wait conditions
 */
export async function logout(
  page: Page,
  maxRetries: number = 2,
): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Try to click user menu if it exists
      const userMenu = page.locator(
        'button[aria-label="account of current user"]',
      );
      if (await userMenu.isVisible()) {
        await userMenu.click();
        await page.locator('text="Logout"').click();

        // Wait for logout to complete - look for sign in button
        await waitForLogout(page);

        // Verify logout was successful
        await expect(page.locator('button:has-text("Sign In")')).toBeVisible({
          timeout: 5000,
        });

        console.log(`Logout successful on attempt ${attempt}`);
        return;
      } else {
        console.log(`User already logged out on attempt ${attempt}`);
        return;
      }
    } catch (error) {
      console.log(`Logout attempt ${attempt} failed:`, error);

      if (attempt === maxRetries) {
        // Fallback: clear session manually
        await clearSession(page);
        await page.goto("/");
        return;
      }

      await page.waitForTimeout(1000 * attempt);
    }
  }
}

/**
 * Wait for logout state to be established
 */
async function waitForLogout(
  page: Page,
  timeout: number = 8000,
): Promise<void> {
  try {
    await page.waitForFunction(
      () => {
        // Check if sign in button is visible
        const signInButton =
          document.querySelector('button:has-text("Sign In")') ||
          document.querySelector('[data-testid="sign-in-button"]');

        // Check if user menu is gone
        const userMenu = document.querySelector(
          'button[aria-label="account of current user"]',
        );

        return signInButton && !userMenu;
      },
      { timeout },
    );
  } catch (error) {
    // Fallback: wait for page state
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);
  }
}

export async function verifyPublicContent(
  page: Page,
  expect: Expect,
): Promise<void> {
  await expect(page.locator("text=Our Locations")).toBeVisible();
  await expect(page.locator("text=Austin Pinball Collective")).toBeVisible();
}

/**
 * Enhanced authenticated content verification with retry logic
 */
export async function verifyAuthenticatedContent(
  page: Page,
  expect: Expect,
  timeout: number = 10000,
): Promise<void> {
  // Wait for authenticated content with longer timeout
  await expect(page.locator("text=My Dashboard")).toBeVisible({ timeout });
  await expect(page.locator("text=My Open Issues")).toBeVisible({ timeout });

  // Also verify user menu is present (indicates authentication state)
  await expect(
    page.locator('button[aria-label="account of current user"]'),
  ).toBeVisible({ timeout: 5000 });
}

export async function verifyPublicOnlyContent(
  page: Page,
  expect: Expect,
): Promise<void> {
  await verifyPublicContent(page, expect);
  await expect(page.locator("text=My Dashboard")).not.toBeVisible();
  await expect(page.locator("text=My Open Issues")).not.toBeVisible();
}

/**
 * Enhanced navigation state verification with responsive design support
 */
export async function verifyNavigationState(
  page: Page,
  expect: Expect,
  isAuthenticated: boolean,
): Promise<void> {
  const viewport = await page.viewportSize();
  const isMobile = viewport ? viewport.width < 900 : false; // md breakpoint

  if (isAuthenticated) {
    // Should see user avatar
    await expect(
      page.locator('button[aria-label="account of current user"]'),
    ).toBeVisible();

    // Navigation items are hidden on mobile, only check on desktop
    if (!isMobile) {
      await expect(page.locator("button", { hasText: "Issues" })).toBeVisible();
      await expect(page.locator("button", { hasText: "Games" })).toBeVisible();
    }

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
