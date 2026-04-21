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

test.describe("OAuth + Connected Accounts", () => {
  test.skip(
    !process.env.DISCORD_CLIENT_ID,
    "Requires DISCORD_CLIENT_ID in test env"
  );

  test.describe("anonymous", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("Continue with Discord button on /login redirects to discord.com", async ({
      page,
    }) => {
      await page.goto("/login");
      const button = page.getByRole("button", {
        name: /continue with discord/i,
      });
      await expect(button).toBeVisible();

      await Promise.all([
        page.waitForURL(/discord\.com/, { timeout: 15_000 }),
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
  });
});
