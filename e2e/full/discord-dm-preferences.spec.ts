import { test, expect } from "@playwright/test";
import { loginAs } from "../support/actions.js";
import {
  createTestUser,
  deleteTestUser,
  setUserDiscordId,
  updateUserRole,
  disableDiscordIntegration,
} from "../support/supabase-admin.js";

test.describe("Discord DM preferences", () => {
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
