import { type Page } from "@playwright/test";

/**
 * Logout helper function to clear user session
 */
export async function logout(page: Page) {
  // Clear all cookies first
  await page.context().clearCookies();

  // Try to visit logout endpoint if it exists
  try {
    await page.goto("/auth/signout");
    await page.waitForTimeout(500);
  } catch (error) {
    // Ignore errors if logout endpoint doesn't exist
    console.log("Logout endpoint not available");
  }

  // Navigate to a simple page first to enable storage access
  try {
    await page.goto("/");
    await page.waitForTimeout(100);

    // Clear storage only after navigating to a page
    await page.evaluate(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (e) {
        // Ignore storage access errors
        console.log("Storage not accessible, skipping");
      }
    });
  } catch (error) {
    // If navigation fails, just continue
    console.log("Could not clear storage, continuing without it");
  }
}
