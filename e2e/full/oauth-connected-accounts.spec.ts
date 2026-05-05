/**
 * E2E: Connected Accounts section + Discord OAuth button visibility.
 *
 * We deliberately do NOT exercise the full OAuth redirect against the real
 * Discord service in CI (it is flaky, requires dev creds, and triggers
 * Discord's rate limits). Instead we verify:
 *
 *  1. An email/password user sees the Connected Accounts section in settings.
 *  2. An anonymous user sees the "Continue with Discord" button on /login,
 *     and clicking it triggers the Supabase authorize redirect (intercepted by
 *     the mock, which redirects back into the app).
 *  3. An authenticated member can trigger Connect Discord, the mock intercepts
 *     the authorize redirect, and after the DB identity is seeded the UI
 *     reflects the linked state.
 *
 * The OAuth flow is mocked via Playwright route interception — no test reaches
 * a real external provider. See e2e/support/oauth-mocks.ts.
 */

import { test, expect } from "@playwright/test";
import { STORAGE_STATE } from "../support/auth-state";
import { setupOAuthMock } from "../support/oauth-mocks";
import {
  linkUserDiscordIdentity,
  unlinkUserDiscordIdentity,
  getUserIdByEmail,
} from "../support/supabase-admin";
import { TEST_USERS } from "../support/constants";

test.describe("OAuth + Connected Accounts", () => {
  test.describe("anonymous", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("Continue with Discord button on /login triggers mocked OAuth flow", async ({
      page,
    }) => {
      // Mock the OAuth flow so it doesn't hit real Discord.
      // We redirect back to /login (a public page accessible to anonymous users)
      // with a query param so we can verify the flow completed.
      await setupOAuthMock(page, {
        provider: "discord",
        targetUrl: "/login?oauth_mock=true",
      });

      await page.goto("/login");
      const button = page.getByRole("button", {
        name: /continue with discord/i,
      });
      await expect(button).toBeVisible();

      // Clicking the button triggers the server action → Supabase authorize →
      // our mock intercepts and redirects back to /login?oauth_mock=true.
      await Promise.all([
        page.waitForURL((url) => url.searchParams.get("oauth_mock") === "true"),
        button.click(),
      ]);
    });
  });

  test.describe("authenticated (member)", () => {
    test.use({ storageState: STORAGE_STATE.member });

    test("Connected Accounts section renders on settings page", async ({
      page,
    }) => {
      await page.goto("/settings");

      await expect(
        page.getByRole("heading", { name: /connected accounts/i })
      ).toBeVisible();

      const connectBtn = page.getByRole("button", {
        name: /connect discord/i,
      });
      await expect(connectBtn).toBeVisible();
    });

    test("Connect Discord from /settings completes mocked OAuth flow and shows connected state", async ({
      page,
    }) => {
      // Ensure we start from a clean (not connected) state.
      const userId = await getUserIdByEmail(TEST_USERS.member.email);
      await unlinkUserDiscordIdentity(userId);

      // Set up the mock BEFORE navigating so the route handler is in place.
      // We land back on /settings with a query param to signal the mock redirect.
      await setupOAuthMock(page, {
        provider: "discord",
        targetUrl: "/settings?mock_success=true",
      });

      await page.goto("/settings");

      const connectBtn = page.getByRole("button", {
        name: /connect discord/i,
      });
      await expect(connectBtn).toBeVisible();

      // Click triggers: server action → Supabase authorize → mock intercepts →
      // redirects to /settings?mock_success=true.
      await Promise.all([
        page.waitForURL(
          (url) => url.searchParams.get("mock_success") === "true"
        ),
        connectBtn.click(),
      ]);

      // Simulate what the real OAuth callback would do: insert the identity row.
      // We do this AFTER the click (post-redirect) so the pre-navigation page
      // still shows the correct "Connect" button.
      await linkUserDiscordIdentity(userId, `mock_discord_${userId}`);

      // Reload so the server-rendered component reads the updated DB state.
      await page.reload();

      // Verify the UI now shows the connected state.
      await expect(page.getByText("Connected", { exact: true })).toBeVisible({
        timeout: 15000,
      });

      const disconnectBtn = page.getByRole("button", {
        name: /disconnect discord/i,
      });
      await expect(disconnectBtn).toBeVisible({ timeout: 15000 });
    });
  });
});
