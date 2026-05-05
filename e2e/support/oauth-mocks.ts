import { type Page } from "@playwright/test";

/**
 * Mocks the entire OAuth flow at the network level for E2E tests.
 *
 * Prevents network requests to external providers (Discord, etc.) by
 * intercepting the navigation to the Supabase Auth authorize endpoint.
 * This lets the Next.js Server Action complete cleanly.
 *
 * @param page Playwright page object
 * @param options Mock configuration
 */
export async function setupOAuthMock(
  page: Page,
  options: {
    provider: "discord";
    /** The URL the user should land on after "successful" auth */
    targetUrl?: string;
  }
) {
  const { provider, targetUrl = "/dashboard" } = options;

  // When the Next.js Server Action completes, it redirects the browser to
  // the Supabase Auth API (/auth/v1/authorize?provider=...).
  // We intercept this navigation. Since this is a standard browser navigation
  // outside the Next.js app, we don't break the client-side router.
  await page.route(
    `**/auth/v1/authorize?provider=${provider}**`,
    async (route) => {
      console.log(
        `[OAuth Mock] Intercepted Supabase Authorize: ${route.request().url()}`
      );

      // Fulfill with a redirect back to the app's target URL, simulating
      // the completion of the OAuth flow and the callback redirect.
      await route.fulfill({
        status: 302,
        headers: {
          Location: targetUrl,
        },
      });
    }
  );
}
