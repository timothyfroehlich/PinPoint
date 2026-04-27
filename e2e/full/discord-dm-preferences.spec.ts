import { test, expect } from "@playwright/test";
import { loginAs } from "../support/actions.js";
import {
  createTestUser,
  deleteTestUser,
  setUserDiscordId,
  updateUserRole,
  disableDiscordIntegration,
  enableDiscordIntegrationForTest,
} from "../support/supabase-admin.js";

// When DISCORD_BOT_TOKEN is set in the dev server's env, getDiscordConfig()
// short-circuits to env values and the integration is always considered
// enabled — independent of the DB row. The "hide when disabled" tests in
// this top-level describe rely on the DB-controlled path, so they only
// produce meaningful coverage when the env override is absent (CI). Skip
// them locally so contributors with credentials filled into .env.local
// don't see spurious red.
const envOverrideActive = !!process.env.DISCORD_BOT_TOKEN?.trim();

test.describe("Discord DM preferences", () => {
  test.skip(
    envOverrideActive,
    "DISCORD_BOT_TOKEN env override forces integration on; DB-disabled path unreachable"
  );

  let memberEmail: string;
  let memberId: string;

  test.beforeAll(async () => {
    const ts = Date.now();
    memberEmail = `member_discord_dm_${ts}@example.com`;
    const user = await createTestUser(memberEmail);
    memberId = user.id;
    await updateUserRole(memberId, "member");
  });

  test.afterAll(async () => {
    await deleteTestUser(memberId);
    // Belt-and-suspenders: ensure global state isn't dirty for other suites.
    await disableDiscordIntegration().catch(() => {
      // Tolerable if singleton row state already matches.
    });
  });

  test("Discord column is hidden when integration is disabled", async ({
    page,
  }, testInfo) => {
    await loginAs(page, testInfo, {
      email: memberEmail,
      password: "TestPassword123",
    });
    await page.goto("/settings");

    // Notification Preferences section should render the email/in-app columns
    // but NOT the Discord column when getDiscordConfig() returns null.
    await expect(
      page.getByRole("heading", { name: "Notification Preferences" })
    ).toBeVisible();
    await expect(page.getByLabel("Email Notifications")).toBeVisible();
    await expect(page.getByLabel("In-App Notifications")).toBeVisible();

    // Discord switch must NOT be present in this state.
    await expect(page.getByLabel("Discord Notifications")).not.toBeAttached();
  });

  test("Linked user without integration enabled still sees no Discord column", async ({
    page,
  }, testInfo) => {
    // Even if the user has discord_user_id set, the column hides until the
    // admin enables the integration (decision #18: don't advertise an
    // unavailable feature).
    await setUserDiscordId(memberId, "test-discord-id-1");

    try {
      await loginAs(page, testInfo, {
        email: memberEmail,
        password: "TestPassword123",
      });
      await page.goto("/settings");

      await expect(page.getByLabel("Discord Notifications")).not.toBeAttached();
    } finally {
      // Restore baseline so the previous test's assertion doesn't depend on
      // run order.
      await setUserDiscordId(memberId, null);
    }
  });
});

test.describe("Discord DM preferences (integration enabled)", () => {
  let memberEmail: string;
  let memberId: string;

  test.beforeAll(async () => {
    const ts = Date.now();
    memberEmail = `member_discord_dm_enabled_${ts}@example.com`;
    const user = await createTestUser(memberEmail);
    memberId = user.id;
    await updateUserRole(memberId, "member");

    // Flip the singleton row to enabled with a fake vault-backed token so
    // getDiscordConfig() returns non-null and the form renders the Discord
    // column.
    await enableDiscordIntegrationForTest();
  });

  test.afterAll(async () => {
    await disableDiscordIntegration().catch(() => {
      // Tolerable if singleton row state already matches.
    });
    await deleteTestUser(memberId);
  });

  test("Unlinked user sees Discord column with Link CTA and disabled main switch", async ({
    page,
  }, testInfo) => {
    // discord_user_id stays null for this test — the column should render
    // (admin enabled the integration) but the main switch is disabled with
    // a Link CTA pointing at Connected Accounts.
    await loginAs(page, testInfo, {
      email: memberEmail,
      password: "TestPassword123",
    });
    await page.goto("/settings");

    const discordMainSwitch = page.getByLabel("Discord Notifications");
    await expect(discordMainSwitch).toBeVisible();
    await expect(discordMainSwitch).toBeDisabled();

    // The "Link Discord" anchor sits in the same MainSwitchItem as the CTA.
    await expect(
      page.getByRole("link", { name: "Link Discord" })
    ).toBeVisible();
  });

  test("Linked user toggles Discord per-event preference and value persists across reload", async ({
    page,
  }, testInfo) => {
    await setUserDiscordId(memberId, "test-discord-id-toggle");

    try {
      await loginAs(page, testInfo, {
        email: memberEmail,
        password: "TestPassword123",
      });
      await page.goto("/settings");

      // Issue Assignment row, Discord column. Default is true (mirrors email
      // default per buildDefaultPrefs in dispatch.ts), so the switch starts
      // checked. Toggle it off, save, reload — value must round-trip.
      const discordAssignSwitch = page.locator("#discordNotifyOnAssigned");
      await expect(discordAssignSwitch).toBeVisible();
      await expect(discordAssignSwitch).toBeChecked();

      await discordAssignSwitch.click();
      await expect(discordAssignSwitch).not.toBeChecked();

      await page.getByRole("button", { name: "Save Preferences" }).click();
      // Server action completes when the success affordance flips on. The
      // button text changes to "Saved!" for ~3s on success.
      await expect(page.getByRole("button", { name: "Saved!" })).toBeVisible();

      await page.reload();

      const reloaded = page.locator("#discordNotifyOnAssigned");
      await expect(reloaded).toBeVisible();
      await expect(reloaded).not.toBeChecked();
    } finally {
      await setUserDiscordId(memberId, null);
    }
  });
});
