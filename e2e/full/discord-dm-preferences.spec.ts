import { test, expect } from "../support/fixtures.js";
import { loginAs } from "../support/actions.js";
import {
  createTestUser,
  deleteTestUser,
  setUserDiscordId,
  updateUserRole,
  configureDiscordIntegrationForTest,
  unconfigureDiscordIntegrationForTest,
} from "../support/supabase-admin.js";

test.describe("Discord DM preferences (integration configured)", () => {
  let memberEmail: string;
  let memberId: string;

  test.beforeAll(async () => {
    const ts = Date.now();
    memberEmail = `member_discord_dm_enabled_${ts}@example.com`;
    const user = await createTestUser(memberEmail);
    memberId = user.id;
    await updateUserRole(memberId, "member");

    // Configure the singleton with a fake vault-backed token and guild ID so
    // getDiscordConfig() returns non-null and the form renders the Discord
    // column.
    await configureDiscordIntegrationForTest();
  });

  test.afterAll(async () => {
    await unconfigureDiscordIntegrationForTest().catch(() => {
      // Tolerable if singleton row state already matches.
    });
    await deleteTestUser(memberId);
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
