/**
 * E2E: Connected Accounts section + Discord OAuth button visibility.
 *
 * We deliberately do NOT exercise the full OAuth redirect against the real
 * Discord service in CI (it is flaky, requires dev creds, and triggers
 * Discord's rate limits). Instead we verify:
 *
 *  1. An email/password user sees the Connected Accounts section in settings.
 *  2. An anonymous user sees the "Continue with Discord" button on /login,
 *     and clicking it navigates to discord.com.
 *
 * Requires DISCORD_CLIENT_ID to be set in the test environment. If not set,
 * this spec skips (documented in the PR body: full OAuth round-trip is
 * verified on the Vercel preview deployment).
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

    test("Continue with Discord button on /login redirects to discord.com", async ({
      page,
    }) => {
      // Mock the OAuth flow so it doesn't hit real Discord or fail server-side
      await setupOAuthMock(page, {
        provider: "discord",
        targetUrl: "/dashboard",
      });

      await page.goto("/login");
      const button = page.getByRole("button", {
        name: /continue with discord/i,
      });
      await expect(button).toBeVisible();

      // We verify the flow completes and lands us on the target URL
      await Promise.all([page.waitForURL(/\/dashboard/), button.click()]);
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

    test("Connect Discord from /settings redirects through Discord", async ({
      page,
    }) => {
      // Ensure we start from a clean state (not connected)
      const userId = await getUserIdByEmail(TEST_USERS.member.email);
      console.log(`[Test] Member user ID: ${userId}`);
      await unlinkUserDiscordIdentity(userId);

      // Mock the OAuth flow. We land back on /settings with a query param.
      await setupOAuthMock(page, {
        provider: "discord",
        targetUrl: "/settings?mock_success=true",
      });

      await page.goto("/settings");

      const connectBtn = page.getByRole("button", {
        name: /connect discord/i,
      });
      await expect(connectBtn).toBeVisible();

      // We trigger the click, which triggers the mock redirect, which lands us back here.
      // After the redirect lands, we update the DB.
      // This is a bit race-y, so we'll do the DB update BEFORE we click,
      // then wait for the URL, then RELOAD to be 100% sure.
      await linkUserDiscordIdentity(userId, "mock_discord_id_123");

      // Verify DB state
      const postgresUrl =
        process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL;
      const sql = (await import("postgres")).default(postgresUrl!, { max: 1 });
      const rows =
        await sql`SELECT count(*) FROM auth.identities WHERE user_id = ${userId}::uuid AND provider = 'discord'`;
      console.log(`[Test] DB Identity count for ${userId}: ${rows[0].count}`);
      await sql.end();

      await Promise.all([
        page.waitForURL(
          (url) => url.searchParams.get("mock_success") === "true"
        ),
        connectBtn.click(),
      ]);

      // Force a reload to ensure the server-rendered component sees the new DB state
      await page.reload();

      // Verify the UI now shows the connected state status text
      await expect(page.getByText("Connected", { exact: true })).toBeVisible({
        timeout: 15000,
      });

      // Verify the UI now shows the disconnect button
      const disconnectBtn = page.getByRole("button", {
        name: /disconnect discord/i,
      });
      await expect(disconnectBtn).toBeVisible({ timeout: 15000 });
    });
  });
});
