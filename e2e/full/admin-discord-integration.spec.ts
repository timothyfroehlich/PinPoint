import { test, expect } from "@playwright/test";
import { loginAs } from "../support/actions.js";
import {
  createTestUser,
  deleteTestUser,
  disableDiscordIntegration,
  updateUserRole,
} from "../support/supabase-admin.js";

test.describe("Admin Discord Integration", () => {
  let adminEmail: string;
  let adminId: string;

  test.beforeAll(async () => {
    const ts = Date.now();
    adminEmail = `admin_discord_${ts}@example.com`;
    const adminUser = await createTestUser(adminEmail);
    adminId = adminUser.id;
    await updateUserRole(adminId, "admin");

    // Ensure a clean baseline: no bot token, integration disabled. Seed
    // (db:_seed-discord) may have populated the row from env vars; this
    // makes the "switch disabled when no token" assertion below deterministic.
    await disableDiscordIntegration().catch(() => {
      // Tolerable if singleton row already matches.
    });
  });

  test.afterAll(async () => {
    await deleteTestUser(adminId);
  });

  test("admin can navigate to the Discord integration page via the user menu", async ({
    page,
  }, testInfo) => {
    await loginAs(page, testInfo, {
      email: adminEmail,
      password: "TestPassword123",
    });

    // Open the user menu and click the Integrations link.
    await page.getByTestId("user-menu-button").click();
    const integrationsLink = page.getByTestId("user-menu-admin-integrations");
    await expect(integrationsLink).toBeVisible();
    await integrationsLink.click();

    // Should land on the Discord admin page.
    await expect(page).toHaveURL("/admin/integrations/discord", {
      timeout: 10000,
    });
    await expect(
      page.getByRole("heading", { name: "Discord Integration" })
    ).toBeVisible();

    // Form fields should be present.
    await expect(page.getByLabel("Bot token")).toBeVisible();
    await expect(page.getByLabel("Server ID")).toBeVisible();
    await expect(page.getByLabel("Invite link")).toBeVisible();

    // Inline Validate buttons exist for both token and server fields.
    // (Two buttons named "Validate" — one per field.)
    await expect(page.getByRole("button", { name: "Validate" })).toHaveCount(2);

    // The activation switch is disabled until a bot token is in the form
    // (typed or saved in DB). On a fresh page load with no DB token and an
    // empty input, the switch must be disabled. Its label flips between
    // "Enabled" and "Disabled" based on state — start of "Disabled".
    const enabledSwitch = page.getByRole("switch");
    await expect(enabledSwitch).toBeVisible();
    await expect(enabledSwitch).toBeDisabled();
    await expect(page.getByText("Disabled")).toBeVisible();

    // Save / Reset footer present.
    await expect(
      page.getByRole("button", { name: "Save changes" })
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Reset" })).toBeVisible();
  });

  test("User Management link in the user menu lands on /admin/users", async ({
    page,
  }, testInfo) => {
    await loginAs(page, testInfo, {
      email: adminEmail,
      password: "TestPassword123",
    });

    // Open the user menu and click the (renamed) User Management link.
    await page.getByTestId("user-menu-button").click();
    const userMgmtLink = page.getByTestId("user-menu-admin");
    await expect(userMgmtLink).toBeVisible();
    await expect(userMgmtLink).toHaveText(/user management/i);
    await userMgmtLink.click();

    await expect(page).toHaveURL("/admin/users", { timeout: 10000 });
    await expect(
      page.getByRole("heading", { name: "User Management" })
    ).toBeVisible();
  });
});
