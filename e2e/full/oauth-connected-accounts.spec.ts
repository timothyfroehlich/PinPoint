/**
 * E2E: Connected Accounts section + Discord OAuth button visibility.
 *
 * We deliberately do NOT exercise the full OAuth redirect against the real
 * Discord service in CI (it fails server-side with "Unsupported provider:
 * missing redirect URI" because CI uses dummy Discord credentials with no
 * registered redirect URI — Playwright route interception cannot help here
 * because the failure happens before any browser navigation).
 *
 * Instead we verify the testable UI surface:
 *
 *  1. An anonymous user sees "Continue with Discord" on /login.
 *  2. An authenticated user without Discord linked sees "Connect Discord"
 *     in settings.
 *  3. After directly inserting a row in auth.identities (simulating what a
 *     successful OAuth exchange would produce), the UI shows
 *     "Disconnect Discord" on reload.
 *  4. Clicking "Disconnect Discord" (which calls the server-side unlink action,
 *     not the external OAuth provider) reverts the UI to "Connect Discord".
 *
 * The OAuth handshake itself (browser → Discord → callback → DB row) is
 * integration territory and is explicitly out of scope for CI (PP-e20).
 *
 * Requires DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET to be set in the test
 * environment so that providers.discord.isAvailable() returns true and renders
 * the buttons. CI sets both to dummy values via
 * .github/actions/setup-supabase/action.yml.
 */

import { test, expect } from "@playwright/test";
import { loginAs } from "../support/actions.js";
import { getTestPrefix } from "../support/test-isolation.js";
import {
  createTestUser,
  deleteTestUser,
  updateUserRole,
  linkUserDiscordIdentity,
  unlinkUserDiscordIdentity,
} from "../support/supabase-admin.js";

test.describe("OAuth + Connected Accounts", () => {
  test.skip(
    !process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET,
    "Requires DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET — both are needed for providers.discord.isAvailable() to render the Discord buttons"
  );

  test.describe("anonymous", () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test("Continue with Discord button is visible on /login", async ({
      page,
    }) => {
      await page.goto("/login");
      await expect(
        page.getByRole("button", { name: /Continue with Discord/i })
      ).toBeVisible();
    });
  });

  test.describe("authenticated (member)", () => {
    let memberEmail: string;
    let memberId: string;

    test.beforeAll(async () => {
      const ts = Date.now();
      memberEmail = `member_oauth_${ts}@example.com`;
      const user = await createTestUser(memberEmail);
      memberId = user.id;
      await updateUserRole(memberId, "member");
    });

    test.afterAll(async () => {
      // Belt-and-suspenders cleanup: remove any lingering Discord identity
      // before deleting the user (FK constraint on auth.identities).
      await unlinkUserDiscordIdentity(memberId).catch(() => {
        // Tolerable if the row was already removed (e.g. test cleaned up).
      });
      await deleteTestUser(memberId);
    });

    test("Connect Discord button is visible when not linked", async ({
      page,
    }, testInfo) => {
      await loginAs(page, testInfo, {
        email: memberEmail,
        password: "TestPassword123",
      });
      await page.goto("/settings");

      await expect(
        page.getByRole("heading", { name: /connected accounts/i })
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /Connect Discord/i })
      ).toBeVisible();
    });

    test("Disconnect Discord appears after DB link; unlink reverts UI", async ({
      page,
    }, testInfo) => {
      // Log in BEFORE inserting the Discord identity.
      //
      // GoTrue's signInWithPassword validates ALL identities for the user
      // during authentication — inserting a synthetic identity row first and
      // then trying to sign in causes a "Database error querying schema" 500
      // from GoTrue (it rejects identity rows that don't fully match its
      // internal schema expectations). Logging in first gives us a valid
      // session; we then insert the identity and reload /settings, which reads
      // identities via the lighter-weight getUserIdentities() call that only
      // lists rows without the sign-in validation path.
      await loginAs(page, testInfo, {
        email: memberEmail,
        password: "TestPassword123",
      });

      // Simulate what a successful OAuth exchange would write to the DB.
      // Use the worker-specific prefix so parallel workers never produce the
      // same provider_id (user_profiles.discord_user_id is UNIQUE).
      const fakeDiscordId = `e2e-discord-${getTestPrefix()}`;
      try {
        await linkUserDiscordIdentity(memberId, fakeDiscordId);
        await page.goto("/settings");

        // The Connected Accounts section should now show Disconnect, not Connect.
        await expect(
          page.getByRole("button", { name: /Disconnect Discord/i })
        ).toBeVisible();

        // Click the button — this opens an AlertDialog confirmation.
        await page.getByRole("button", { name: /Disconnect Discord/i }).click();

        // Confirm inside the dialog (there are two buttons named "Disconnect Discord":
        // the trigger and the submit inside the dialog — use the submit one).
        const dialog = page.getByRole("alertdialog");
        await expect(dialog).toBeVisible();
        await dialog
          .getByRole("button", { name: /Disconnect Discord/i })
          .click();

        // The server action redirects to /settings?oauth_status=unlinked.
        // After the page reloads, "Connect Discord" should be visible again.
        await expect(
          page.getByRole("button", { name: /Connect Discord/i })
        ).toBeVisible({ timeout: 15_000 });
      } finally {
        // Cleanup in case the unlink action failed mid-test.
        await unlinkUserDiscordIdentity(memberId).catch(() => {
          // Already unlinked — ignore.
        });
      }
    });
  });
});
