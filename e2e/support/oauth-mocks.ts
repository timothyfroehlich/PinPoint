import { type Page } from "@playwright/test";

/**
 * Mocks the entire OAuth flow at the network level for E2E tests.
 *
 * Prevents network requests to external providers (Discord, etc.) by
 * intercepting the navigation to the Supabase Auth authorize endpoint.
 * This lets the Next.js Server Action complete cleanly.
 *
 * The `targetUrl` is resolved against the app's baseURL so the redirect
 * `Location` header is always absolute (required for cross-origin 302s
 * to land on the Next.js app, not the Supabase origin).
 *
 * @param page Playwright page object
 * @param options Mock configuration
 */
export async function setupOAuthMock(
  page: Page,
  options: {
    provider: "discord";
    /** The path (relative to app baseURL) the user should land on after "successful" auth */
    targetUrl?: string;
  }
) {
  const { provider, targetUrl = "/dashboard" } = options;

  // Derive the app baseURL from the current page context so the redirect
  // Location header is an absolute URL. This is required: relative URLs in
  // a 302 Location header are resolved against the *Supabase* origin, not
  // the Next.js app origin.
  const pageUrl = page.url();
  const appOrigin =
    pageUrl && pageUrl !== "about:blank"
      ? new URL(pageUrl).origin
      : (process.env.NEXT_PUBLIC_BASE_URL ??
        `http://localhost:${process.env.PORT ?? "3000"}`);

  const absoluteTargetUrl = targetUrl.startsWith("http")
    ? targetUrl
    : `${appOrigin}${targetUrl}`;

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

      // Fulfill with an absolute redirect back to the app's target URL,
      // simulating the completion of the OAuth flow and the callback redirect.
      await route.fulfill({
        status: 302,
        headers: {
          Location: absoluteTargetUrl,
        },
      });
    }
  );
}
